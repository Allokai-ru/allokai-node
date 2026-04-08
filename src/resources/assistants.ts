import type { HttpClient } from '../http';
import type { Assistant, AssistantStats } from '../types';

export interface CreateAssistantOptions {
  name: string;
  config?: Record<string, unknown>;
}

export interface UpdateAssistantOptions {
  name?: string;
  config?: Record<string, unknown>;
}

export interface ListAssistantsOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export class AssistantsResource {
  constructor(private readonly http: HttpClient) {}

  list(options: ListAssistantsOptions = {}): Promise<Assistant[]> {
    const { limit = 50, offset = 0, search } = options;
    return this.http.get<Assistant[]>('/assistants', { limit, offset, search });
  }

  get(assistantId: string): Promise<Assistant> {
    return this.http.get<Assistant>(`/assistants/${assistantId}`);
  }

  create(options: CreateAssistantOptions): Promise<Assistant> {
    return this.http.post<Assistant>('/assistants', {
      name: options.name,
      config: options.config ?? {},
    });
  }

  update(assistantId: string, options: UpdateAssistantOptions): Promise<Assistant> {
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.config !== undefined) body.config = options.config;
    return this.http.put<Assistant>(`/assistants/${assistantId}`, body);
  }

  delete(assistantId: string): Promise<void> {
    return this.http.delete(`/assistants/${assistantId}`);
  }

  clone(assistantId: string): Promise<Assistant> {
    return this.http.post<Assistant>(`/assistants/${assistantId}/clone`);
  }

  stats(assistantId: string): Promise<AssistantStats> {
    return this.http.get<AssistantStats>(`/assistants/${assistantId}/stats`);
  }
}
