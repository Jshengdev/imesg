# MiniMax Vision Module Specification

## Overview
The Vision module (`src/minimax/vision.ts`) analyzes images using MiniMax's M2.7 model with vision capabilities.

## Dependencies
- Node.js built-in: `fs/promises`, `path`
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
- `imagePath: string` - Absolute or relative path to image file

**Returns:** Description of image content

**Behavior:**
1. Reads image file as buffer
2. Determines MIME type from extension
3. Converts to base64 data URI
4. Sends to MiniMax M2.7 model with vision support
5. Returns stripped response text

## Request Format
```typescript
{
  model: "MiniMax-M2.7",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Describe this image in detail. What do you see?" },
      { type: "image_url", image_url: { url: "<data:...base64...>" } }
    ]
  }]
}
```

## Error Handling
- Catches all errors and logs to console
- Returns `"couldn't analyze image"` on any failure
- Does not throw exceptions

## Usage Example
```typescript
import { analyzeImage } from './minimax/vision';

const description = await analyzeImage('/path/to/photo.jpg');
console.log(description);
// "A group of people sitting around a table during a meeting..."

const description2 = await analyzeImage('./images/receipt.png');
// "A receipt from Coffee Shop showing a latte for $4.50..."
```

## Performance Considerations
- Image is loaded entirely into memory as base64
- Large images may increase latency
- No image resizing performed (relies on MiniMax API limits)
