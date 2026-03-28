# Agent Router Module Specification

## Overview
The agent router bridges SDK message format to NormalizedMessage and delegates to handler.

## Dependencies
- Internal: `NormalizedMessage` from `../imessage/sdk`
- Internal: `handleAgentMessage` from `./handler`

## Public API

### `detectAttachmentType(path: string): string`
Detects attachment type from extension.

**Returns:** `"image"` | `"audio"` | `"file"`

**Extensions:**
- Images: jpg, jpeg, png, gif, webp, heic, heif
- Audio: m4a, mp3, wav, aac, aiff

### `agentProcess(msg: IMessage): Promise<void>`
Processes incoming SDK message.

**Behavior:**
1. Logs received message
2. Converts to NormalizedMessage
3. Calls `handleAgentMessage()`
4. Catches and logs errors
