import { readFile } from "fs/promises";
import { extname } from "path";
import { client, stripThinkTags } from "./llm";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
};

const VISION_PROMPT = `READ ALL TEXT IN THIS IMAGE FIRST. transcribe every word you can see, then extract actionable items.

step 1: read every visible word, number, date, and label in the image
step 2: identify what type of content this is:
- assignment/rubric/syllabus → extract: each assignment name, percentage/weight, due date, requirements
- class schedule → extract: each class/event, day, time, location
- conversation screenshot → extract: who said what, any asks or deadlines mentioned
- whiteboard/notes → extract: key points, action items, any dates
- document/receipt → extract: amounts, dates, relevant details

step 3: return structured plain text with ALL specifics — every assignment name, every percentage, every date, every requirement. do not summarize or skip items. list them all.

if there are assignments: format each as "- [name]: [weight/percentage] — due [date] — [requirements]"
if no due dates visible, say "no due date listed"`;

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
