# MiniMax Vision Module Specification

## Overview
The Vision module analyzes images using MiniMax's M2.7 model with vision capabilities.

## Dependencies
- Node.js: `fs/promises`, `path`
- Internal: `client`, `stripThinkTags` from `./llm`

## Supported Image Formats

| Extension | MIME Type |
|-----------|-----------|
| `.jpg` | `image/jpeg` |
| `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |

Unknown extensions default to `image/jpeg`.

## Public API

### `analyzeImage(imagePath: string): Promise<string>`
Analyzes an image file and returns a text description.

**Parameters:**
- `imagePath: string` - Path to image file

**Returns:** Description of image content

**Behavior:**
1. Reads image file as buffer
2. Determines MIME type from extension
3. Converts to base64 data URI
4. Sends to MiniMax M2.7 model
5. Returns stripped response text

## Error Handling
- Returns `"couldn't analyze image"` on any failure
- Does not throw exceptions
