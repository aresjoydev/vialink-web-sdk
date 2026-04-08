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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    });
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
  ): Promise<string> {
    const body: Record<string, unknown> = { deeplinkPath: path };
    if (data) body['deeplinkData'] = data;
    if (campaign) body['campaign'] = campaign;

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
