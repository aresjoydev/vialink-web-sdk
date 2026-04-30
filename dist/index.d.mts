interface ViaLinkConfig {
    apiKey: string;
}
interface DeepLinkData {
    path: string;
    params: Record<string, string>;
    shortCode?: string;
    linkId?: number;
}
interface EventPayload {
    linkId?: number;
    eventName: string;
    eventData?: Record<string, unknown>;
    timestamp: number;
}
interface BannerOptions {
    title: string;
    description?: string;
    buttonText?: string;
    iconUrl?: string;
    iosStoreUrl?: string;
    androidStoreUrl?: string;
    deepLinkPath?: string;
    position?: 'top' | 'bottom';
    theme?: 'light' | 'dark';
}
interface DeferredMatchResult {
    matched: boolean;
    deeplink_path?: string;
    deeplink_data?: Record<string, string>;
    link_click_id?: string;
    link_id?: number | null;
    short_code?: string;
}
type Platform = 'ios' | 'android' | 'desktop';
interface PaymentInitiatedArgs {
    orderId: string;
    amount: number;
    currency: string;
    linkId?: number;
    paymentMethod?: string;
    metadata?: Record<string, unknown>;
}
interface PaymentInitiatedResult {
    success: boolean;
    paymentEventId: string;
}
interface CreateLinkExtraOptions {
    iosUrl?: string;
    androidUrl?: string;
    webUrl?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImageUrl?: string;
    channel?: string;
    feature?: string;
    tags?: string[];
    expiresAt?: string;
}

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
declare class ViaLinkWebSDK {
    private static readonly API_BASE_URL;
    private static instance;
    private client;
    private tracker;
    private banner;
    private config;
    private pendingFp;
    private constructor();
    static init(config: ViaLinkConfig): ViaLinkWebSDK;
    getDeepLinkData(): DeepLinkData | null;
    static parseDeepLinkFromURL(url: string): DeepLinkData | null;
    track(eventName: string, data?: Record<string, unknown>): void;
    flush(): Promise<void>;
    resolveLink(urlOrCode: string): Promise<DeepLinkData | null>;
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
    createLink(path: string, data?: Record<string, unknown>, campaign?: string, linkType?: 'dynamic' | 'static', options?: CreateLinkExtraOptions): Promise<string>;
    showBanner(options: BannerOptions): void;
    hideBanner(): void;
    static get platform(): Platform;
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
    static payment: {
        initiated: (args: PaymentInitiatedArgs) => Promise<PaymentInitiatedResult>;
    };
    private _paymentInitiated;
    deferredMatch(): Promise<DeepLinkData | null>;
    private saveAttributedLinkId;
    private loadAttributedLinkId;
    private saveFp;
    private loadFp;
    private collectDeviceInfo;
    private getOrCreateDeviceId;
    private detectOS;
    private detectOSVersion;
    private checkForUpdate;
    destroy(): void;
}

declare class NetworkClient {
    private readonly baseURL;
    private readonly apiKey;
    private readonly maxRetries;
    constructor(baseURL: string, apiKey: string);
    get(path: string): Promise<string>;
    post(path: string, body: Record<string, unknown>): Promise<string>;
    private formatHttpError;
    sendBeacon(path: string, body: Record<string, unknown>): boolean;
    createLink(path: string, data?: Record<string, unknown>, campaign?: string, linkType?: string, options?: {
        iosUrl?: string;
        androidUrl?: string;
        webUrl?: string;
        ogTitle?: string;
        ogDescription?: string;
        ogImageUrl?: string;
        channel?: string;
        feature?: string;
        tags?: string[];
        expiresAt?: string;
    }): Promise<string>;
    private buildHeaders;
    private executeWithRetry;
}

declare class EventTracker {
    private readonly client;
    private readonly deviceInfoFn;
    private queue;
    private timerId;
    private readonly maxQueueSize;
    constructor(client: NetworkClient, deviceInfoFn?: () => Record<string, unknown>);
    track(eventName: string, data?: Record<string, unknown>): void;
    startBatchTimer(intervalMs?: number): void;
    stopBatchTimer(): void;
    flush(): Promise<void>;
    flushBeacon(): void;
    private savePendingEvents;
    private restorePendingEvents;
    private clearStorage;
}

declare class BannerManager {
    private bannerElement;
    static detectPlatform(): Platform;
    show(options: BannerOptions): void;
    hide(): void;
    dismiss(): void;
    private isDismissed;
    private createBannerElement;
}

export { BannerManager, type BannerOptions, type CreateLinkExtraOptions, type DeepLinkData, type DeferredMatchResult, type EventPayload, EventTracker, NetworkClient, type PaymentInitiatedArgs, type PaymentInitiatedResult, type Platform, type ViaLinkConfig, ViaLinkWebSDK };
