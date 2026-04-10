interface ViaLinkConfig {
    apiKey: string;
}
interface DeepLinkData {
    path: string;
    params: Record<string, string>;
    shortCode?: string;
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
}
type Platform = 'ios' | 'android' | 'desktop';

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
    createLink(path: string, data?: Record<string, unknown>, campaign?: string): Promise<string>;
    showBanner(options: BannerOptions): void;
    hideBanner(): void;
    static get platform(): Platform;
    deferredMatch(): Promise<DeepLinkData | null>;
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
    sendBeacon(path: string, body: Record<string, unknown>): boolean;
    createLink(path: string, data?: Record<string, unknown>, campaign?: string): Promise<string>;
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

export { BannerManager, type BannerOptions, type DeepLinkData, type DeferredMatchResult, type EventPayload, EventTracker, NetworkClient, type Platform, type ViaLinkConfig, ViaLinkWebSDK };
