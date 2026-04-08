/// ViaLink Web SDK 타입 정의

/// SDK 초기화 옵션
export interface ViaLinkConfig {
  apiKey: string;
}

/// 딥링크 데이터
export interface DeepLinkData {
  path: string;
  params: Record<string, string>;
  shortCode?: string;
}

/// 이벤트 페이로드
export interface EventPayload {
  linkId?: number;
  eventName: string;
  eventData?: Record<string, unknown>;
  timestamp: number;
}

/// 스마트 앱 배너 옵션
export interface BannerOptions {
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

/// 디퍼드 딥링크 매칭 결과 (POST /v1/open 응답)
export interface DeferredMatchResult {
  matched: boolean;
  deeplink_path?: string;
  deeplink_data?: Record<string, string>;
  link_click_id?: string;
}

/// 플랫폼 타입
export type Platform = 'ios' | 'android' | 'desktop';
