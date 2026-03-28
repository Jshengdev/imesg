import OpenAI from "openai";
import { MINIMAX_API_KEY, MINIMAX_API_HOST } from "../config";

const client = new OpenAI({
  apiKey: MINIMAX_API_KEY,
  baseURL: `${MINIMAX_API_HOST}/v1`,
});

const MODELS = ["MiniMax-M2.7", "minimax-m2.7", "MiniMax-M2.7-highspeed"];

const stripThinkTags = (text: string): string => {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
};

const extractJSON = (text: string): string => {
  const match = text.match(/```json\n([\s\S]*?)\n```/);
  return match ? match[1] : text;
};

const complete = async (
  system: string,
  user: string,
  jsonMode = false
): Promise<string> => {
  for (const model of MODELS) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        ...(jsonMode && { response_format: { type: "json_object" } }),
      });
      return stripThinkTags(completion.choices[0].message.content || "");
    } catch (error) {
      console.warn(`Model ${model} failed, trying next...`, error);
    }
  }
  return "";
};

const generate = async (system: string, user: string): Promise<string> => {
  return await complete(system, user);
};

const generateJSON = async (
  system: string,
  user: string
): Promise<Record<string, unknown>> => {
  const response = await complete(system, user, true);
  if (!response) return {};
  try {
    return JSON.parse(extractJSON(response));
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return {};
  }
};

export { generate, generateJSON, stripThinkTags, client };
