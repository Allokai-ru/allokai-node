import type { HttpClient } from '../http';
import type { Voice } from '../types';

export interface PreviewOptions {
  voiceId: string;
  text: string;
  modelId?: string;
}

export class VoicesResource {
  constructor(private readonly http: HttpClient) {}

  list(options: { limit?: number; offset?: number } = {}): Promise<Voice[]> {
    const { limit = 50, offset = 0 } = options;
    return this.http.get<Voice[]>('/voices', { limit, offset });
  }

  get(voiceId: string): Promise<Voice> {
    return this.http.get<Voice>(`/voices/by-id/${voiceId}`);
  }

  models(): Promise<Record<string, unknown>[]> {
    return this.http.get<Record<string, unknown>[]>('/voices/models');
  }

  /** Generate a TTS audio preview. Returns Blob (MP3). */
  async preview(options: PreviewOptions): Promise<Blob> {
    const { voiceId, text, modelId = 'eleven_flash_v2_5' } = options;
    const url = `${this.http.baseUrl}/voices/preview`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.http.getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ voice_id: voiceId, text, model_id: modelId }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Preview failed (${response.status}): ${detail}`);
    }
    return response.blob();
  }
}
