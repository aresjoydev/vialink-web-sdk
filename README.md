# ViaLink Web SDK

[![ViaLink — Deep links for 6 platforms. Start free.](docs/banner-en.png)](https://vialink.app)

**English** | [한국어](README.ko.md)

Web SDK for the ViaLink deep link infrastructure service.

Connects a click on the web all the way through to app install and launch. Link creation,
deep link parameter extraction, the smart app banner, and event tracking run in the
browser, and the mobile SDK picks up the first launch after install under the same
campaign.

Unlike most deep link and attribution tools, which require a sales call and an annual
contract, **ViaLink is free to start.** No credit card — all six platform SDKs are
available the moment you sign up.

**→ [vialink.app](https://vialink.app)**

## Requirements

- Chrome 80+, Safari 14+, Firefox 78+

## Installation

```bash
npm install vialink-web-sdk
```

## Usage

```typescript
import { ViaLinkWebSDK } from 'vialink-web-sdk';

// Initialize
const sdk = ViaLinkWebSDK.init({ apiKey: 'YOUR_API_KEY' });

// Extract deep link data
const data = sdk.getDeepLinkData();
if (data) {
  console.log('path:', data.path);
  console.log('params:', data.params);
}

// Event tracking
sdk.track('purchase', { product_id: '12345', revenue: 29900 });

// Create a link
const shortUrl = await sdk.createLink('/product/12345', { promo_code: 'FRIEND_SHARE' }, 'referral');

// Smart app banner
sdk.showBanner({
  title: 'Open in app',
  buttonText: 'Open',
  iosStoreUrl: 'https://apps.apple.com/app/id123456',
  androidStoreUrl: 'https://play.google.com/store/apps/...',
});
```

## Documentation

- [SDK Guide](https://docs.vialink.app/#sdk-web-install)
