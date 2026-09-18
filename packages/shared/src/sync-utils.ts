import { ClockSyncPing, ClockSyncPong, ClockSyncResult } from './types.js';

export interface ClockSample {
  offset: number;
  rtt: number;
  timestamp: number;
}

/**
 * Calculates clock offset and RTT from a single ping-pong exchange.
 *
 * Cristian's algorithm:
 *   RTT = (clientRecv - clientSend) - (serverSend - serverRecv)
 *   Offset = serverSend + (RTT / 2) - clientRecv
 */
export function calculateClockSample(
  clientSend: number,
  serverRecv: number,
  serverSend: number,
  clientRecv: number
): ClockSample {
  const serverProcessing = Math.max(0, serverSend - serverRecv);
  const rtt = Math.max(0, clientRecv - clientSend - serverProcessing);
  const oneWayDelay = rtt / 2;
  const estimatedServerTimeAtRecv = serverSend + oneWayDelay;
  const offset = estimatedServerTimeAtRecv - clientRecv;

  return {
    offset,
    rtt,
    timestamp: clientRecv,
  };
}

/**
 * Filters a series of clock samples to compute the most accurate offset estimate.
 * Strategy: Discards samples with RTT significantly higher than the minimum RTT,
 * then computes the median/weighted mean of the remaining low-latency samples.
 */
export function aggregateClockSamples(samples: ClockSample[]): ClockSyncResult {
  if (samples.length === 0) {
    return { offset: 0, roundTripTime: 0 };
  }

  if (samples.length === 1) {
    return { offset: samples[0].offset, roundTripTime: samples[0].rtt };
  }

  // Sort by RTT ascending to find the cleanest network conditions
  const sortedByRtt = [...samples].sort((a, b) => a.rtt - b.rtt);
  const minRtt = sortedByRtt[0].rtt;

  // Keep samples within 1.5x of minRtt (or within 50ms tolerance)
  const threshold = Math.max(minRtt * 1.5, minRtt + 50);
  const bestSamples = sortedByRtt.filter((s) => s.rtt <= threshold);

  // Take median offset of best samples to resist single-packet anomalies
  const sortedOffsets = bestSamples.map((s) => s.offset).sort((a, b) => a - b);
  const medianOffset = sortedOffsets[Math.floor(sortedOffsets.length / 2)];

  const avgRtt = bestSamples.reduce((sum, s) => sum + s.rtt, 0) / bestSamples.length;

  return {
    offset: Math.round(medianOffset),
    roundTripTime: Math.round(avgRtt),
  };
}

/**
 * Generates an unpredictable, human-friendly alphanumeric room code.
 * E.g., "ABX72K", "PK94TM"
 */
export function generateRoomId(length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous I, 1, O, 0
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
