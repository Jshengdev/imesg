# MiniMax LLM Module Specification

## Overview
The LLM module provides text generation using MiniMax's M2.7 model with fallback support and JSON mode.

## Dependencies
- `openai` - OpenAI-compatible client for MiniMax API

## Architecture

### Client Configuration
```typescript
baseURL: `${config.MINIMAX_API_HOST}/v1`
model: MiniMax-M2.7 (with fallback to minimax-m2.7, MiniMax-M2.7-highspeed)
```

### Supported Models
1. `MiniMax-M2.7`
2. `minimax-m2.7`
3. `MiniMax-M2.7-highspeed`

## Public API

### `stripThinkTags(text: string): string`
Removes `<think>...</think>` tags from model responses.

### `extractJSON(text: string): string`
Extracts JSON content from markdown code blocks.

### `generate(system: string, user: string): Promise<string>`
Generates text completion with system prompt and user input.

**Parameters:**
- `system: string` - System prompt
- `user: string` - User message

**Returns:** Generated text string

### `generateJSON(system: string, user: string): Promise<any>`
Generates JSON-formatted response.

## Error Handling
- Iterates through models on failure
- Returns empty string/object on all failures
