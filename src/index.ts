/// ViaLink Web SDK
///
/// 웹 페이지에서 딥링크 파라미터 추출, 이벤트 추적, 스마트 앱 배너를 제공합니다.
///
/// ```typescript
/// import { ViaLinkWebSDK } from 'vialink-web-sdk';
///
/// ViaLinkWebSDK.init({ apiKey: 'YOUR_API_KEY' });
/// ViaLinkWebSDK.track('purchase', { revenue: 29900 });
/// ```

export { ViaLinkWebSDK } from './ViaLinkWebSDK';
export { NetworkClient } from './NetworkClient';
export { EventTracker } from './EventTracker';
export { BannerManager } from './BannerManager';

export type {
  ViaLinkConfig,
  DeepLinkData,
  EventPayload,
  BannerOptions,
  DeferredMatchResult,
  Platform,
} from './types';
