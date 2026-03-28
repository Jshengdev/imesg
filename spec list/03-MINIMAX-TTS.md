# MiniMax TTS Module Specification

## Overview
The TTS module (`src/minimax/tts.ts`) converts text to speech using MiniMax's Speech 2.8 Turbo model with multi-endpoint fallback.

## Dependencies
- Node.js built-in modules: `fs`, `path`, `crypto`

## Architecture

### Audio Directory
- Location: `{cwd}/audio/`
- Created automatically with `recursive: true`

### Supported Endpoints (in order of preference)
1. `/v1/t2a_v2`
2. `/v1/text_to_speech`
3. `/v1/tts`

### Model
- `speech-2.8-turbo`

### Default Voice
- `male-qn-qingse`
- Emotion: configurable (default: `neutral`)

## Public API

### `textToSpeech(text: string, emotion?: string): Promise<string>`
Converts text to speech audio file.

**Parameters:**
- `text: string` - Text to convert to speech
- `emotion?: string` - Emotion setting (default: `"neutral"`)

**Returns:** Path to generated audio file (`.m4a` format)

**Behavior:**
1. Creates audio directory if not exists
2. Iterates through endpoints on failure
3. Converts hex-encoded audio to binary file
4. Returns placeholder silent file if all endpoints fail

**Audio Response Structure (MiniMax API):**
```json
{
  "base_resp": {
    "status_code": 0,
    "status_msg": "success"
  },
  "data": {
    "audio": "<hex-encoded-audio>"
  }
}
```

## File Naming
- Format: `{uuid}.m4a`
- Uses `crypto.randomUUID()`

## Error Handling
- Warnings logged for individual endpoint failures
- Final error logged if all endpoints fail
- Returns silent placeholder file (96 bytes hex-encoded) on complete failure

## Usage Example
```typescript
import { textToSpeech } from './minimax/tts';

const audioPath = await textToSpeech('Hello, how are you today?');
// Returns: /path/to/audio/550e8400-e29b-41d4-a716-446655440000.m4a

const audioWithEmotion = await textToSpeech('Wow, thats amazing!', 'happy');
```

## Error Recovery
When all TTS endpoints fail, a minimal valid M4A file is generated as fallback to prevent downstream errors:
```typescript
const SILENT_MP3 = Buffer.from(
  "fff3e004000000000000000000000000000000000000000000000000000000000000000000",
  "hex"
);
```
