import type { ViaLinkConfig, DeepLinkData, BannerOptions, DeferredMatchResult } from './types';
import { NetworkClient } from './NetworkClient';
import { EventTracker } from './EventTracker';
import { BannerManager } from './BannerManager';

/// fp 파라미터 localStorage 키
const FP_STORAGE_KEY = 'vialink_pending_fp';

/**
 * ViaLink Web SDK
 *
 * 웹 페이지에서 딥링크 파라미터 추출, 이벤트 추적, 스마트 앱 배너를 제공합니다.
 *
 * ```typescript
 * // 초기화
 * ViaLinkWebSDK.init({ apiKey: 'YOUR_API_KEY' });
 *
 * // 딥링크 파라미터 추출
 * const data = ViaLinkWebSDK.getDeepLinkData();
 *
 * // 이벤트 추적
 * ViaLinkWebSDK.track('page_view', { page: '/landing' });
 *
 * // 스마트 앱 배너
 * ViaLinkWebSDK.showBanner({ title: '앱에서 보기', iosStoreUrl: '...' });
 * ```
 */
export class ViaLinkWebSDK {
  /// ViaLink API 서버 주소 (빌드 시 고정, 외부 변경 불가)
  private static readonly API_BASE_URL = 'https://vialink.app';

  private static instance: ViaLinkWebSDK | null = null;

  private client: NetworkClient;
  private tracker: EventTracker;
  private banner: BannerManager;
  private config: ViaLinkConfig;
  /// 메모리 내 fp 파라미터 (URL에서 추출 후 디퍼드 매칭까지 유지)
  private pendingFp: string | null = null;

  private constructor(config: ViaLinkConfig) {
    this.config = config;
    this.client = new NetworkClient(ViaLinkWebSDK.API_BASE_URL, config.apiKey);
    this.tracker = new EventTracker(this.client);
    this.banner = new BannerManager();
  }

