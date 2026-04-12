import type { HttpClient } from '../http';
import type { KnowledgeSource, KnowledgeRagStatus } from '../types';

const TERMINAL_STATUSES = new Set([
  'succeeded', 'failed', 'not_indexed', 'not_uploaded',
  'rag_limit_exceeded', 'document_too_small',
]);
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 300_000;

export interface UploadTextOptions {
  assistantId: string;
  name: string;
  text: string;
  usageMode?: 'prompt' | 'auto';
}

export interface UploadUrlOptions {
  assistantId: string;
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
  uploadFile(file: File | Blob, options: { assistantId: string; name?: string; usageMode?: 'prompt' | 'auto' }): Promise<KnowledgeSource> {
    const { assistantId, usageMode = 'auto' } = options;
    const name = options.name ?? (file instanceof File ? file.name : 'document');
    const fd = new FormData();
    fd.append('assistant_id', assistantId);
    fd.append('name', name);
    fd.append('source_type', 'file');
    fd.append('usage_mode', usageMode);
    fd.append('file', file, name);
    return this.http.postForm<KnowledgeSource>('/knowledge/upload', fd);
  }

  /** Add a URL as a knowledge source. */
  uploadUrl(options: UploadUrlOptions): Promise<KnowledgeSource> {
    const { assistantId, url, name, usageMode = 'auto' } = options;
    const fd = new FormData();
    fd.append('assistant_id', assistantId);
    fd.append('name', name ?? url);
    fd.append('source_type', 'url');
    fd.append('url', url);
    fd.append('usage_mode', usageMode);
    return this.http.postForm<KnowledgeSource>('/knowledge/upload', fd);
  }

  /** Add plain text as a knowledge source. */
  uploadText(options: UploadTextOptions): Promise<KnowledgeSource> {
    const { assistantId, name, text, usageMode = 'auto' } = options;
    const fd = new FormData();
    fd.append('assistant_id', assistantId);
    fd.append('name', name);
    fd.append('source_type', 'text');
    fd.append('text_content', text);
    fd.append('usage_mode', usageMode);
    return this.http.postForm<KnowledgeSource>('/knowledge/upload', fd);
  }

  ragStatus(docId: string): Promise<KnowledgeRagStatus> {
    return this.http.get<KnowledgeRagStatus>(`/knowledge/${docId}/rag-status`);
  }

  /** Poll until indexing reaches a terminal state. */
  async waitUntilIndexed(docId: string, timeoutMs: number = POLL_TIMEOUT_MS): Promise<KnowledgeRagStatus> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const ragStatus = await this.ragStatus(docId);
      if (ragStatus.is_terminal || TERMINAL_STATUSES.has(ragStatus.status)) return ragStatus;
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
