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
  /// 어트리뷰션용 numeric link id (서버 /v1/open, /v1/resolve 응답의 link_id)
  /// SDK가 보관해 후속 결제 시도 등에 자동 첨부한다.
  linkId?: number;
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

/// 디퍼드 딥링크 매칭 결과 (POST /v1/open 응답 raw 페이로드)
export interface DeferredMatchResult {
  matched: boolean;
  deeplink_path?: string;
  deeplink_data?: Record<string, string>;
  link_click_id?: string;
  /// 서버가 내려주는 numeric link_id — 어트리뷰션 fallback용
  link_id?: number | null;
  short_code?: string;
}

/**
 * 디퍼드 매칭 실패 정보 (SDK 3.0+)
 *
 * `deferredMatch()` Promise 결과의 `error` 필드 또는 `onDeferredDeepLink()` 콜백의 두 번째 인자.
 * `data == null && error == null`이면 매칭 결과가 "없음"(organic install)이다.
 *
 * - `code`:
 *   - `'timeout'`: 5초 데드라인 만료
 *   - `'network'`: fetch 실패 (3회 재시도 모두 실패)
 *   - `'server_error'`: HTTP 5xx (3회 재시도 모두 실패)
 *   - `'invalid_response'`: 응답 JSON 파싱 실패
 *   - `'unknown'`: 그 외 모든 예외
 * - `retryable`이 true면 다음 페이지 로드 시 사용자가 다시 시도해도 무방.
 *   (단, Web SDK는 mobile과 달리 자동 재시도하지 않음 — 사용자가 명시적으로 다시 호출해야 한다.)
 */
export interface DeferredError {
  code: 'timeout' | 'network' | 'server_error' | 'invalid_response' | 'unknown';
  message: string;
  httpStatus?: number;
  retryable: boolean;
}

/// `deferredMatch()`의 반환 타입 (SDK 3.0+: `{data, error}` 형태로 확장).
/// `data == null && error == null`이면 organic install (서버가 명시적으로 매칭 없음 응답).
export interface DeferredMatchOutcome {
  data: DeepLinkData | null;
  error: DeferredError | null;
}

/// 플랫폼 타입
export type Platform = 'ios' | 'android' | 'desktop';

/// 결제 시도(initiated) 호출 인자
/// - orderId: 가맹점 주문 ID (1~100자, 영문/숫자/하이픈/언더스코어)
/// - amount: 결제 금액 (0보다 큰 숫자)
/// - currency: ISO 4217 통화 코드 (KRW, USD 등)
/// - linkId: (옵션) 클릭으로 연결된 link ID
/// - paymentMethod: (옵션) 결제 수단 식별자 (예: "card")
/// - metadata: (옵션) 추가 메타데이터
export interface PaymentInitiatedArgs {
  orderId: string;
  amount: number;
  currency: string;
  linkId?: number;
  paymentMethod?: string;
  metadata?: Record<string, unknown>;
}

/// 결제 시도(initiated) 응답
/// - success: 서버 처리 성공 여부
/// - paymentEventId: 서버에서 발급한 결제 이벤트 ID
export interface PaymentInitiatedResult {
  success: boolean;
  paymentEventId: string;
}

/// `createLink()`의 5번째 인자 — 폴백 URL, OG 메타태그, 채널/태그 등 부가 옵션.
/// 모두 선택. 서버 `/api/links`가 받는 모든 옵션 필드를 그대로 노출한다.
export interface CreateLinkExtraOptions {
  /// iOS App Store 폴백 URL
  iosUrl?: string;
  /// Android Play Store 폴백 URL
  androidUrl?: string;
  /// 웹 폴백 URL
  webUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
  /// 유입 채널 (`email`, `sms`, `social` 등)
  channel?: string;
  /// 기능 태그 (`product_share` 등)
  feature?: string;
  tags?: string[];
  /// 만료일 (ISO 8601, 예: `'2026-12-31T23:59:59Z'`)
  expiresAt?: string;
}
