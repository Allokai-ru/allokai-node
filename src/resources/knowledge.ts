import type { HttpClient } from '../http';
import type { KnowledgeSource } from '../types';

const TERMINAL_STATUSES = new Set([
  'succeeded', 'failed', 'not_indexed', 'not_uploaded',
  'rag_limit_exceeded', 'document_too_small',
]);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 300_000;

export interface UploadTextOptions {
  name: string;
  text: string;
  usageMode?: 'prompt' | 'auto';
}

export interface UploadUrlOptions {
  url: string;
  name?: string;
  usageMode?: 'prompt' | 'auto';
}

export class KnowledgeResource {
  constructor(private readonly http: HttpClient) {}

  list(options: { limit?: number; offset?: number } = {}): Promise<KnowledgeSource[]> {
    const { limit = 50, offset = 0 } = options;
    return this.http.get<KnowledgeSource[]>('/knowledge', { limit, offset });
  }

  get(docId: string): Promise<KnowledgeSource> {
    return this.http.get<KnowledgeSource>(`/knowledge/${docId}`);
  }

  /** Upload a file (File or Blob) to the knowledge base. */
  uploadFile(file: File | Blob, options: { name?: string; usageMode?: 'prompt' | 'auto' } = {}): Promise<KnowledgeSource> {
    const { usageMode = 'auto' } = options;
    const name = options.name ?? (file instanceof File ? file.name : 'document');
    const fd = new FormData();
    fd.append('file', file, name);
    fd.append('usage_mode', usageMode);
    return this.http.postForm<KnowledgeSource>('/knowledge/upload', fd);
  }

  /** Add a URL as a knowledge source. */
  uploadUrl(options: UploadUrlOptions): Promise<KnowledgeSource> {
    const { url, name, usageMode = 'auto' } = options;
    const body: Record<string, unknown> = { type: 'url', url, usage_mode: usageMode };
    if (name) body.name = name;
    return this.http.post<KnowledgeSource>('/knowledge/upload', body);
  }

  /** Add plain text as a knowledge source. */
  uploadText(options: UploadTextOptions): Promise<KnowledgeSource> {
    const { name, text, usageMode = 'auto' } = options;
    return this.http.post<KnowledgeSource>('/knowledge/upload', {
      type: 'text', name, text, usage_mode: usageMode,
    });
  }

  ragStatus(docId: string): Promise<KnowledgeSource> {
    return this.http.get<KnowledgeSource>(`/knowledge/${docId}/rag-status`);
  }

  /** Poll until indexing reaches a terminal state. */
  async waitUntilIndexed(docId: string, timeoutMs: number = POLL_TIMEOUT_MS): Promise<KnowledgeSource> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const status = await this.ragStatus(docId);
      if (status.is_terminal || TERMINAL_STATUSES.has(status.status)) return status;
      if (Date.now() >= deadline) {
        throw new Error(`RAG indexing for ${docId} did not complete within ${timeoutMs}ms`);
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  reindex(docId: string): Promise<KnowledgeSource> {
    return this.http.post<KnowledgeSource>(`/knowledge/${docId}/rag-index`);
  }

  delete(docId: string): Promise<void> {
    return this.http.delete(`/knowledge/${docId}`);
  }
}
