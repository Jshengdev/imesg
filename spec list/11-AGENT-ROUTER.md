# Agent Router Module Specification

## Overview
The agent router (`src/agent/router.ts`) bridges the Photon SDK message format to the internal NormalizedMessage format and delegates to the agent handler.

## Dependencies
- Internal: `NormalizedMessage` from `../imessage/sdk`
- Internal: `handleAgentMessage` from `./handler`

## Public API

### `detectAttachmentType(path: string): string`
Detects attachment type from file extension.

**Parameters:**
- `path: string` - File path

**Returns:** `"image"` | `"audio"` | `"file"`

**Supported Extensions:**
- Images: `jpg`, `jpeg`, `png`, `gif`, `webp`, `heic`, `heif`
- Audio: `m4a`, `mp3`, `wav`, `aac`, `aiff`
- Default: `file`

### `agentProcess(msg: IMessage): Promise<void>`
Processes incoming SDK message.

**Parameters:**
- `msg: IMessage` - Raw message from Photon SDK

**Behavior:**
1. Logs received message with sender and truncated text
2. Converts SDK format to NormalizedMessage:
   - `id`: `msg.id` or `msg-${Date.now()}`
   - `chatId`: `msg.chatId`
   - `sender`: `msg.sender`
   - `text`: `msg.text` or empty string
   - `isFromMe`: `msg.isFromMe` or false
   - `isGroupChat`: false (default)
   - `timestamp`: `msg.timestamp` or current time
   - `attachments`: mapped from `msg.attachments`
3. Calls `handleAgentMessage(normalizedMsg)`
4. Catches and logs any errors with `[agent/router]` prefix

## Message Mapping

| SDK Field | Normalized Field | Default |
|-----------|------------------|---------|
| `msg.id` | `id` | `msg-${Date.now()}` |
| `msg.chatId` | `chatId` | - |
| `msg.sender` | `sender` | - |
| `msg.text` | `text` | "" |
| `msg.isFromMe` | `isFromMe` | false |
| - | `isGroupChat` | false |
| `msg.timestamp` | `timestamp` | `Date.now()` |
| `msg.attachments` | `attachments` | [] |

## Usage Example
```typescript
import { agentProcess } from './agent/router';
import { sdk } from '../imessage/sdk';

sdk.startWatching({
  onNewMessage: async (msg) => {
    if (msg.chatId === config.agentChatIdentifier) {
      await agentProcess(msg);
    }
  }
});
```
