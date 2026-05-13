import type {
  ViaLinkConfig,
  DeepLinkData,
  BannerOptions,
  DeferredError,
  DeferredMatchOutcome,
  DeferredMatchResult,
  PaymentInitiatedArgs,
  PaymentInitiatedResult,
} from './types';
import { NetworkClient } from './NetworkClient';
import { EventTracker } from './EventTracker';
import { BannerManager } from './BannerManager';

/// 주문 ID 형식 검증 정규식 (1~100자, 영문/숫자/하이픈/언더스코어)
const ORDER_ID_REGEX = /^[A-Za-z0-9_\-]{1,100}$/;

/// SDK 버전 (package.json과 동기화)
const SDK_VERSION = '3.0.0';

/// 디퍼드 딥링크 콜백 데드라인 (5초)
/// 데드라인 안에 매칭 결과가 결정되지 않으면 콜백/Promise는 `error.code === 'timeout'`으로 1회 호출되고,
/// 진행 중인 fetch 요청은 취소하지 않고 그대로 두어 attribution(link_id) 저장만 활용한다.
const DEFERRED_DEADLINE_MS = 5_000;

/// fp 파라미터 localStorage 키
const FP_STORAGE_KEY = 'vialink_pending_fp';

/// 기기 고유 식별자 localStorage 키
const DEVICE_ID_KEY = 'vialink_device_id';

