# MiniMax TTS Module Specification

## Overview
The TTS module converts text to speech using MiniMax's Speech 2.8 Turbo model.

## Dependencies
- Node.js built-in: `fs`, `path`, `crypto`

## Architecture

### Audio Directory
- Location: `{cwd}/audio/`
- Created automatically

### Supported Endpoints
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
- `text: string` - Text to convert
- `emotion?: string` - Emotion setting (default: `neutral`)

**Returns:** Path to generated audio file (`.m4a`)

**Behavior:**
1. Creates audio directory if not exists
2. Iterates through endpoints on failure
3. Converts hex-encoded audio to binary
4. Returns silent placeholder if all fail

## Error Handling
- Warnings for individual endpoint failures
- Silent placeholder file on complete failure
