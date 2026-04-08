import { AlokaiError, AuthError, NotFoundError, RateLimitError, ValidationError } from './errors';

export const DEFAULT_BASE_URL = 'https://allokai.ru/v1';
const DEFAULT_TIMEOUT_MS = 30_000;

type Params = Record<string, string | number | boolean | undefined>;

export class HttpClient {
  private readonly apiKey: string;
  readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(apiKey: string, baseUrl: string = DEFAULT_BASE_URL, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
  }

  private authHeaders(): Record<string, string> {
    return { 'Authorization': `Bearer ${this.apiKey}` };
  }

  private buildUrl(path: string, params?: Params): string {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
      const s = qs.toString();
      if (s) url += `?${s}`;
    }
    return url;
  }

  private async run<T>(method: string, path: string, options: {
    params?: Params;
    body?: unknown;
    formData?: FormData;
  } = {}): Promise<T> {
    const { params, body, formData } = options;
    const url = this.buildUrl(path, params);
    const headers: Record<string, string> = { ...this.authHeaders() };
    let requestBody: BodyInit | undefined;

    if (formData) {
      // Do NOT set Content-Type — browser sets multipart/form-data with boundary
      requestBody = formData;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 204) return undefined as T;
      if (!response.ok) await this.throwFromResponse(response);
      return response.json() as Promise<T>;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof AlokaiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AlokaiError(`Request timed out after ${this.timeoutMs}ms`);
      }
      throw new AlokaiError(err instanceof Error ? err.message : String(err));
    }
  }

  private async throwFromResponse(response: Response): Promise<never> {
    let detail: string;
    try {
      const data = await response.json();
      detail = data?.detail ?? response.statusText;
    } catch {
      detail = response.statusText;
    }

    if (response.status === 401) throw new AuthError(detail);
    if (response.status === 404) throw new NotFoundError(detail);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After') ?? 60);
      throw new RateLimitError(detail, retryAfter);
    }
    if (response.status === 422) throw new ValidationError(detail);
    throw new AlokaiError(detail, response.status);
  }

  get<T>(path: string, params?: Params): Promise<T> {
    return this.run<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.run<T>('POST', path, { body });
  }

  postForm<T>(path: string, formData: FormData): Promise<T> {
    return this.run<T>('POST', path, { formData });
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.run<T>('PUT', path, { body });
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.run<T>('PATCH', path, { body });
  }

  delete(path: string): Promise<void> {
    return this.run<void>('DELETE', path);
  }

  wsUrl(path: string): string {
    return this.baseUrl
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:') + path;
  }

  getApiKey(): string { return this.apiKey; }
}
