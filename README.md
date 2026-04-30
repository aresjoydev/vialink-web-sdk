# ViaLink Web SDK

ViaLink 딥링크 인프라 서비스를 위한 Web SDK입니다.

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

- [SDK 가이드](https://docs.vialink.app)
