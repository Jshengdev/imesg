# iMessage SDK Module Specification

## Overview
The iMessage SDK module provides the interface to send and receive iMessages via Photon iMessage Kit.

## Dependencies
- `@photon-ai/imessage-kit` - iMessage integration SDK

## Data Structures

### NormalizedMessage
```typescript
interface NormalizedMessage {
  id: string;
  text: string;
  sender: string;
  chatId: string;
  isFromMe: boolean;
  isGroupChat: boolean;
  timestamp: number;
  attachments: { path: string; mimeType?: string }[];
}
```

## Public API

### `sendText(to: string, text: string): Promise<void>`
Sends plain text message.

### `sendAudio(to: string, audioPath: string, caption?: string): Promise<void>`
Sends audio file with optional caption.

### `sendWithVoice(to: string, text: string, tts: Function): Promise<string | null>`
Sends text as voice note using TTS.

### `startListening(onMessage: (msg: NormalizedMessage) => void): Promise<void>`
Starts real-time message monitoring.

## Deduplication
- In-memory Set tracks processed IDs
- Max 10,000 entries
- Auto-clears at max
