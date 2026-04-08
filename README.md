# Allokai TypeScript SDK

Official TypeScript / JavaScript SDK for the [Allokai Voice AI](https://allokai.ru) platform.

## Installation

```bash
npm install @allokai/sdk
```

**Requirements:** TypeScript 5+, Node.js 18+ or modern browser

## Quickstart

```typescript
import { AlokaiClient } from '@allokai/sdk';

const client = new AlokaiClient({ apiKey: 'sk_live_...' });

// Create an assistant
const assistant = await client.assistants.create({
  name: 'Sales Bot',
  config: {
    agent: {
      prompt: { prompt: 'Ты менеджер по продажам. Помогай клиентам.' },
      language: 'ru',
    },
  },
});

// Start a session
const session = await client.sessions.start({ assistantId: assistant.id });

// Get transcript
const transcript = await client.sessions.transcript(session.session_id);
for (const entry of transcript) {
  console.log(`${entry.role}: ${entry.content}`);
}
```

## Resources

- **Assistants** — `client.assistants.create / list / get / update / delete / clone / stats`
- **Sessions** — `client.sessions.start / list / get / transcript / costs / delete / connect`
- **Voices** — `client.voices.list / get / models / preview`
- **Knowledge** — `client.knowledge.uploadFile / uploadUrl / uploadText / waitUntilIndexed`
- **Webhooks** — `client.webhooks.create / list / test / deliveries / delete`
- **Billing** — `client.billing.get / transactions / autoRecharge`

## Voice sessions (WebSocket)

```typescript
const session = await client.sessions.start({ assistantId: 'ASSISTANT_ID' });

const voice = await client.sessions.connect(session.session_id, {
  onStatus: (status) => console.log(status),
  onTranscript: (text) => console.log('User:', text),
  onBotText: (text, done) => done && console.log('Bot:', text),
  onAudio: (pcm16) => playAudio(pcm16),
});

voice.sendText('Привет!');
```

## Error handling

```typescript
import { AlokaiClient, AuthError, NotFoundError, RateLimitError } from '@allokai/sdk';

try {
  await client.assistants.get('id');
} catch (err) {
  if (err instanceof AuthError) console.error('Invalid API key');
  else if (err instanceof NotFoundError) console.error('Not found');
  else if (err instanceof RateLimitError) console.error(`Retry after ${err.retryAfter}s`);
}
```

## Documentation

Full docs at [docs.allokai.ru/sdks/typescript](https://docs.allokai.ru/sdks/typescript)

## License

MIT
