'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import {
  SocketEvents,
  ClockSyncPong,
  ClockSample,
  calculateClockSample,
  aggregateClockSamples,
} from '@photobooth/shared';

export function useClockSync(socket: Socket | null, isConnected: boolean) {
  const [offset, setOffset] = useState<number>(0);
  const [roundTripTime, setRoundTripTime] = useState<number>(0);
  const [isSynchronized, setIsSynchronized] = useState<boolean>(false);

  const samplesRef = useRef<ClockSample[]>([]);
  const pingTimesRef = useRef<Map<number, number>>(new Map());

  const sendPing = useCallback(() => {
    if (!socket || !socket.connected) return;
    const clientSendTime = Date.now();
    pingTimesRef.current.set(clientSendTime, clientSendTime);
    socket.emit(SocketEvents.SYNC_TIME_REQ, { clientSendTime });
  }, [socket]);

  useEffect(() => {
    if (!socket || !isConnected) {
      setIsSynchronized(false);
      return;
    }

    const handlePong = (data: ClockSyncPong) => {
      const clientRecvTime = Date.now();
      const clientSendTime = data.clientSendTime;

      if (!pingTimesRef.current.has(clientSendTime)) return;
      pingTimesRef.current.delete(clientSendTime);

      const sample = calculateClockSample(
        clientSendTime,
        data.serverReceiveTime,
        data.serverSendTime,
        clientRecvTime
      );

      // Keep up to 10 latest samples
      samplesRef.current.push(sample);
      if (samplesRef.current.length > 10) {
        samplesRef.current.shift();
      }

      const aggregated = aggregateClockSamples(samplesRef.current);
      setOffset(aggregated.offset);
      setRoundTripTime(aggregated.roundTripTime);
      setIsSynchronized(true);
    };

    socket.on(SocketEvents.SYNC_TIME_RES, handlePong);

    // Initial rapid burst of 5 pings with 200ms spacing to establish accurate baseline
    sendPing();
    const burst1 = setTimeout(sendPing, 200);
    const burst2 = setTimeout(sendPing, 400);
    const burst3 = setTimeout(sendPing, 600);
    const burst4 = setTimeout(sendPing, 800);

    // Periodic steady state ping every 20 seconds
    const interval = setInterval(sendPing, 20000);

    return () => {
      socket.off(SocketEvents.SYNC_TIME_RES, handlePong);
      clearTimeout(burst1);
      clearTimeout(burst2);
      clearTimeout(burst3);
      clearTimeout(burst4);
      clearInterval(interval);
    };
  }, [socket, isConnected, sendPing]);

  const getServerTime = useCallback(() => {
    return Date.now() + offset;
  }, [offset]);

  const toLocalTime = useCallback(
    (serverTimestamp: number) => {
      return serverTimestamp - offset;
    },
    [offset]
  );

  const toServerTime = useCallback(
    (localTimestamp: number) => {
      return localTimestamp + offset;
    },
    [offset]
  );

  return {
    offset,
    roundTripTime,
    isSynchronized,
    getServerTime,
    toLocalTime,
    toServerTime,
  };
}
