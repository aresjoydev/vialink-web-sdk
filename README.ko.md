# ViaLink Web SDK

[![ViaLink — 6개 플랫폼 딥링크를 무료로 시작하세요](docs/banner-ko.png)](https://vialink.app)

[English](README.md) | **한국어**

ViaLink 딥링크 인프라 서비스를 위한 Web SDK입니다.

웹에서 발생한 클릭을 앱 설치와 실행까지 끊김 없이 이어 붙입니다. 링크 생성, 딥링크
파라미터 추출, 스마트 앱 배너, 이벤트 추적을 브라우저에서 처리하고, 설치 후 첫 실행은
모바일 SDK가 이어받아 동일한 캠페인으로 어트리뷰션됩니다.

많은 딥링크 · 어트리뷰션 도구가 영업 문의와 연간 계약을 요구하는 것과 달리
**ViaLink는 무료로 시작합니다.** 카드 등록 없이, 가입 즉시 6개 플랫폼 SDK를 모두 쓸 수 있습니다.

**→ [vialink.app](https://vialink.app)**

## 요구사항

- Chrome 80+, Safari 14+, Firefox 78+

## 설치

```bash
npm install vialink-web-sdk
```

## 사용법

```typescript
import { ViaLinkWebSDK } from 'vialink-web-sdk';

// 초기화
const sdk = ViaLinkWebSDK.init({ apiKey: 'YOUR_API_KEY' });

// 딥링크 데이터 추출
const data = sdk.getDeepLinkData();
if (data) {
  console.log('경로:', data.path);
  console.log('파라미터:', data.params);
}

// 이벤트 추적
sdk.track('purchase', { product_id: '12345', revenue: 29900 });

// 링크 생성
const shortUrl = await sdk.createLink('/product/12345', { promo_code: 'FRIEND_SHARE' }, 'referral');

// 스마트 앱 배너
sdk.showBanner({
  title: '앱에서 보기',
  buttonText: '열기',
  iosStoreUrl: 'https://apps.apple.com/app/id123456',
  androidStoreUrl: 'https://play.google.com/store/apps/...',
});
```

## 문서

- [SDK 가이드](https://docs.vialink.app/#sdk-web-install)
