'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Participant, SocketEvents, WebRTCSignalData } from '@photobooth/shared';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC(
  socket: Socket | null,
  selfParticipantId: string | null,
  participants: Participant[],
  localStream: MediaStream | null
) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [peerConnections, setPeerConnections] = useState<Record<string, RTCPeerConnection>>({});

  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Keep a ref to localStream so getOrCreatePeerConnection always reads the latest
  // without localStream being in its useCallback dep array (BUG-4 fix)
  const localStreamRef = useRef<MediaStream | null>(localStream);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  // Helper to create and configure a peer connection
  const getOrCreatePeerConnection = useCallback(
    (targetParticipantId: string): RTCPeerConnection => {
      let pc = pcMapRef.current.get(targetParticipantId);
      if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
        return pc;
      }

      console.log(`[WebRTC] Creating peer connection to ${targetParticipantId}`);
      pc = new RTCPeerConnection(RTC_CONFIG);
      pcMapRef.current.set(targetParticipantId, pc);

      // Attach local tracks via ref
      if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            pc?.addTrack(track, localStreamRef.current!);
          } catch (e) {
            console.warn('[WebRTC] Error adding local track:', e);
          }
        });
      } else {
        // If local stream is not yet ready, prepare transceivers so incoming SDP can negotiate
        try {
          if (pc.getTransceivers().length === 0) {
            pc.addTransceiver('video', { direction: 'sendrecv' });
            pc.addTransceiver('audio', { direction: 'sendrecv' });
          }
        } catch (e) {
          console.warn('[WebRTC] addTransceiver warning:', e);
        }
      }

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          const signal: WebRTCSignalData = {
            senderId: selfParticipantId || '',
            targetId: targetParticipantId,
            type: 'ice-candidate',
            payload: event.candidate.toJSON(),
          };
          socket.emit(SocketEvents.WEBRTC_SIGNAL, signal);
        }
      };

      // Handle incoming remote media tracks
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track from ${targetParticipantId}:`, event.track.kind);
        setRemoteStreams((prev) => {
          // Construct a fresh MediaStream instance every time so React state reference changes
          // and triggers PhotoboothCanvas video element refresh
          const existing = prev[targetParticipantId];
          let updated: MediaStream;
          if (event.streams && event.streams[0]) {
            updated = new MediaStream(event.streams[0].getTracks());
          } else {
            const tracks = existing ? existing.getTracks().filter((t) => t.id !== event.track.id) : [];
            tracks.push(event.track);
            updated = new MediaStream(tracks);
          }
          return {
            ...prev,
            [targetParticipantId]: updated,
          };
        });
      };

      pc.onconnectionstatechange = async () => {
        console.log(`[WebRTC] Connection with ${targetParticipantId}: ${pc?.connectionState}`);
        if (pc?.connectionState === 'failed') {
          console.warn(`[WebRTC] Connection failed with ${targetParticipantId}, attempting ICE restart offer...`);
          try {
            if (selfParticipantId && socket) {
              const offer = await pc.createOffer({ iceRestart: true });
              await pc.setLocalDescription(offer);
              const signal: WebRTCSignalData = {
                senderId: selfParticipantId,
                targetId: targetParticipantId,
                type: 'offer',
                payload: offer,
              };
              socket.emit(SocketEvents.WEBRTC_SIGNAL, signal);
            }
          } catch (e) {
            console.warn('[WebRTC] ICE restart offer error:', e);
          }
        }
      };

      setPeerConnections((prev) => ({ ...prev, [targetParticipantId]: pc! }));
      return pc;
    },
    // localStream intentionally omitted — read via ref (BUG-4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socket, selfParticipantId]
  );

  // Update tracks when localStream changes
  useEffect(() => {
    if (!localStream) return;

    pcMapRef.current.forEach((pc) => {
      const transceivers = pc.getTransceivers();
      localStream.getTracks().forEach((track) => {
        const matching = transceivers.find((t) => {
          if (t.sender.track) return t.sender.track.kind === track.kind;
          return t.receiver.track?.kind === track.kind;
        });
        if (matching && matching.sender) {
          matching.sender.replaceTrack(track);
        } else {
          try {
            pc.addTrack(track, localStream);
          } catch (e) {
            console.warn('[WebRTC] replace/add track error:', e);
          }
        }
      });
    });
  }, [localStream]);

  // Initiate peer connections to other participants (deterministic polite peer logic)
  useEffect(() => {
    if (!socket || !selfParticipantId || !localStream) return;

    participants.forEach(async (participant) => {
      if (participant.id === selfParticipantId) return;

      const existingPc = pcMapRef.current.get(participant.id);
      const isDead = existingPc && (existingPc.connectionState === 'closed' || existingPc.connectionState === 'failed');
      if (isDead) {
        try { existingPc.close(); } catch {}
        pcMapRef.current.delete(participant.id);
      }

      // Deterministic initiator: smaller ID initiates offer to avoid race conditions
      const shouldInitiate = selfParticipantId < participant.id;

      if (shouldInitiate && !pcMapRef.current.has(participant.id)) {
        const pc = getOrCreatePeerConnection(participant.id);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const signal: WebRTCSignalData = {
            senderId: selfParticipantId,
            targetId: participant.id,
            type: 'offer',
            payload: offer,
          };
          socket.emit(SocketEvents.WEBRTC_SIGNAL, signal);
        } catch (err) {
          console.error('[WebRTC] Error initiating offer:', err);
        }
      }
    });

    // Clean up connections for participants that left
    const currentParticipantIds = new Set(participants.map((p) => p.id));
    pcMapRef.current.forEach((pc, id) => {
      if (!currentParticipantIds.has(id)) {
        pc.close();
        pcMapRef.current.delete(id);
        pendingCandidatesRef.current.delete(id);
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setPeerConnections((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    });
  }, [participants, selfParticipantId, localStream, socket, getOrCreatePeerConnection]);

  // Handle incoming signaling messages from Socket.IO
  useEffect(() => {
    if (!socket || !selfParticipantId) return;

    const handleSignal = async (signal: WebRTCSignalData) => {
      if (signal.targetId !== selfParticipantId) return;
      const remotePeerId = signal.senderId;
      const pc = getOrCreatePeerConnection(remotePeerId);

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));

          // Drain queued candidates
          const queued = pendingCandidatesRef.current.get(remotePeerId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current.delete(remotePeerId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          const returnSignal: WebRTCSignalData = {
            senderId: selfParticipantId,
            targetId: remotePeerId,
            type: 'answer',
            payload: answer,
          };
          socket.emit(SocketEvents.WEBRTC_SIGNAL, returnSignal);
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));

          // Drain queued candidates
          const queued = pendingCandidatesRef.current.get(remotePeerId) || [];
          for (const cand of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          pendingCandidatesRef.current.delete(remotePeerId);
        } else if (signal.type === 'ice-candidate') {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
          } else {
            // Queue until remote description is set
            const queued = pendingCandidatesRef.current.get(remotePeerId) || [];
            queued.push(signal.payload);
            pendingCandidatesRef.current.set(remotePeerId, queued);
          }
        }
      } catch (err) {
        console.error('[WebRTC] Signaling error handling payload:', err);
      }
    };

    socket.on(SocketEvents.WEBRTC_SIGNAL, handleSignal);

    return () => {
      socket.off(SocketEvents.WEBRTC_SIGNAL, handleSignal);
    };
  }, [socket, selfParticipantId, getOrCreatePeerConnection]);

  return {
    remoteStreams,
    peerConnections,
  };
}
