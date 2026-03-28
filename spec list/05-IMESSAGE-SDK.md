# iMessage SDK Module Specification

## Overview
The iMessage SDK module (`src/imessage/sdk.ts`) provides the interface to send and receive iMessages via the Photon iMessage Kit.

## Dependencies
- `@photon-ai/imessage-kit` - iMessage integration SDK

## Data Structures

### NormalizedMessage
```typescript
interface NormalizedMessage {
  id: string;                    // Unique message identifier
  text: string;                  // Message content
  sender: string;               // Sender identifier
  chatId: string;                // Chat/conversation identifier
  isFromMe: boolean;            // True if sent by user
  isGroupChat: boolean;         // True if group conversation
  timestamp: number;             // Unix timestamp (ms)
  attachments: {                // File attachments
    path: string;               // File path
    mimeType?: string;          // MIME type (optional)
  }[];
}
```

## Deduplication

### Processed ID Cache
- In-memory Set to track processed message IDs
- Maximum size: 10,000 entries
- Auto-clears when max reached to prevent memory leaks

## Message Normalization

The SDK normalizes raw messages from various SDK formats to a consistent internal format:

| Raw Field | Normalized Field | Fallback |
|-----------|------------------|----------|
| `msg.id` / `msg.guid` | `id` | empty string |
| `msg.text` / `msg.body` / `msg.content` / `msg.message` | `text` | empty string |
| `msg.sender` / `msg.senderName` / `msg.from` | `sender` | empty string |
| `msg.chatId` / `msg.chatGuid` / `msg.chat_id` | `chatId` | empty string |
| `msg.isFromMe` | `isFromMe` | false |
| `msg.isGroupChat` / `msg.isGroup` / `msg.chatType === 'group'` | `isGroupChat` | false |
| `msg.date` | `timestamp` | `Date.now()` |
| `msg.attachments` | `attachments` | empty array |

## Public API

### `sendText(to: string, text: string): Promise<void>`
Sends a plain text message.

**Parameters:**
- `to: string` - Recipient chat ID
- `text: string` - Message content

**Errors:** Silently logs failures, never throws

### `sendAudio(to: string, audioPath: string, caption?: string): Promise<void>`
Sends an audio file with optional text caption.

**Parameters:**
- `to: string` - Recipient chat ID
- `audioPath: string` - Path to audio file (`.m4a`)
- `caption?: string` - Optional text caption

**Errors:** Silently logs failures, never throws

### `sendWithVoice(to: string, text: string, tts: Function): Promise<string | null>`
Sends text as voice note using TTS function.

**Parameters:**
- `to: string` - Recipient chat ID
- `text: string` - Text to convert and send
- `tts: (text: string) => Promise<string>` - TTS function that returns audio path

**Returns:** Audio file path if TTS succeeded, null otherwise

**Behavior:**
1. Calls TTS function to generate audio
2. Sends audio with text caption on success
3. Falls back to text-only on TTS failure

### `startListening(onMessage: (msg: NormalizedMessage) => void): Promise<void>`
Starts real-time message monitoring.

**Parameters:**
- `onMessage: (msg: NormalizedMessage) => void` - Callback for each new message

**Behavior:**
1. Initializes Photon SDK
2. Starts watching for new messages
3. Normalizes each raw message
4. Deduplicates by message ID
5. Calls callback with normalized message

## Usage Example
```typescript
import { sendText, sendAudio, sendWithVoice, startListening } from './imessage/sdk';

// Send text
await sendText('chat-id-123', 'Hello there!');

// Send voice note
await sendAudio('chat-id-123', '/path/to/audio.m4a', 'Listen to this');

// Send with auto TTS
await sendWithVoice('chat-id-123', 'This will be spoken', textToSpeech);

// Start listening
await startListening((msg) => {
  console.log(`New message from ${msg.sender}: ${msg.text}`);
});
```
