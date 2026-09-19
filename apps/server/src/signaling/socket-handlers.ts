import { Server, Socket } from 'socket.io';
import {
  CaptureCancelPayload,
  CaptureStartPayload,
  ClockSyncPing,
  ClockSyncPong,
  EnvironmentChangePayload,
  LayoutChangePayload,
  ParticipantUpdatePayload,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomLeavePayload,
  SocketEvents,
  WebRTCSignalData,
} from '@photobooth/shared';
import { RoomManager } from '../rooms/room-manager.js';
import { CaptureScheduler } from '../sync/capture-scheduler.js';

export function setupSocketHandlers(
  io: Server,
  roomManager: RoomManager,
  captureScheduler: CaptureScheduler
) {
  // Track sockets that are already being cleaned up to prevent double-leave (BUG-5)
  const leavingSocketIds = new Set<string>();

  io.on('connection', (socket: Socket) => {
    // 1. Clock synchronization ping/pong (ultra-fast handler)
    socket.on(SocketEvents.SYNC_TIME_REQ, (data: ClockSyncPing) => {
      const serverReceiveTime = Date.now();
      const response: ClockSyncPong = {
        clientSendTime: data.clientSendTime,
        serverReceiveTime,
        serverSendTime: Date.now(),
      };
      socket.emit(SocketEvents.SYNC_TIME_RES, response);
    });

    // 2. Room creation
    socket.on(SocketEvents.ROOM_CREATE, async (data: RoomCreatePayload, callback) => {
      try {
        const { room, hostParticipant } = await roomManager.createRoom(data?.name || 'Host');
        hostParticipant.socketId = socket.id;
        roomManager.mapSocket(socket.id, room.id, hostParticipant.id);
        socket.join(room.id);

        if (typeof callback === 'function') {
          callback({ success: true, room, participant: hostParticipant });
        } else {
          socket.emit(SocketEvents.ROOM_STATE, {
            room,
            selfParticipantId: hostParticipant.id,
          });
        }
      } catch (err: any) {
        socket.emit(SocketEvents.ROOM_ERROR, {
          code: 'CREATE_FAILED',
          message: err.message || 'Failed to create room',
        });
      }
    });

    // 3. Room joining
    socket.on(SocketEvents.ROOM_JOIN, async (data: RoomJoinPayload, callback) => {
      try {
        if (!data || !data.roomId) {
          socket.emit(SocketEvents.ROOM_ERROR, { code: 'INVALID_ROOM', message: 'Room ID is required' });
          return;
        }

        const result = await roomManager.joinRoom(
          data.roomId,
          data.participantId,
          data.name,
          socket.id
        );

        if (!result) {
          if (typeof callback === 'function') {
            callback({ success: false, error: 'Room not found or expired' });
          } else {
            socket.emit(SocketEvents.ROOM_ERROR, {
              code: 'ROOM_NOT_FOUND',
              message: 'Room not found or has expired',
            });
          }
          return;
        }

        const { room, participant } = result;
        socket.join(room.id);

        // Notify caller of current room state
        if (typeof callback === 'function') {
          callback({ success: true, room, participant });
        } else {
          socket.emit(SocketEvents.ROOM_STATE, {
            room,
            selfParticipantId: participant.id,
          });
        }

        // Broadcast to other peers in room that a new participant joined
        socket.to(room.id).emit(SocketEvents.PARTICIPANT_JOINED, {
          participant,
        });
      } catch (err: any) {
        socket.emit(SocketEvents.ROOM_ERROR, {
          code: 'JOIN_FAILED',
          message: err.message || 'Failed to join room',
        });
      }
    });

    // 4. Participant update (position, ready state, camera/mic active)
    socket.on(SocketEvents.PARTICIPANT_UPDATE, async (data: ParticipantUpdatePayload) => {
      try {
        const mapping = roomManager.getSocketMapping(socket.id);
        if (!mapping || mapping.roomId !== data.roomId) return;

        const result = await roomManager.updateParticipant(
          data.roomId,
          mapping.participantId,
          data.updates
        );

        if (result) {
          io.to(data.roomId).emit(SocketEvents.PARTICIPANT_UPDATED, {
            participantId: mapping.participantId,
            updates: data.updates,
          });
        }
      } catch (err) {
        console.error('[Socket] Error updating participant:', err);
      }
    });

    // 5. Environment changed
    socket.on(SocketEvents.ENVIRONMENT_CHANGE, async (data: EnvironmentChangePayload) => {
      try {
        const mapping = roomManager.getSocketMapping(socket.id);
        if (!mapping || mapping.roomId !== data.roomId) return;

        const updatedRoom = await roomManager.setEnvironment(
          data.roomId,
          data.environmentId,
          data.environmentType
        );

        if (updatedRoom) {
          io.to(data.roomId).emit(SocketEvents.ENVIRONMENT_CHANGED, {
            environmentId: data.environmentId,
            environmentType: data.environmentType,
          });
        }
      } catch (err) {
        console.error('[Socket] Error changing environment:', err);
      }
    });

    // 6. Layout changed
    socket.on(SocketEvents.LAYOUT_CHANGE, async (data: LayoutChangePayload) => {
      try {
        const mapping = roomManager.getSocketMapping(socket.id);
        if (!mapping || mapping.roomId !== data.roomId) return;

        const updatedRoom = await roomManager.setLayout(data.roomId, data.layoutId);
        if (updatedRoom) {
          io.to(data.roomId).emit(SocketEvents.LAYOUT_CHANGED, {
            layoutId: data.layoutId,
          });
        }
      } catch (err) {
        console.error('[Socket] Error changing layout:', err);
      }
    });

    // 7. Synchronized capture initiation
    socket.on(SocketEvents.CAPTURE_START, async (data: CaptureStartPayload, callback?: (res: any) => void) => {
      try {
        let mapping = roomManager.getSocketMapping(socket.id);
        if (!mapping || mapping.roomId !== data.roomId) {
          const room = await roomManager.getRoom(data.roomId);
          if (room) {
            const participantId = room.participants[0]?.id || room.hostId || socket.id;
            roomManager.mapSocket(socket.id, data.roomId, participantId);
            mapping = { roomId: data.roomId, participantId };
            socket.join(data.roomId);
          }
        }

        if (!mapping || mapping.roomId !== data.roomId) {
          if (typeof callback === 'function') callback({ success: false, error: 'Room not mapped' });
          return;
        }

        const result = await captureScheduler.scheduleCapture(
          data.roomId,
          mapping.participantId,
          data.durationMs || 3000,
          data.totalShots || 4,
          data.shotIntervalMs || 2500
        );

        if (result) {
          io.to(data.roomId).emit(SocketEvents.CAPTURE_SCHEDULED, result.session);
          if (typeof callback === 'function') callback({ success: true, session: result.session });
        } else {
          if (typeof callback === 'function') callback({ success: false, error: 'Schedule failed' });
        }
      } catch (err) {
        console.error('[Socket] Error scheduling capture:', err);
        if (typeof callback === 'function') callback({ success: false, error: 'Internal error' });
      }
    });

    // 8. Capture cancellation
    socket.on(SocketEvents.CAPTURE_CANCEL, async (data: CaptureCancelPayload) => {
      try {
        const mapping = roomManager.getSocketMapping(socket.id);
        if (!mapping || mapping.roomId !== data.roomId) return;

        await captureScheduler.cancelCapture(data.roomId);
        io.to(data.roomId).emit(SocketEvents.CAPTURE_CANCELLED, {
          reason: 'Capture was cancelled by a participant',
        });
      } catch (err) {
        console.error('[Socket] Error cancelling capture:', err);
      }
    });

    // 9. Capture complete
    socket.on(SocketEvents.CAPTURE_COMPLETE, async (data: { roomId: string; sessionId: string }) => {
      try {
        io.to(data.roomId).emit(SocketEvents.CAPTURE_FINISHED, {
          sessionId: data.sessionId,
        });
      } catch (err) {
        console.error('[Socket] Error completing capture:', err);
      }
    });

    // 10. WebRTC Peer-to-Peer Signaling (Offer, Answer, ICE Candidate)
    socket.on(SocketEvents.WEBRTC_SIGNAL, async (data: WebRTCSignalData) => {
      try {
        const mapping = roomManager.getSocketMapping(socket.id);
        if (!mapping) return;

        const room = await roomManager.getRoom(mapping.roomId);
        if (!room) return;

        // Find target participant's socket ID
        const targetParticipant = room.participants.find((p) => p.id === data.targetId);
        if (targetParticipant && targetParticipant.socketId) {
          io.to(targetParticipant.socketId).emit(SocketEvents.WEBRTC_SIGNAL, {
            ...data,
            senderId: mapping.participantId,
          });
        }
      } catch (err) {
        console.error('[Socket] Error routing WebRTC signal:', err);
      }
    });

    // 11. Room leave
    socket.on(SocketEvents.ROOM_LEAVE, async (data: RoomLeavePayload) => {
      await handleDisconnectOrLeave(socket, data?.roomId);
    });

    // 12. Socket disconnection
    socket.on('disconnect', async () => {
      // Only clean up if not already handled by explicit ROOM_LEAVE (BUG-5)
      if (!leavingSocketIds.has(socket.id)) {
        await handleDisconnectOrLeave(socket);
      }
    });
  });

  async function handleDisconnectOrLeave(socket: Socket, explicitRoomId?: string) {
    // Guard against double-leave if both ROOM_LEAVE and 'disconnect' fire (BUG-5)
    if (leavingSocketIds.has(socket.id)) return;
    leavingSocketIds.add(socket.id);

    try {
      const mapping = roomManager.unmapSocket(socket.id);
      const roomId = explicitRoomId || mapping?.roomId;
      if (!roomId) return;

      socket.leave(roomId);

      const { room, leftParticipant, newHostId } = await roomManager.leaveRoom(
        roomId,
        mapping?.participantId || socket.id
      );

      if (leftParticipant) {
        io.to(roomId).emit(SocketEvents.PARTICIPANT_LEFT, {
          participantId: leftParticipant.id,
          newHostId,
        });
      }

      if (room && room.captureSession) {
        await captureScheduler.cancelCapture(roomId);
        io.to(roomId).emit(SocketEvents.CAPTURE_CANCELLED, {
          reason: 'Participant disconnected during session',
        });
      }
    } finally {
      leavingSocketIds.delete(socket.id);
    }
  }
}
