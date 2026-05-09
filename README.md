# ViaLink Web SDK

ViaLink 딥링크 인프라 서비스를 위한 Web SDK입니다.

## 특징

- **딥링크 파라미터 추출** — URL에서 딥링크 데이터 자동 파싱
- **디퍼드 딥링킹** — 웹-투-앱 매칭 (핑거프린트 기반)
- **이벤트 추적** — 커스텀 이벤트 배치 전송 + sendBeacon 이탈 보장
- **결제 어트리뷰션** — 결제 시도 기록 + 자동 link_id 첨부
- **스마트 앱 배너** — 모바일 웹에서 앱 설치/열기 유도 배너

## 요구사항

- Chrome 80+, Safari 14+, Firefox 78+

## 설치

```bash
npm install vialink-web-sdk
```

또는 CDN:

```html
<script src="https://unpkg.com/vialink-web-sdk/dist/index.js"></script>
```

## 사용법

### 1. 초기화

```typescript
import { ViaLinkWebSDK } from 'vialink-web-sdk';

const sdk = ViaLinkWebSDK.init({ apiKey: 'YOUR_API_KEY' });
```

### 2. 딥링크 데이터 추출

```typescript
const data = ViaLinkWebSDK.shared.getDeepLinkData();
if (data) {
  console.log('경로:', data.path);
  console.log('파라미터:', data.params);
}
```

### 3. 디퍼드 딥링크

```typescript
// Promise 방식
const { data, error } = await ViaLinkWebSDK.shared.deferredMatch();
if (error) {
  console.log('매칭 실패:', error.code, error.message);
} else if (data) {
  window.location.href = data.path;
}

// 콜백 방식 (5초 데드라인 내장)
ViaLinkWebSDK.shared.onDeferredDeepLink((data, error) => {
  if (error) return; // timeout/network 등
  if (!data) return; // organic
  window.location.href = data.path;
});
```

### 4. 이벤트 추적

```typescript
// 정적 메서드 (어디서든 호출 가능)
ViaLinkWebSDK.track('purchase', {
  product_id: '12345',
  revenue: 29900,
  currency: 'KRW',
});
```

### 5. 결제 추적

```typescript
const result = await ViaLinkWebSDK.payment.initiated({
  orderId: 'ORD-2026-0001',
  amount: 19900,
  currency: 'KRW',
  paymentMethod: 'card',
});
console.log('success:', result.success, 'id:', result.paymentEventId);
```

### 6. 링크 생성

```typescript
const shortUrl = await ViaLinkWebSDK.shared.createLink(
  '/product/12345',
  { promo_code: 'FRIEND_SHARE' },
  'referral',
  'dynamic',
);
console.log('생성된 링크:', shortUrl);
```

### 7. 스마트 앱 배너

```typescript
ViaLinkWebSDK.shared.showBanner({
  title: '앱에서 보기',
  description: '더 나은 경험을 앱에서',
  buttonText: '열기',
  iosStoreUrl: 'https://apps.apple.com/app/id123456',
  androidStoreUrl: 'https://play.google.com/store/apps/...',
  position: 'top',  // 'top' | 'bottom'
  theme: 'light',   // 'light' | 'dark'
});
```

## 샘플 프로젝트

`sample/` 디렉토리에서 실행 가능한 HTML 데모 페이지를 확인하세요.

## 문서

- [SDK 가이드](https://docs.vialink.app/sdk/web)

## 라이선스

MIT License — Aresjoy Inc.
