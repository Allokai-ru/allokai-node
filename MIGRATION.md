# TypeScript SDK: 1.x → 2.0 Migration Guide

This guide walks you through upgrading from the legacy VoiceSession API to the new VoiceClient API introduced in SDK v2.0.

## Overview of Changes

- **Old:** `VoiceSession` class (low-level wrapper with legacy event names)
- **New:** `VoiceClient` class (high-level client with modern event semantics)
- **Auth:** Moved from query-param (`?token=`) to WebSocket subprotocol (`allokai.bearer.<token>`)
- **Events:** Renamed to match voice platform semantics (e.g., `stt.partial`, `llm.delta`, `turn.started`)
- **Audio:** Native PCM16 PCM16 framing (no legacy `text_message`/`context_update`/`feedback` messages)

## Event Mapping

| Old (`VoiceSession`) | New (`VoiceClient`) | Description |
|---|---|---|
| `onStatus('ready')` | `onSessionStarted(msg)` | Session initialized; contains audio rates |
| `onStatus('listening')` | `onSpeechStarted(msg)` | User started speaking |
| `onStatus('thinking')` | `onTurnStarted(msg)` | Agent processing turn |
| `onStatus('speaking')` | `onSpeechEnded(msg)` | Agent finished speaking |
| `onTranscript(text)` | `onUserPartial(msg)` + `onUserTurn(msg)` | STT partial & final |
| `onBotText(text, done)` | `onAgentDelta(msg)` + `onAgentTurn(msg)` | LLM streaming & complete |
| `onAudio(pcm16)` | `onAudio(msg)` | Agent audio chunk (base64 in msg.data) |
| `onToolCall(...)` | `onToolCall(msg)` | Tool invocation with call_id/name/arguments |
| `onMetadata(conv_id, agent_id)` | `onSessionStarted(msg)` | Now in session.started msg |
| `onError(message)` | `onError(msg)` | Error with code + message |
| `onSessionEnded()` | `onEnded(msg)` | Session ended with reason + duration |
| *(removed)* | `onTurnEnded(msg)` | Per-turn completion metrics |
| *(removed)* | `onInterrupted(msg)` | Barge-in triggered |

## Code Examples

### Before (v1.x with VoiceSession)

```typescript
import { AlokaiClient } from '@allokai/sdk';

const client = new AlokaiClient({ apiKey: 'sk_...' });

// Start session via REST
const session = await client.sessions.start({ assistantId: 'asst_123' });

// Connect via legacy connect() method
const voice = await client.sessions.connect(session.session_id, {
  onStatus: (status) => {
    if (status === 'ready') console.log('Ready to speak');
  },
  onTranscript: (text) => console.log('User said:', text),
  onBotText: (text, done) => {
    if (done) console.log('Agent said:', text);
  },
  onAudio: (pcm16) => playAudio(pcm16),
  onToolCall: (toolCallId, toolName, params) => {
    console.log(`Tool: ${toolName}`, params);
    voice.sendToolResult(toolCallId, { result: 'ok' });
  },
  onError: (message) => console.error('Error:', message),
  onSessionEnded: () => console.log('Session ended'),
});

voice.sendText('Hello!');
voice.sendContextUpdate('Context here');  // legacy
voice.close();
```

### After (v2.0 with VoiceClient)

```typescript
import {
  AlokaiClient,
  VoiceClient,
  type VoiceClientCallbacks,
} from '@allokai/sdk';

const client = new AlokaiClient({ apiKey: 'sk_...' });

// Start session via REST (unchanged)
const session = await client.sessions.start({ assistantId: 'asst_123' });

// Connect via new VoiceClient
const callbacks: VoiceClientCallbacks = {
  onSessionStarted: (msg) => {
    console.log('Session ready, rates:', {
      input: msg.audio_in_rate,
      output: msg.audio_out_rate,
    });
  },
  onSpeechStarted: (msg) => {
    console.log('User started speaking (turn', msg.turn_index + ')');
  },
  onUserPartial: (msg) => {
    console.log('STT partial:', msg.text);
  },
  onUserTurn: (msg) => {
    console.log('User said (final):', msg.text);
  },
  onTurnStarted: (msg) => {
    console.log('Agent processing (turn', msg.turn_index + ')');
  },
  onAgentDelta: (msg) => {
    console.log('Agent speaking:', msg.text);
  },
  onAgentTurn: (msg) => {
    console.log('Agent finished:', msg.text, '| tokens:', {
      in: msg.tokens_in,
      out: msg.tokens_out,
    });
  },
  onAudio: (msg) => {
    // msg.data is base64-encoded PCM16; decode it
    const pcm16 = base64ToBytes(msg.data);  // helper from audio-playback
    playAudio(pcm16);
  },
  onToolCall: (msg) => {
    console.log(`Tool: ${msg.name} [call_id=${msg.call_id}]`, msg.arguments);
    voice.sendToolResult(msg.call_id, { result: 'ok' });  // or error: '...'
  },
  onInterrupted: (msg) => {
    console.log('User interrupted agent (reason:', msg.reason + ')');
  },
  onError: (msg) => {
    console.error(`Error [${msg.code}]:`, msg.message);
  },
  onEnded: (msg) => {
    console.log('Session ended:', {
      reason: msg.reason,
      duration_sec: msg.duration_sec,
      summary: msg.summary,
    });
  },
  onClose: (ev) => {
    console.log('WebSocket closed:', ev.code, ev.reason);
  },
};

const voice = new VoiceClient({
  baseUrl: 'https://api.allokai.ru/v1',
  token: 'ak_live_...',  // or null for cookie auth
  sessionId: session.session_id,
  callbacks,
  inputSampleRate: 24000,   // optional, default 24000
  outputSampleRate: 24000,  // optional, default 24000
});

await voice.connect();
await voice.startMicrophone();  // request mic, optional

voice.sendText('Hello!');
voice.interrupt();  // barge in
voice.ping();       // keep-alive
voice.disconnect(); // cleanup
```

