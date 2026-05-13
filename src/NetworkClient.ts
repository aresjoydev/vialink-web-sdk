/// fetch 기반 HTTP 클라이언트 (지수 백오프 재시도)
export class NetworkClient {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly maxRetries = 3;

  constructor(baseURL: string, apiKey: string) {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  async get(path: string): Promise<string> {
    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.baseURL}${path}`, {
        method: 'GET',
        headers: this.buildHeaders(),
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(this.formatHttpError(response.status, errBody));
      }
      return response.text();
    });
  }

  async post(path: string, body: Record<string, unknown>): Promise<string> {
    return this.executeWithRetry(async () => {
      const response = await fetch(`${this.baseURL}${path}`, {
        method: 'POST',
        headers: { ...this.buildHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(this.formatHttpError(response.status, errBody));
      }
      return response.text();
    });
  }

  /// 비-2xx 응답을 status code + 응답 body 형태로 직렬화. 디버깅을 위해 둘 다 보존한다.
  private formatHttpError(status: number, body: string): string {
    const trimmed = body.trim();
    return trimmed ? `HTTP ${status}: ${trimmed}` : `HTTP ${status}`;
  }

  /// navigator.sendBeacon 기반 전송 (페이지 이탈 시에도 전송 보장)
  sendBeacon(path: string, body: Record<string, unknown>): boolean {
    if (typeof navigator === 'undefined' || !navigator.sendBeacon) return false;
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    return navigator.sendBeacon(`${this.baseURL}${path}`, blob);
  }

  async createLink(
    path: string,
    data?: Record<string, unknown>,
    campaign?: string,
    linkType: string = 'static',
    options?: {
      iosUrl?: string;
      androidUrl?: string;
      webUrl?: string;
      ogTitle?: string;
      ogDescription?: string;
      ogImageUrl?: string;
      channel?: string;
      feature?: string;
      tags?: string[];
      expiresAt?: string;
    },
  ): Promise<string> {
    const body: Record<string, unknown> = {
      deeplinkPath: path,
      linkType,
    };
    if (data) body['deeplinkData'] = data;
    if (campaign) body['campaign'] = campaign;
    if (options?.iosUrl !== undefined) body['iosUrl'] = options.iosUrl;
    if (options?.androidUrl !== undefined) body['androidUrl'] = options.androidUrl;
    if (options?.webUrl !== undefined) body['webUrl'] = options.webUrl;
    if (options?.ogTitle !== undefined) body['ogTitle'] = options.ogTitle;
    if (options?.ogDescription !== undefined) body['ogDescription'] = options.ogDescription;
    if (options?.ogImageUrl !== undefined) body['ogImageUrl'] = options.ogImageUrl;
    if (options?.channel !== undefined) body['channel'] = options.channel;
    if (options?.feature !== undefined) body['feature'] = options.feature;
    if (options?.tags !== undefined) body['tags'] = options.tags;
    if (options?.expiresAt !== undefined) body['expiresAt'] = options.expiresAt;

    const response = await this.post('/api/links', body);
    const json = JSON.parse(response) as { shortUrl: string };
    return json.shortUrl;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'X-API-Key': this.apiKey,
      Accept: 'application/json',
    };
  }

  private async executeWithRetry(block: () => Promise<string>): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        return await block();
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (attempt < this.maxRetries - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError ?? new Error('요청 실패');
  }
}
