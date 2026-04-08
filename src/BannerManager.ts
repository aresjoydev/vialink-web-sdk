import type { BannerOptions, Platform } from './types';

const DISMISS_KEY = 'vialink_banner_dismissed';

/// 스마트 앱 배너 매니저 (웹 고유 기능)
/// 모바일 웹에서 앱 설치/열기를 유도하는 배너를 표시합니다.
export class BannerManager {
  private bannerElement: HTMLElement | null = null;

  /// 현재 플랫폼 감지
  static detectPlatform(): Platform {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    return 'desktop';
  }

  /// 배너 표시
  show(options: BannerOptions): void {
    // 이미 닫은 경우 표시하지 않음
    if (this.isDismissed()) return;

    // 데스크탑에서는 표시하지 않음
    const platform = BannerManager.detectPlatform();
    if (platform === 'desktop') return;

    // 스토어 URL 결정
    const storeUrl =
      platform === 'ios' ? options.iosStoreUrl : options.androidStoreUrl;
    if (!storeUrl) return;

    this.bannerElement = this.createBannerElement(options, storeUrl, platform);
    document.body.prepend(this.bannerElement);
  }

  /// 배너 숨기기
  hide(): void {
    if (this.bannerElement) {
      this.bannerElement.remove();
      this.bannerElement = null;
    }
  }

  /// 배너 닫기 (다시 표시하지 않음)
  dismiss(): void {
    this.hide();
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // 무시
    }
  }

  private isDismissed(): boolean {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private createBannerElement(
    options: BannerOptions,
    storeUrl: string,
    platform: Platform,
  ): HTMLElement {
    const position = options.position ?? 'top';
    const theme = options.theme ?? 'light';

    const banner = document.createElement('div');
    banner.id = 'vialink-smart-banner';
    banner.style.cssText = `
      position: fixed;
      ${position}: 0;
      left: 0;
      right: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      padding: 10px 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      ${theme === 'dark'
        ? 'background: #1a1a1a; color: #ffffff;'
        : 'background: #ffffff; color: #111111;'}
    `;

    // 닫기 버튼
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = `
      background: none; border: none; font-size: 22px; cursor: pointer;
      padding: 0 8px 0 0; line-height: 1; color: inherit; opacity: 0.6;
    `;
    closeBtn.addEventListener('click', () => this.dismiss());

    // 아이콘
    if (options.iconUrl) {
      const icon = document.createElement('img');
      icon.src = options.iconUrl;
      icon.style.cssText = 'width: 40px; height: 40px; border-radius: 8px; margin-right: 10px;';
      banner.appendChild(closeBtn);
      banner.appendChild(icon);
    } else {
      banner.appendChild(closeBtn);
    }

    // 텍스트 영역
    const textArea = document.createElement('div');
    textArea.style.cssText = 'flex: 1; min-width: 0;';

    const title = document.createElement('div');
    title.textContent = options.title;
    title.style.cssText = 'font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

    textArea.appendChild(title);

    if (options.description) {
      const desc = document.createElement('div');
      desc.textContent = options.description;
      desc.style.cssText = 'font-size: 12px; opacity: 0.7; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
      textArea.appendChild(desc);
    }

    banner.appendChild(textArea);

    // 열기 버튼
    const openBtn = document.createElement('a');
    openBtn.href = storeUrl;
    openBtn.target = '_blank';
    openBtn.rel = 'noopener noreferrer';
    openBtn.textContent = options.buttonText ?? (platform === 'ios' ? 'App Store' : 'Google Play');
    openBtn.style.cssText = `
      margin-left: 10px; padding: 6px 14px; border-radius: 4px;
      text-decoration: none; font-size: 13px; font-weight: 600; white-space: nowrap;
      ${theme === 'dark'
        ? 'background: #ffffff; color: #1a1a1a;'
        : 'background: #111111; color: #ffffff;'}
    `;

    banner.appendChild(openBtn);

    return banner;
  }
}
