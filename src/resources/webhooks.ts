import type { HttpClient } from '../http';
import type { Webhook, WebhookDelivery, WebhookTestResult } from '../types';

export interface CreateWebhookOptions {
  url: string;
  events: string[];
  secret?: string;
}

export interface UpdateWebhookOptions {
  url?: string;
  events?: string[];
  isActive?: boolean;
}

export class WebhooksResource {
  constructor(private readonly http: HttpClient) {}

  list(options: { limit?: number; offset?: number; isActive?: boolean } = {}): Promise<Webhook[]> {
    const { limit = 50, offset = 0, isActive } = options;
    return this.http.get<Webhook[]>('/webhooks', {
      limit, offset,
      ...(isActive !== undefined ? { is_active: isActive } : {}),
    });
  }

  get(webhookId: string): Promise<Webhook> {
    return this.http.get<Webhook>(`/webhooks/${webhookId}`);
  }

  events(): Promise<string[]> {
    return this.http.get<{ events: string[] }>('/webhooks/events').then((r) => r.events);
  }

  create(options: CreateWebhookOptions): Promise<Webhook> {
    const body: Record<string, unknown> = { url: options.url, events: options.events };
    if (options.secret) body.secret = options.secret;
    return this.http.post<Webhook>('/webhooks', body);
  }

  update(webhookId: string, options: UpdateWebhookOptions): Promise<Webhook> {
    const body: Record<string, unknown> = {};
    if (options.url !== undefined) body.url = options.url;
    if (options.events !== undefined) body.events = options.events;
    if (options.isActive !== undefined) body.is_active = options.isActive;
    return this.http.put<Webhook>(`/webhooks/${webhookId}`, body);
  }

  delete(webhookId: string): Promise<void> {
    return this.http.delete(`/webhooks/${webhookId}`);
  }

  test(webhookId: string): Promise<WebhookTestResult> {
    return this.http.post<WebhookTestResult>(`/webhooks/${webhookId}/test`);
  }

  deliveries(webhookId: string, options: { limit?: number; offset?: number } = {}): Promise<WebhookDelivery[]> {
    const { limit = 50, offset = 0 } = options;
    return this.http.get<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`, { limit, offset });
  }
}