/// 어트리뷰션 link_id localStorage 키 — 결제 시도 시 자동 첨부용 fallback
const ATTRIBUTED_LINK_ID_KEY = 'vialink_attributed_link_id';

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
    this.tracker = new EventTracker(this.client, () => this.collectDeviceInfo());
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

    // SDK 버전 체크 (비동기, 실패해도 무시)
    sdk.checkForUpdate().catch(() => {});

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
        link_id?: number | null;
      };

      if (!json.matched) return null;

      const linkId = typeof json.link_id === 'number' && json.link_id > 0 ? json.link_id : undefined;
      // 어트리뷰션용 link_id 저장 (다음 결제 시도에서 자동 첨부)
      if (linkId != null) this.saveAttributedLinkId(linkId);

      return {
        path: json.deeplink_path ?? '/',
        params: json.deeplink_data ?? {},
        shortCode: json.short_code,
        linkId,
      };
    } catch {
      return null;
    }
  }

  /**
   * 딥링크 생성
   *
   * @param path 딥링크 경로 (예: '/product/123')
   * @param data 딥링크에 포함할 추가 데이터 (선택)
   * @param campaign 캠페인 이름 (선택)
   * @param linkType 링크 유형
   *   - 'static' (기본값): 생성 시점의 설정으로 고정되는 정적 링크 (설정 변경 영향 없음)
   *   - 'dynamic': 클릭 시점에 최신 링크 설정을 반영하는 동적 링크
   * @param options 폴백 URL, OG 메타태그, 채널/태그 등 부가 옵션 (선택). [CreateLinkExtraOptions] 참고.
   */
  async createLink(
    path: string,
    data?: Record<string, unknown>,
    campaign?: string,
    linkType: 'dynamic' | 'static' = 'static',
    options?: import('./types').CreateLinkExtraOptions,
  ): Promise<string> {
    return this.client.createLink(path, data, campaign, linkType, options);
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

  /**
   * 결제 namespace
   *
   * 결제 시도/결과를 ViaLink 서버에 기록합니다.
   * `succeeded`/`failed`는 서버-투-서버(S2S) 엔드포인트라 클라이언트 SDK에서는 노출하지 않습니다.
   *
   * ```typescript
   * ViaLinkWebSDK.init({ apiKey: 'tk_xxx' });
   *
   * const result = await ViaLinkWebSDK.payment.initiated({
   *   orderId: 'ORD-2026-0001',
   *   amount: 19900,
   *   currency: 'KRW',
   *   paymentMethod: 'card',
   * });
   * // result = { success: true, paymentEventId: '123' }
   * ```
   */
  static payment = {
    /// 결제 시도 기록 (POST /v1/payments/initiated)
    /// 결제창을 띄우기 직전에 호출합니다. 즉시 전송(배치 X).
    initiated: (args: PaymentInitiatedArgs): Promise<PaymentInitiatedResult> => {
      const sdk = ViaLinkWebSDK.instance;
      if (!sdk) {
        throw new Error(
          'ViaLinkWebSDK is not initialized. Call ViaLinkWebSDK.init() first.',
        );
      }
      return sdk._paymentInitiated(args);
    },
  };

  /// 결제 시도 내부 구현
  /// 입력값 검증 후 device_info와 함께 서버로 즉시 POST 전송합니다.
  private async _paymentInitiated(
    args: PaymentInitiatedArgs,
  ): Promise<PaymentInitiatedResult> {
    // 1) 입력값 검증
    if (typeof args.orderId !== 'string' || !ORDER_ID_REGEX.test(args.orderId)) {
      throw new Error(
        'order_id 형식이 올바르지 않습니다 (1~100자, 영문/숫자/하이픈/언더스코어).',
      );
    }
    if (
      typeof args.amount !== 'number' ||
      !Number.isFinite(args.amount) ||
      args.amount <= 0
    ) {
      throw new Error('amount는 0보다 큰 숫자여야 합니다.');
    }
    if (typeof args.currency !== 'string' || args.currency.trim() === '') {
      throw new Error('currency가 필요합니다.');
    }

    // 2) 디바이스 정보 수집
    const deviceInfo = this.collectDeviceInfo();

    // 3) 서버 요청 본문 구성 (snake_case)
    // args.linkId가 비어 있으면 deferredMatch/resolveLink로 저장된 attribution link_id를 자동 첨부
    const effectiveLinkId = args.linkId ?? this.loadAttributedLinkId() ?? undefined;
    const body: Record<string, unknown> = {
      order_id: args.orderId,
      amount: args.amount,
      currency: args.currency.trim().toUpperCase(),
      device_info: deviceInfo,
    };
    if (effectiveLinkId != null) body['link_id'] = effectiveLinkId;
    if (args.paymentMethod) body['payment_method'] = args.paymentMethod;
    if (args.metadata) body['metadata'] = args.metadata;

    // 4) /v1/payments/initiated 즉시 전송 (배치 큐 사용 X)
    const responseText = await this.client.post('/v1/payments/initiated', body);
    const json = JSON.parse(responseText) as {
      success?: boolean;
      payment_event_id?: string | number;
    };

    return {
      success: !!json.success,
      paymentEventId: String(json.payment_event_id ?? ''),
    };
  }

  /// 디퍼드 딥링크 매칭 (POST /v1/open) — SDK 3.0+: `{data, error}` 형태로 결과 반환.
  /// 앱 첫 실행 시 서버에서 매칭을 시도합니다.
  /// fp 파라미터가 있으면 100% 정확한 직접 매칭, 없으면 핑거프린트 기반 매칭.
  ///
  /// 데드라인은 적용하지 않습니다 (Promise 사용자가 직접 `Promise.race` 또는 `AbortController` 등으로 제어 가능).
  /// 5초 데드라인 + 멱등성이 필요하면 `onDeferredDeepLink()` 콜백 등록 API를 사용하세요.
  ///
  /// 반환값 분기:
  /// - `{data: DeepLinkData, error: null}`  : 매칭 성공
  /// - `{data: null, error: null}`          : organic install (서버 명시적 매칭 없음)
  /// - `{data: null, error: DeferredError}` : 매칭 실패 (network/server_error/invalid_response 등)
  async deferredMatch(): Promise<DeferredMatchOutcome> {
    try {
      // 저장된 fp 파라미터가 있으면 함께 전달
      const fp = this.pendingFp ?? this.loadFp();

      const body: Record<string, unknown> = {
        device_info: this.collectDeviceInfo(),
        is_first_launch: true,
      };
      if (fp) body['fp'] = fp;

      const response = await this.client.post('/v1/open', body);

      let json: DeferredMatchResult;
      try {
        json = JSON.parse(response) as DeferredMatchResult;
      } catch (e) {
        return {
          data: null,
          error: {
            code: 'invalid_response',
            message: e instanceof Error ? e.message : '응답 JSON 파싱 실패',
            retryable: false,
          },
        };
      }

      if (!json.matched) return { data: null, error: null };
      if (!json.deeplink_path) return { data: null, error: null };

      const linkId =
        typeof json.link_id === 'number' && json.link_id > 0 ? json.link_id : undefined;
      // 어트리뷰션용 link_id 저장 (다음 결제 시도에서 자동 첨부)
      if (linkId != null) this.saveAttributedLinkId(linkId);

      return {
        data: {
          path: json.deeplink_path,
          params: json.deeplink_data ?? {},
          shortCode: json.link_click_id || undefined,
          linkId,
        },
        error: null,
      };
    } catch (e) {
      // NetworkClient는 비-2xx와 fetch 실패를 모두 Error로 throw — message 패턴으로 5xx와 network 구분.
      const message = e instanceof Error ? e.message : String(e);
      const httpMatch = /^HTTP (\d+):/.exec(message);
      let httpStatus: number | undefined;
      let code: DeferredError['code'] = 'network';
      if (httpMatch) {
        httpStatus = Number(httpMatch[1]);
        if (httpStatus >= 500 && httpStatus <= 599) code = 'server_error';
      }
      return {
        data: null,
        error: { code, message, httpStatus, retryable: true },
      };
    }
  }

  /// 디퍼드 딥링크 콜백 등록 (SDK 3.0+: 5초 데드라인 + 멱등성 보장).
  ///
  /// `deferredMatch()`를 내부적으로 호출하고, 5초 안에 결과가 결정되지 않으면
  /// `error.code === 'timeout'`으로 콜백을 호출합니다. 콜백은 총 1회만 호출됩니다.
  ///
  /// ```typescript
  /// ViaLinkWebSDK.shared.onDeferredDeepLink((data, error) => {
  ///   if (error) {
  ///     // 매칭 실패 (timeout/network/server_error 등) — 일반 진입
  ///     return;
  ///   }
  ///   if (!data) {
  ///     // organic install — 일반 진입
  ///     return;
  ///   }
  ///   window.location.href = data.path;
  /// });
  /// ```
  ///
  /// Promise/async 패턴을 선호하면 `deferredMatch()`를 직접 사용하세요. 두 API는 모두 정식 제공됩니다.
  onDeferredDeepLink(
    callback: (data: DeepLinkData | null, error: DeferredError | null) => void,
  ): void {
    let invoked = false;
    const invokeOnce = (data: DeepLinkData | null, error: DeferredError | null): void => {
      if (invoked) return;
      invoked = true;
      callback(data, error);
    };

    // 매칭 (백그라운드 — 데드라인과 독립적으로 끝까지 진행, 늦게 도착해도 attribution은 보존됨)
    void this.deferredMatch().then(({ data, error }) => {
      invokeOnce(data, error);
    });

    // 데드라인 — 5초 후 timeout 콜백 (매칭이 안에 끝나면 멱등성으로 차단)
    setTimeout(() => {
      invokeOnce(null, {
        code: 'timeout',
        message: `디퍼드 매칭이 ${DEFERRED_DEADLINE_MS / 1000}초 안에 완료되지 않았습니다.`,
        retryable: true,
      });
    }, DEFERRED_DEADLINE_MS);
  }

  /// 어트리뷰션 link_id를 localStorage에 저장
  private saveAttributedLinkId(linkId: number): void {
    try {
      localStorage.setItem(ATTRIBUTED_LINK_ID_KEY, String(linkId));
    } catch {
      // localStorage 사용 불가 시 무시
    }
  }

  /// 저장된 어트리뷰션 link_id 조회 (없거나 0이면 null)
  private loadAttributedLinkId(): number | null {
    try {
      const v = localStorage.getItem(ATTRIBUTED_LINK_ID_KEY);
      if (!v) return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
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

  /// 디바이스 정보 수집 (deferredMatch, EventTracker 등에서 공통 사용)
  private collectDeviceInfo(): Record<string, unknown> {
    return {
      os: this.detectOS(),
      os_version: this.detectOSVersion(),
      user_agent: navigator?.userAgent ?? '',
      language: navigator?.language ?? '',
      platform: navigator?.platform ?? '',
      screen_width: screen?.width ?? 0,
      screen_height: screen?.height ?? 0,
      screen_scale: window?.devicePixelRatio ?? 1,
      timezone: Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone ?? '',
      referrer: document?.referrer ?? '',
      page_url: window?.location?.href ?? '',
      sdk_version: SDK_VERSION,
      sdk_type: 'web',
      sdk_wrapper: null,
      device_id: this.getOrCreateDeviceId(),
    };
  }

  /// localStorage 기반 기기 고유 식별자 (첫 방문 시 UUID 생성, 이후 재사용)
  private getOrCreateDeviceId(): string | null {
    try {
      let id = localStorage.getItem(DEVICE_ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
      }
      return id;
    } catch {
      return null;
    }
  }

  /// User-Agent에서 OS 감지
  private detectOS(): string {
    const ua = navigator?.userAgent ?? '';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'unknown';
  }

  /// User-Agent에서 OS 버전 파싱
  private detectOSVersion(): string {
    const ua = navigator?.userAgent ?? '';

    // iOS: "CPU iPhone OS 17_4_1 like Mac OS X" → "17.4.1"
    const iosMatch = ua.match(/OS (\d+[_.\d]*)/);
    if (iosMatch && /iPhone|iPad|iPod/.test(ua)) {
      return iosMatch[1]!.replace(/_/g, '.');
    }

    // Android: "Android 14" → "14"
    const androidMatch = ua.match(/Android (\d+[.\d]*)/);
    if (androidMatch) return androidMatch[1]!;

    // macOS: "Mac OS X 10_15_7" → "10.15.7" 또는 "Mac OS X 15_4" → "15.4"
    const macMatch = ua.match(/Mac OS X (\d+[_.\d]*)/);
    if (macMatch) return macMatch[1]!.replace(/_/g, '.');

    // Windows: "Windows NT 10.0" → "10.0"
    const winMatch = ua.match(/Windows NT (\d+[.\d]*)/);
    if (winMatch) return winMatch[1]!;

    return '';
  }

  /// 서버에서 최신 버전 확인 (초기화 시 비동기 호출, 실패해도 SDK 동작에 영향 없음)
  private async checkForUpdate(): Promise<void> {
    const res = await fetch(
      `${ViaLinkWebSDK.API_BASE_URL}/api/sdk/versions?platform=web&version=${SDK_VERSION}`,
    );
    if (!res.ok) return;
    const json = (await res.json()) as { update_available?: boolean; latest?: string };
    if (json.update_available && json.latest) {
      const current = SDK_VERSION;
      const latest = json.latest;
      const pad = Math.max(0, 40 - current.length - latest.length);
      console.warn(
        '\n' +
          '╔══════════════════════════════════════════════════════════╗\n' +
          '║                                                          ║\n' +
          '║   ViaLink SDK 업데이트 available!                          ║\n' +
          `║   현재: ${current}  →  최신: ${latest}` +
          ' '.repeat(pad) +
          '║\n' +
          '║   https://docs.vialink.app                               ║\n' +
          '║                                                          ║\n' +
          '╚══════════════════════════════════════════════════════════╝\n',
      );
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
