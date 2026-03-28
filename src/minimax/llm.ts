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

// --- Tool-calling generation ---

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>;

const MAX_TOOL_ROUNDS = 5;

export async function generateWithTools(
  system: string,
  user: string,
  tools: ToolDef[],
  executor: ToolExecutor,
): Promise<{ text: string; toolsCalled: string[] }> {
  const messages: any[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const toolsCalled: string[] = [];

  for (const model of MODELS) {
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const res = await client.chat.completions.create({
          model,
          messages,
          tools,
        });

        const choice = res.choices[0];
        if (!choice) break;

        // If no tool calls, we have the final response
        if (!choice.message.tool_calls?.length) {
          return { text: stripThinkTags(choice.message.content ?? ""), toolsCalled };
        }

        // Append assistant message with tool calls
        messages.push(choice.message);

        // Execute each tool call and append results
        for (const tc of choice.message.tool_calls) {
          const fn = (tc as any).function;
          if (!fn) continue;
          const name: string = fn.name;
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(fn.arguments); } catch {}
          toolsCalled.push(name);

          try {
            const result = await executor(name, args);
            messages.push({ role: "tool", tool_call_id: tc.id, content: result });
          } catch (err) {
            messages.push({ role: "tool", tool_call_id: tc.id, content: `error: ${(err as Error).message}` });
          }
        }
      }

      // Hit max rounds — get a final response without tools
      const final = await client.chat.completions.create({ model, messages });
      return { text: stripThinkTags(final.choices[0]?.message?.content ?? ""), toolsCalled };

    } catch (err) {
      console.warn(`[llm] tool-calling model ${model} failed, trying next...`);
    }
  }

  // All models failed — fall back to plain generation
  console.warn("[llm] all tool-calling models failed, falling back to plain generate");
  const fallback = await generate(system, user);
  return { text: fallback, toolsCalled: [] };
}
