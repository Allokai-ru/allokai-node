import { HttpClient, DEFAULT_BASE_URL } from './http';
import { AssistantsResource } from './resources/assistants';
import { SessionsResource } from './resources/sessions';
import { VoicesResource } from './resources/voices';
import { KnowledgeResource } from './resources/knowledge';
import { WebhooksResource } from './resources/webhooks';
import { BillingResource } from './resources/billing';

export interface AlokaiClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

/**
 * Allokai Voice AI API client.
 *
 * @example
 * import { AlokaiClient } from '@allokai/sdk';
 *
 * const client = new AlokaiClient({ apiKey: 'sk_live_...' });
 *
 * const assistant = await client.assistants.create({ name: 'Sales Bot' });
 * const session = await client.sessions.start({ assistantId: assistant.id });
 * const transcript = await client.sessions.transcript(session.session_id);
 */
export class AlokaiClient {
  readonly assistants: AssistantsResource;
  readonly sessions: SessionsResource;
  readonly voices: VoicesResource;
  readonly knowledge: KnowledgeResource;
  readonly webhooks: WebhooksResource;
  readonly billing: BillingResource;

  constructor({ apiKey, baseUrl = DEFAULT_BASE_URL, timeoutMs }: AlokaiClientOptions) {
    if (!apiKey) throw new Error('apiKey is required');

    const http = new HttpClient(apiKey, baseUrl, timeoutMs);

    this.assistants = new AssistantsResource(http);
    this.sessions = new SessionsResource(http);
    this.voices = new VoicesResource(http);
    this.knowledge = new KnowledgeResource(http);
    this.webhooks = new WebhooksResource(http);
    this.billing = new BillingResource(http);
  }
}
