# Allokai TypeScript SDK

Official TypeScript / JavaScript SDK for the [Allokai Voice AI](https://allokai.ru) platform. v2.0+

## Installation

```bash
npm install @allokai/sdk
```

**Requirements:** TypeScript 5+, Node.js 18+ or modern browser (ES2020+)

## Quickstart

### REST API (Assistants & Sessions)

```typescript
import { AlokaiClient } from '@allokai/sdk';

const client = new AlokaiClient({ apiKey: 'ak_live_...' });

// Create an assistant
const assistant = await client.assistants.create({
  name: 'Sales Bot',
  config: {
    agent: {
      prompt: { prompt: 'Ты менеджер по продажам.' },
      language: 'ru',
    },
  },
});

// Start a session (REST)
const session = await client.sessions.start({ assistantId: assistant.id });

// Fetch transcript
const transcript = await client.sessions.transcript(session.session_id);
for (const entry of transcript) {
  console.log(`${entry.role}: ${entry.content}`);
}
```

### Voice Sessions (WebSocket)

```typescript
import { VoiceClient } from '@allokai/sdk';

const voice = new VoiceClient({
  baseUrl: 'https://api.allokai.ru/v1',
  token: 'ak_live_...',  // or null for cookie auth
  sessionId: session.session_id,
  callbacks: {
    onSessionStarted: (msg) => console.log('Session ready'),
    onUserTurn: (msg) => console.log('User:', msg.text),
    onAgentTurn: (msg) => console.log('Agent:', msg.text),
    onAudio: (msg) => playAudio(base64ToBytes(msg.data)),
    onError: (msg) => console.error(`[${msg.code}]`, msg.message),
    onEnded: (msg) => console.log('Session ended:', msg.reason),
  },
});

await voice.connect();
await voice.startMicrophone();  // optional: request mic permission

voice.sendText('Привет!');
voice.interrupt();  // barge-in
voice.disconnect();
```

## REST Resources

- **Assistants** — `create / list / get / update / delete / clone / stats`
- **Sessions** — `start / list / get / end / transcript / costs / analysis / delete`
- **Voices** — `list / get / models / preview`
- **Knowledge** — `uploadFile / uploadUrl / uploadText / waitUntilIndexed`
- **Webhooks** — `create / list / test / deliveries / delete`
- **Billing** — `get / transactions / autoRecharge`

## Voice Client (WebSocket)

### Callbacks

All callbacks receive fully-typed message objects:

```typescript
const callbacks: VoiceClientCallbacks = {
  onSessionStarted: (msg) => { /* SessionStartedMsg */ },
  onTurnStarted: (msg) => { /* TurnStartedMsg */ },
  onTurnEnded: (msg) => { /* TurnEndedMsg */ },
  onSpeechStarted: (msg) => { /* SpeechStartedMsg */ },
  onSpeechEnded: (msg) => { /* SpeechEndedMsg */ },
  onUserPartial: (msg) => { /* STTPartialMsg */ },
  onUserTurn: (msg) => { /* STTFinalMsg */ },
  onAgentDelta: (msg) => { /* LLMDeltaMsg */ },
  onAgentTurn: (msg) => { /* LLMDoneMsg */ },
  onAudio: (msg) => { /* AudioOutputMsg */ },
  onToolCall: (msg) => { /* ToolCallMsg */ },
  onInterrupted: (msg) => { /* InterruptedMsg */ },
  onError: (msg) => { /* ErrorMsg */ },
  onEnded: (msg) => { /* SessionEndedMsg */ },
  onPong: () => { /* pong response */ },
  onClose: (ev) => { /* WebSocket close */ },
};
```

### Methods

```typescript
voice.connect()              // Open WebSocket & send session.start
voice.startMicrophone()      // Request mic, stream audio.input
voice.sendText(text)         // Send text.input message
voice.sendToolResult(...)    // Send tool.result message
voice.interrupt()            // Send interrupt, stop playback
voice.ping()                 // Send ping (keep-alive)
voice.disconnect()           // Close & cleanup (idempotent)
voice.readyState             // WebSocket readyState (0-3)
```

### Authentication

**Token-based (default):**
```typescript
const voice = new VoiceClient({
  token: 'ak_live_...',  // Sent as subprotocol: allokai.bearer.<token>
  // ...
});
```

**SPA Cookie Auth:**
```typescript
const voice = new VoiceClient({
  token: null,  // No subprotocol; browser includes cookies
  // ...
});
```

## Error Handling

```typescript
import { AuthError, NotFoundError, RateLimitError } from '@allokai/sdk';

try {
  await client.assistants.get('id');
} catch (err) {
  if (err instanceof AuthError) {
    console.error('Invalid API key');
  } else if (err instanceof NotFoundError) {
    console.error('Resource not found');
  } else if (err instanceof RateLimitError) {
    console.error(`Rate limited, retry after ${err.retryAfter}s`);
  }
}
```

## Audio Utilities

```typescript
import { pcm16ToFloat32, base64ToBytes, WORKLET_NAME } from '@allokai/sdk';

// Decode audio output
const bytes = base64ToBytes(msg.data);  // Uint8Array from base64
const float32 = pcm16ToFloat32(new Int16Array(bytes.buffer));

// pcm16ToFloat32 is useful for Web Audio API processing
```

## Migration from v1.x

See [MIGRATION.md](./MIGRATION.md) for detailed upgrade guide.

**Quick summary:**
- Replace `client.sessions.connect(...)` with `new VoiceClient(...).connect()`
- Update event callbacks to match new message types
- Audio output is base64-encoded; decode with `base64ToBytes()`
- Auth changed from query param to WebSocket subprotocol

## Documentation

- [Wire Protocol Types](./src/wire.ts) — Complete message schemas
- [VoiceClient Implementation](./src/voice-client.ts) — Full API documentation
- [Migration Guide](./MIGRATION.md) — v1.x → v2.0 upgrade path
- [API Docs](https://docs.allokai.ru/api) — REST endpoints

## License

MIT
