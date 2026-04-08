import { describe, it, expect } from 'vitest';
import { ViaLinkWebSDK } from '../src/ViaLinkWebSDK';

describe('ViaLinkWebSDK.parseDeepLinkFromURL', () => {
  it('/c/shortCode 경로에서 추출', () => {
    const data = ViaLinkWebSDK.parseDeepLinkFromURL('https://example.com/c/xYz12');
    expect(data).not.toBeNull();
    expect(data!.shortCode).toBe('xYz12');
  });

  it('/c/shortCode + 쿼리 파라미터', () => {
    const data = ViaLinkWebSDK.parseDeepLinkFromURL('https://example.com/c/abc?ref=share&promo=SUMMER');
    expect(data).not.toBeNull();
    expect(data!.shortCode).toBe('abc');
    expect(data!.params['ref']).toBe('share');
    expect(data!.params['promo']).toBe('SUMMER');
  });

  it('vialink_code 쿼리 파라미터에서 추출', () => {
    const data = ViaLinkWebSDK.parseDeepLinkFromURL(
      'https://example.com/landing?vialink_code=test123&vialink_path=/product/1',
    );
    expect(data).not.toBeNull();
    expect(data!.shortCode).toBe('test123');
    expect(data!.path).toBe('/product/1');
  });

  it('vialink_ 접두사 파라미터 추출', () => {
    const data = ViaLinkWebSDK.parseDeepLinkFromURL(
      'https://example.com/?vialink_code=x&vialink_promo=DEAL',
    );
    expect(data).not.toBeNull();
    expect(data!.params['promo']).toBe('DEAL');
  });

  it('딥링크 파라미터 없는 URL', () => {
    const data = ViaLinkWebSDK.parseDeepLinkFromURL('https://example.com/about');
    expect(data).toBeNull();
  });

  it('잘못된 URL', () => {
    const data = ViaLinkWebSDK.parseDeepLinkFromURL('not-a-url');
    expect(data).toBeNull();
  });

  it('루트 URL', () => {
    const data = ViaLinkWebSDK.parseDeepLinkFromURL('https://example.com/');
    expect(data).toBeNull();
  });
});
