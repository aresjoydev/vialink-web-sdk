import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BannerManager } from '../src/BannerManager';

describe('BannerManager', () => {
  describe('detectPlatform', () => {
    beforeEach(() => {
      vi.stubGlobal('navigator', { userAgent: '' });
    });

    it('iOS 감지', () => {
      vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' });
      expect(BannerManager.detectPlatform()).toBe('ios');
    });

    it('Android 감지', () => {
      vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
      expect(BannerManager.detectPlatform()).toBe('android');
    });

    it('Desktop 감지', () => {
      vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)' });
      expect(BannerManager.detectPlatform()).toBe('desktop');
    });
  });
});