  /// SDK 초기화
  static init(config: ViaLinkConfig): ViaLinkWebSDK {
    if (ViaLinkWebSDK.instance) return ViaLinkWebSDK.instance;

    const sdk = new ViaLinkWebSDK(config);

    // 배치 전송 타이머 시작 (30초)
    sdk.tracker.startBatchTimer(30_000);

    // 페이지 이탈 시 sendBeacon으로 전송
    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          sdk.tracker.flushBeacon();
        }
      });
      window.addEventListener('pagehide', () => {
        sdk.tracker.flushBeacon();
      });
    }

    // URL에서 fp 파라미터 추출 → 저장 (디퍼드 딥링킹용)
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const fp = params.get('fp');
        if (fp) {
          sdk.pendingFp = fp;
          sdk.saveFp(fp);
        }
      } catch {
        // URL 파싱 실패 시 무시
      }
    }

    // 클릭 ID 추적 (URL에서 vialink 파라미터 확인)
    const deepLinkData = sdk.getDeepLinkData();
    if (deepLinkData) {
      sdk.track('web.deeplink', {
        short_code: deepLinkData.shortCode ?? '',
        path: deepLinkData.path,
      });
    }

    sdk.track('web.pageview', {
      url: typeof window !== 'undefined' ? window.location.href : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });

    ViaLinkWebSDK.instance = sdk;
    return sdk;
  }

  /// 현재 URL에서 딥링크 파라미터 추출
  getDeepLinkData(): DeepLinkData | null {
    return ViaLinkWebSDK.parseDeepLinkFromURL(
      typeof window !== 'undefined' ? window.location.href : '',
    );
  }

  /// URL에서 딥링크 파라미터 추출 (정적 메서드)
  static parseDeepLinkFromURL(url: string): DeepLinkData | null {
    try {
      const parsed = new URL(url);
      const params = parsed.searchParams;

      // /{slug}/{shortCode} 경로 패턴
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        return {
          path: '/',
          params: Object.fromEntries(params.entries()),
          shortCode: segments[segments.length - 1],
        };
      }

      // ?vialink_code= 쿼리 파라미터 패턴
      const code = params.get('vialink_code');
      const path = params.get('vialink_path');
      if (code || path) {
        const extractedParams: Record<string, string> = {};
        for (const [key, value] of params.entries()) {
          if (key.startsWith('vialink_') && key !== 'vialink_code' && key !== 'vialink_path') {
            extractedParams[key.replace('vialink_', '')] = value;
          }
        }
        return {
          path: path ?? '/',
          params: extractedParams,
          shortCode: code ?? undefined,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /// 커스텀 이벤트 추적
  track(eventName: string, data?: Record<string, unknown>): void {
    this.tracker.track(eventName, data);
  }

  /// 이벤트 즉시 전송
  async flush(): Promise<void> {
    await this.tracker.flush();
  }

  /// short code로 서버에서 딥링크 데이터 조회
  /// POST /v1/resolve — URL 또는 short code를 전달하면 딥링크 데이터 반환
  async resolveLink(urlOrCode: string): Promise<DeepLinkData | null> {
    try {
      const isUrl = urlOrCode.startsWith('http');
      const body = isUrl
        ? { url: urlOrCode }
        : { short_code: urlOrCode };

      const response = await this.client.post('/v1/resolve', body);
      const json = JSON.parse(response) as {
        matched?: boolean;
        deeplink_path?: string;
        deeplink_data?: Record<string, string>;
        short_code?: string;
      };

      if (!json.matched) return null;

      return {
        path: json.deeplink_path ?? '/',
        params: json.deeplink_data ?? {},
        shortCode: json.short_code,
      };
    } catch {
      return null;
    }
  }

  /// 앱 내에서 딥링크 생성
  async createLink(
    path: string,
    data?: Record<string, unknown>,
    campaign?: string,
  ): Promise<string> {
    return this.client.createLink(path, data, campaign);
  }

  /// 스마트 앱 배너 표시
  showBanner(options: BannerOptions): void {
    this.banner.show(options);
  }

  /// 스마트 앱 배너 숨기기
  hideBanner(): void {
    this.banner.hide();
  }

  /// 현재 플랫폼 감지
  static get platform() {
    return BannerManager.detectPlatform();
  }

  /// 디퍼드 딥링크 매칭 (POST /v1/open)
  /// 앱 첫 실행 시 서버에서 매칭을 시도합니다.
  /// fp 파라미터가 있으면 100% 정확한 직접 매칭, 없으면 핑거프린트 기반 매칭.
  async deferredMatch(): Promise<DeepLinkData | null> {
    try {
      // 저장된 fp 파라미터가 있으면 함께 전달
      const fp = this.pendingFp ?? this.loadFp();

      const body: Record<string, unknown> = {
        device_info: {
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          language: typeof navigator !== 'undefined' ? navigator.language : '',
          platform: typeof navigator !== 'undefined' ? navigator.platform : '',
          screen_width: typeof screen !== 'undefined' ? screen.width : 0,
          screen_height: typeof screen !== 'undefined' ? screen.height : 0,
        },
        is_first_launch: true,
      };
      if (fp) body['fp'] = fp;

      const response = await this.client.post('/v1/open', body);
      const json = JSON.parse(response) as DeferredMatchResult;

      if (!json.matched) return null;
      if (!json.deeplink_path) return null;

      return {
        path: json.deeplink_path,
        params: json.deeplink_data ?? {},
        shortCode: json.link_click_id || undefined,
      };
    } catch {
      return null;
    }
  }

  /// fp 파라미터를 localStorage에 저장
  private saveFp(fp: string): void {
    try {
      localStorage.setItem(FP_STORAGE_KEY, fp);
    } catch {
      // localStorage 사용 불가 시 무시
    }
  }

  /// 저장된 fp 파라미터를 로드 후 삭제 (1회성 소비)
  private loadFp(): string | null {
    try {
      const fp = localStorage.getItem(FP_STORAGE_KEY);
      if (fp) localStorage.removeItem(FP_STORAGE_KEY);
      return fp;
    } catch {
      return null;
    }
  }

  /// SDK 정리
  destroy(): void {
    this.tracker.stopBatchTimer();
    this.tracker.flushBeacon();
    this.banner.hide();
    ViaLinkWebSDK.instance = null;
  }
}
