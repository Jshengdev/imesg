import { readFile } from "fs/promises";
import { extname } from "path";
import { client, stripThinkTags } from "./llm";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};

const VISION_PROMPT = `extract everything actionable from this image. it could be:
- assignment rubric (extract: items, percentages, deadlines, requirements)
- screenshot of a conversation (extract: who said what, any asks or deadlines)
- schedule or syllabus (extract: dates, events, deadlines)
- notes or whiteboard (extract: key points, action items)
- receipt or document (extract: amounts, dates, relevant details)

return the extracted info as plain text, structured clearly. include specific numbers, dates, names, and percentages. if you see deadlines, state them explicitly.`;

export async function analyzeImage(imagePath: string): Promise<string> {
  try {
    const buf = await readFile(imagePath);
    const mime = MIME[extname(imagePath).toLowerCase()] ?? "image/jpeg";
    const dataUri = `data:${mime};base64,${buf.toString("base64")}`;

    const res = await client.chat.completions.create({
      model: "MiniMax-M2.7",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: VISION_PROMPT },
          { type: "image_url", image_url: { url: dataUri } },
        ],
      }],
    });

    const text = stripThinkTags(res.choices[0]?.message?.content ?? "");
    return text || "couldn't analyze image";
  } catch (err) {
    console.error("vision failed:", err);
    return "couldn't analyze image";
  }
}