## Authentication Methods

### Method 1: Bearer Token (Default)

```typescript
const voice = new VoiceClient({
  baseUrl: 'https://api.allokai.ru/v1',
  token: 'ak_live_xyz123...',  // API key
  sessionId: 'sess_abc',
  callbacks,
});
```

**Wire Protocol:** Sends subprotocol `allokai.bearer.ak_live_xyz123...` during WebSocket handshake.
Server authenticates without exposing token in URL.

### Method 2: SPA Cookie Auth

```typescript
const voice = new VoiceClient({
  baseUrl: 'https://api.allokai.ru/v1',
  token: null,  // signals SPA mode
  sessionId: 'sess_abc',
  callbacks,
});
```

**Wire Protocol:** No subprotocol sent. Browser automatically includes cookies (same-origin `credentials: include`).

## Breaking Changes

1. **VoiceSession class removed**
   - Replaced by `VoiceClient`

2. **Legacy methods removed**
   - `sendContextUpdate(text)` — no longer supported (context updates via dynamic variables only)
   - `sendFeedback(...)` — removed
   - Legacy event types (`text_message`, `context_update`, `feedback`, `vad_score`) — no longer exist

3. **Auth mechanism**
   - Query parameter (`?token=...`) → WebSocket subprotocol (`allokai.bearer.TOKEN`)
   - SPA mode now uses cookie auth (no token in URL)

4. **Event structure**
   - Callbacks receive full message objects, not unpacked primitives
   - Use discriminated unions or type guards (`isAudioOutput`, `isTurnEnded`, etc.) to narrow types

5. **Audio format**
   - Output audio is now base64-encoded in the message (decode with `base64ToBytes()`)
   - Input audio must be base64-encoded by the client (encoded by `VoiceClient.startMicrophone()` automatically)

6. **Sessions REST API**
   - `client.sessions.connect()` method removed
   - Use `new VoiceClient(...)` + `await voice.connect()` instead

## Migration Checklist

- [ ] Update import: `import { VoiceClient } from '@allokai/sdk'`
- [ ] Remove `client.sessions.connect()` calls
- [ ] Create `VoiceClient` instance with new options object
- [ ] Update callbacks to match new event names and signatures
- [ ] Replace `sendContextUpdate()` with session restart (dynamic variables)
- [ ] Update audio playback: decode base64 from `onAudio` messages
- [ ] Update audio capture: `startMicrophone()` handles encoding
- [ ] Test authentication: token-based or cookie-based
- [ ] Test microphone and speaker permissions
- [ ] Verify tool handling: use `msg.call_id` instead of `toolCallId`

## Common Patterns

### Detecting Turn Completion

**Old:**
```typescript
onBotText: (text, done) => {
  if (done) console.log('Turn complete');
}
```

**New:**
```typescript
onAgentTurn: (msg) => {
  console.log('Turn complete:', msg.text, 'tokens:', {
    in: msg.tokens_in,
    out: msg.tokens_out,
  });
}
```

### Stopping Agent Audio (Barge-In)

**Old:** (automatic on `onStatus('listening')`)

**New:** (automatic on `onSpeechStarted`)
```typescript
// Or manual interrupt:
voice.interrupt();
```

### Handling Tool Calls

**Old:**
```typescript
onToolCall: (toolCallId, toolName, parameters) => {
  voice.sendToolResult(toolCallId, resultStr);
}
```

**New:**
```typescript
onToolCall: (msg) => {
  voice.sendToolResult(msg.call_id, { result: 'ok' }, /* or error */);
}
```

### Microphone Capture (Now Optional)

**Old:** (automatic with VoiceSession)

**New:** (explicit and optional)
```typescript
await voice.connect();
// Now manually request mic:
try {
  await voice.startMicrophone();
  console.log('Mic started');
} catch (err) {
  console.error('Mic permission denied');
}
```

## Testing & Debugging

### Type Safety

All message types are discriminated unions. Use TypeScript's type narrowing:

```typescript
onMessageCallback: (msg) => {
  if (msg.type === 'audio.output') {
    // msg is now AudioOutputMsg
    const bytes = base64ToBytes(msg.data);
  }
}
```

Or use provided type guards:

```typescript
import { isAudioOutput, isErrorMessage } from '@allokai/sdk';

if (isAudioOutput(msg)) {
  // handle audio
}
```

### Logging

Enable console.warn for dropped messages:

```typescript
// VoiceClient logs warnings if sendText/ping/etc called while not OPEN
```

Check WebSocket readyState:

```typescript
if (voice.readyState === WebSocket.OPEN) {
  voice.sendText('...');
}
```

## Support

For issues or questions:
- Check the [wire protocol types](./src/wire.ts) for complete message schemas
- Review [VoiceClient class](./src/voice-client.ts) for implementation details
- See [audio helpers](./src/audio-playback.ts) for PCM16 utilities
