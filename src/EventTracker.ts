import type { EventPayload } from './types';
import type { NetworkClient } from './NetworkClient';

const STORAGE_KEY = 'vialink_pending_events';

/// 이벤트 큐 + 배치 전송 (sendBeacon + localStorage 영속화)
export class EventTracker {
  private readonly client: NetworkClient;
  private queue: EventPayload[] = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private readonly maxQueueSize = 100;

  constructor(client: NetworkClient) {
    this.client = client;
    this.restorePendingEvents();
  }

  /// 이벤트 추가
  track(eventName: string, data?: Record<string, unknown>): void {
    this.queue.push({
      eventName,
      eventData: data,
      timestamp: Date.now(),
    });

    if (this.queue.length >= this.maxQueueSize) {
      void this.flush();
    }
  }

  /// 배치 전송 타이머 시작
  startBatchTimer(intervalMs: number = 30_000): void {
    this.stopBatchTimer();
    this.timerId = setInterval(() => void this.flush(), intervalMs);
  }

  /// 배치 전송 타이머 중지
  stopBatchTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /// 큐 전송
  async flush(): Promise<void> {
    const events = [...this.queue];
    this.queue = [];
    if (events.length === 0) return;

    try {
      if (events.length === 1) {
        const e = events[0]!;
        await this.client.post('/v1/events', {
          link_id: e.linkId ?? 0,
          event_name: e.eventName,
          event_data: e.eventData ?? {},
        });
      } else {
        await this.client.post('/v1/events/batch', {
          events: events.map((e) => ({
            link_id: e.linkId ?? 0,
            event_name: e.eventName,
          })),
        });
      }
      this.clearStorage();
    } catch {
      // 실패 시 큐에 복원 + localStorage 저장
      this.queue.unshift(...events);
      this.savePendingEvents();
    }
  }

  /// sendBeacon으로 즉시 전송 (페이지 이탈 시)
  flushBeacon(): void {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    const body =
      events.length === 1
        ? {
            link_id: events[0]!.linkId ?? 0,
            event_name: events[0]!.eventName,
            event_data: events[0]!.eventData ?? {},
          }
        : { events: events.map((e) => ({ link_id: e.linkId ?? 0, event_name: e.eventName })) };

    const path = events.length === 1 ? '/v1/events' : '/v1/events/batch';
    const sent = this.client.sendBeacon(path, body);

    if (!sent) {
      // sendBeacon 실패 시 큐에 복원 + 저장
      this.queue.unshift(...events);
      this.savePendingEvents();
    }
  }

  private savePendingEvents(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // localStorage 사용 불가 시 무시
    }
  }

  private restorePendingEvents(): void {
    try {
      const json = localStorage.getItem(STORAGE_KEY);
      if (json) {
        this.queue = JSON.parse(json) as EventPayload[];
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // 무시
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // 무시
    }
  }
}
