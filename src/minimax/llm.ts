import OpenAI from "openai";
import { config } from "../config";

export const client = new OpenAI({
  apiKey: config.MINIMAX_API_KEY,
  baseURL: `${config.MINIMAX_API_HOST}/v1`,
});

const MODELS = ["MiniMax-M2.7", "minimax-m2.7", "MiniMax-M2.7-highspeed"];

export function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function extractJSON(text: string): string {
  return text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? text;
}

async function complete(system: string, user: string, jsonMode = false): Promise<string> {
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res = await client.chat.completions.create({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        ...(jsonMode && { response_format: { type: "json_object" } }),
      });
      return stripThinkTags(res.choices[0]?.message?.content ?? "");
    } catch (err) {
      lastErr = err;
      console.warn(`minimax model ${model} failed, trying next...`);
    }
  }
  console.error("all minimax models failed:", lastErr);
  return jsonMode ? "{}" : "";
}

export async function generate(system: string, user: string): Promise<string> {
  return complete(system, user);
}

export async function generateJSON(system: string, user: string): Promise<any> {
  const raw = await complete(system, user, true);
  try { return JSON.parse(extractJSON(raw)); }
  catch { console.warn("minimax JSON parse failed"); return {}; }
}
