import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventTracker } from '../src/EventTracker';
import type { NetworkClient } from '../src/NetworkClient';

describe('EventTracker', () => {
  let tracker: EventTracker;
  let mockClient: NetworkClient;

  beforeEach(() => {
    // localStorage mock
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
    });

    mockClient = {
      post: vi.fn(() => Promise.resolve('')),
      sendBeacon: vi.fn(() => true),
    } as unknown as NetworkClient;

    tracker = new EventTracker(mockClient);
  });

  it('이벤트 추가', () => {
    tracker.track('test_event');
    tracker.track('test_event2', { key: 'value' });
    // 큐에 2개 이벤트가 있어야 함 (flush하면 전송됨)
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('flush 시 단일 이벤트 전송', async () => {
    tracker.track('single_event');
    await tracker.flush();

    expect(mockClient.post).toHaveBeenCalledWith(
      '/v1/events',
      expect.objectContaining({ event_name: 'single_event' }),
    );
  });

  it('flush 시 다수 이벤트 배치 전송', async () => {
    tracker.track('event1');
    tracker.track('event2');
    tracker.track('event3');
    await tracker.flush();

    expect(mockClient.post).toHaveBeenCalledWith(
      '/v1/events/batch',
      expect.objectContaining({ events: expect.any(Array) }),
    );
  });

  it('빈 큐 flush는 전송하지 않음', async () => {
    await tracker.flush();
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('sendBeacon으로 전송', () => {
    tracker.track('beacon_event');
    tracker.flushBeacon();
    expect(mockClient.sendBeacon).toHaveBeenCalled();
  });
});
