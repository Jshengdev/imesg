import { readFile } from "fs/promises";
import { extname } from "path";
import { client, stripThinkTags } from "./llm";

const mimeTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function analyzeImage(imagePath: string): Promise<string> {
  try {
    const buf = await readFile(imagePath);
    const mime = mimeTypes[extname(imagePath)] ?? "image/jpeg";
    const dataUri = `data:${mime};base64,${buf.toString("base64")}`;

    const res = await client.chat.completions.create({
      model: "MiniMax-M2.7",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What’s in this image?" },
            {
              type: "image_url",
              image_url: { url: dataUri },
            },
          ],
        },
      ],
    });

    const text = res.choices[0].message.content ?? "";
    return stripThinkTags(text);
  } catch (err) {
    console.error(`[vision] failed to analyze image`, err);
    return "couldn't analyze image";
  }
}