'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Participant, SocketEvents, WebRTCSignalData } from '@photobooth/shared';
import { DEFAULT_ICE_SERVERS, resolveIceServers } from '@/lib/ice-servers';

export function useWebRTC(
  socket: Socket | null,
  selfParticipantId: string | null,
  participants: Participant[],
  localStream: MediaStream | null
) {
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [peerConnections, setPeerConnections] = useState<Record<string, RTCPeerConnection>>({});

  // Dynamic ICE configuration
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS);

  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferMapRef = useRef<Map<string, boolean>>(new Map());
  const ignoreOfferMapRef = useRef<Map<string, boolean>>(new Map());

  // Keep a ref to localStream so getOrCreatePeerConnection always reads the latest stream
  const localStreamRef = useRef<MediaStream | null>(localStream);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Load configured ICE servers (STUN + TURN Relay) on startup
  useEffect(() => {
    let mounted = true;
    resolveIceServers().then((servers) => {
      if (mounted && servers.length > 0) {
        iceServersRef.current = servers;
        console.log(`[WebRTC] Initialized ${servers.length} ICE servers (STUN/TURN)`);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Helper to create and configure a peer connection using W3C Perfect Negotiation
  const getOrCreatePeerConnection = useCallback(
    (targetParticipantId: string): RTCPeerConnection => {
      let pc = pcMapRef.current.get(targetParticipantId);
      if (pc && pc.connectionState !== 'closed') {
        return pc;
      }

      console.log(`[WebRTC] Creating peer connection to ${targetParticipantId}`);
      const rtcConfig: RTCConfiguration = {
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 10,
      };

      pc = new RTCPeerConnection(rtcConfig);
      pcMapRef.current.set(targetParticipantId, pc);
      makingOfferMapRef.current.set(targetParticipantId, false);
      ignoreOfferMapRef.current.set(targetParticipantId, false);

      // Deterministic polite peer role:
      // The peer with the alphabetically smaller participant ID is polite and will roll back on collision.
      // The peer with the larger ID is impolite and takes precedence.
      const isPolite = (selfParticipantId || '') < targetParticipantId;

      // 1. ICE Candidate Handler
      pc.onicecandidate = (event) => {
        if (event.candidate && socket && selfParticipantId) {
          const signal: WebRTCSignalData = {
            senderId: selfParticipantId,
            targetId: targetParticipantId,
            type: 'ice-candidate',
            payload: event.candidate.toJSON(),
          };
          socket.emit(SocketEvents.WEBRTC_SIGNAL, signal);
        }
      };

      // 2. Incoming Track Handler
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track from ${targetParticipantId}: kind=${event.track.kind}`);
        setRemoteStreams((prev) => {
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

      // 3. Perfect Negotiation: negotiationneeded event handler
      pc.onnegotiationneeded = async () => {
        try {
          makingOfferMapRef.current.set(targetParticipantId, true);
          const offer = await pc.createOffer();

          // Guard against race condition: state might have changed during offer creation
          if (pc.signalingState !== 'stable') return;

          await pc.setLocalDescription(offer);

          if (socket && selfParticipantId) {
            const signal: WebRTCSignalData = {
              senderId: selfParticipantId,
              targetId: targetParticipantId,
              type: 'offer',
              payload: pc.localDescription,
            };
            socket.emit(SocketEvents.WEBRTC_SIGNAL, signal);
          }
        } catch (err) {
          console.error(`[WebRTC] Error in onnegotiationneeded with ${targetParticipantId}:`, err);
        } finally {
          makingOfferMapRef.current.set(targetParticipantId, false);
        }
      };

      // 4. Connection State Monitor with Non-Colliding ICE Restart
      pc.onconnectionstatechange = async () => {
        console.log(`[WebRTC] Peer ${targetParticipantId} connection state: ${pc?.connectionState}`);

        if (pc?.connectionState === 'failed') {
          console.warn(`[WebRTC] Connection with ${targetParticipantId} failed.`);
          // Only the polite peer initiates ICE restart to prevent simultaneous offer collisions
          if (isPolite && socket && selfParticipantId) {
            console.log(`[WebRTC] Polite peer initiating ICE restart for ${targetParticipantId}...`);
            try {
              if (typeof pc.restartIce === 'function') {
                pc.restartIce();
              } else {
                makingOfferMapRef.current.set(targetParticipantId, true);
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                socket.emit(SocketEvents.WEBRTC_SIGNAL, {
                  senderId: selfParticipantId,
                  targetId: targetParticipantId,
                  type: 'offer',
                  payload: pc.localDescription,
                });
              }
            } catch (err) {
              console.warn('[WebRTC] ICE restart error:', err);
            } finally {
              makingOfferMapRef.current.set(targetParticipantId, false);
            }
          }
        }
      };

      // Attach current local tracks to connection
      if (localStreamRef.current && localStreamRef.current.getTracks().length > 0) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            pc?.addTrack(track, localStreamRef.current!);
          } catch (e) {
            console.warn('[WebRTC] Error adding local track:', e);
          }
        });
      } else {
        // Prepare sendrecv transceivers so incoming SDP can negotiate media early
        try {
          if (pc.getTransceivers().length === 0) {
            pc.addTransceiver('video', { direction: 'sendrecv' });
            pc.addTransceiver('audio', { direction: 'sendrecv' });
          }
        } catch (e) {
          console.warn('[WebRTC] addTransceiver warning:', e);
        }
      }

      setPeerConnections((prev) => ({ ...prev, [targetParticipantId]: pc! }));
      return pc;
    },
    [socket, selfParticipantId]
  );

  // Update tracks when localStream changes (e.g., user enables camera, flips camera, or changes source)
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
          matching.sender.replaceTrack(track).catch((err) => {
            console.warn('[WebRTC] replaceTrack error:', err);
          });
        } else {
          try {
            pc.addTrack(track, localStream);
          } catch (e) {
            console.warn('[WebRTC] addTrack error:', e);
          }
        }
      });
    });
  }, [localStream]);

  // Maintain peer connections for all participants in the room
  useEffect(() => {
    if (!socket || !selfParticipantId) return;

    participants.forEach((participant) => {
      if (participant.id === selfParticipantId) return;

      const existingPc = pcMapRef.current.get(participant.id);
      const isDead = existingPc && (existingPc.connectionState === 'closed' || existingPc.connectionState === 'failed');

      if (isDead) {
        try {
          existingPc.close();
        } catch {}
        pcMapRef.current.delete(participant.id);
        makingOfferMapRef.current.delete(participant.id);
        ignoreOfferMapRef.current.delete(participant.id);
      }

      // Initialize peer connection if not present
      if (!pcMapRef.current.has(participant.id)) {
        getOrCreatePeerConnection(participant.id);
      }
    });

    // Clean up peer connections for participants that have left the room
    const currentParticipantIds = new Set(participants.map((p) => p.id));
    pcMapRef.current.forEach((pc, id) => {
      if (!currentParticipantIds.has(id)) {
        try {
          pc.close();
        } catch {}
        pcMapRef.current.delete(id);
        pendingCandidatesRef.current.delete(id);
        makingOfferMapRef.current.delete(id);
        ignoreOfferMapRef.current.delete(id);

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
  }, [participants, selfParticipantId, socket, getOrCreatePeerConnection]);

  // Handle incoming signaling messages from Socket.IO with W3C Perfect Negotiation
  useEffect(() => {
    if (!socket || !selfParticipantId) return;

    const handleSignal = async (signal: WebRTCSignalData) => {
      if (signal.targetId !== selfParticipantId) return;
      const remotePeerId = signal.senderId;
      const pc = getOrCreatePeerConnection(remotePeerId);

      const isPolite = selfParticipantId < remotePeerId;
      const makingOffer = makingOfferMapRef.current.get(remotePeerId) || false;

      try {
        if (signal.type === 'offer') {
          const description = signal.payload;
          const offerCollision = makingOffer || pc.signalingState !== 'stable';

          const ignoreOffer = !isPolite && offerCollision;
          ignoreOfferMapRef.current.set(remotePeerId, ignoreOffer);

          if (ignoreOffer) {
            console.warn(`[WebRTC] Impolite peer ignoring colliding offer from ${remotePeerId}`);
            return;
          }

          if (offerCollision) {
            console.log(`[WebRTC] Polite peer rolling back local offer to accept incoming offer from ${remotePeerId}`);
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(new RTCSessionDescription(description)),
            ]);
          } else {
            await pc.setRemoteDescription(new RTCSessionDescription(description));
          }

          // Drain queued candidates for this remote peer
          const queued = pendingCandidatesRef.current.get(remotePeerId) || [];
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC] addIceCandidate drain error:', e);
            }
          }
          pendingCandidatesRef.current.delete(remotePeerId);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          const returnSignal: WebRTCSignalData = {
            senderId: selfParticipantId,
            targetId: remotePeerId,
            type: 'answer',
            payload: pc.localDescription,
          };
          socket.emit(SocketEvents.WEBRTC_SIGNAL, returnSignal);
        } else if (signal.type === 'answer') {
          const description = signal.payload;
          await pc.setRemoteDescription(new RTCSessionDescription(description));

          // Drain queued candidates
          const queued = pendingCandidatesRef.current.get(remotePeerId) || [];
          for (const cand of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC] addIceCandidate drain error:', e);
            }
          }
          pendingCandidatesRef.current.delete(remotePeerId);
        } else if (signal.type === 'ice-candidate') {
          const candidateInit = signal.payload;
          const ignoreOffer = ignoreOfferMapRef.current.get(remotePeerId) || false;

          try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
            } else {
              // Queue candidate until remote description is set
              const queued = pendingCandidatesRef.current.get(remotePeerId) || [];
              queued.push(candidateInit);
              pendingCandidatesRef.current.set(remotePeerId, queued);
            }
          } catch (err) {
            if (!ignoreOffer) {
              console.warn('[WebRTC] Error adding ICE candidate:', err);
            }
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
