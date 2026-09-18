import { describe, it, expect } from 'vitest';
import {
  calculateClockSample,
  aggregateClockSamples,
  generateRoomId,
  ClockSample,
} from '../src/sync-utils.js';
import { calculateParticipantSlots, PHOTO_LAYOUTS } from '../src/layouts.js';
import { ENVIRONMENT_PRESETS, getEnvironmentById } from '../src/environments.js';

describe('sync-utils', () => {
  it('correctly calculates offset and RTT in symmetric network', () => {
    // Client sends at 1000, Server receives at 2050 (50ms network delay, server is +1000 ahead)
    // Server replies at 2050, Client receives at 1100 (50ms return delay)
    // Client send: 1000, Client recv: 1100 => Total RTT = 100ms
    // Offset should be: 2050 + (100 / 2) - 1100 = 2050 + 50 - 1100 = 1000ms
    const sample = calculateClockSample(1000, 2050, 2050, 1100);
    expect(sample.rtt).toBe(100);
    expect(sample.offset).toBe(1000);
  });

  it('filters out jitter outliers in aggregateClockSamples', () => {
    const samples: ClockSample[] = [
      { offset: 500, rtt: 30, timestamp: 1 },
      { offset: 502, rtt: 32, timestamp: 2 },
      { offset: 498, rtt: 28, timestamp: 3 },
      { offset: 850, rtt: 250, timestamp: 4 }, // high jitter outlier
    ];

    const result = aggregateClockSamples(samples);
    expect(result.offset).toBeGreaterThanOrEqual(498);
    expect(result.offset).toBeLessThanOrEqual(502);
    expect(result.roundTripTime).toBeLessThan(50);
  });

  it('generates valid room IDs without confusing characters', () => {
    const roomId = generateRoomId(6);
    expect(roomId).toHaveLength(6);
    expect(roomId).toMatch(/^[A-HJ-NP-Z2-9]{6}$/); // No 0, O, 1, I
  });
});

describe('layouts', () => {
  it('calculates 2 slots for duo-classic layout', () => {
    const slots = calculateParticipantSlots('duo-classic', 2);
    expect(slots).toHaveLength(2);
    expect(slots[0].x).toBeLessThan(slots[1].x);
    expect(slots[0].width).toBeCloseTo(0.48, 2);
    expect(slots[1].width).toBeCloseTo(0.48, 2);
  });

  it('handles multi-grid dynamically for 4 participants', () => {
    const slots = calculateParticipantSlots('multi-grid', 4);
    expect(slots).toHaveLength(4);
  });
});

describe('environments', () => {
  it('contains real and virtual presets', () => {
    expect(ENVIRONMENT_PRESETS.length).toBeGreaterThanOrEqual(6);
    const realPreset = getEnvironmentById('real-default');
    expect(realPreset.type).toBe('real');
    const studioPreset = getEnvironmentById('virtual-studio');
    expect(studioPreset.type).toBe('virtual');
  });
});
