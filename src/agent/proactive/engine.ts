import { createHash } from "crypto";
import { wasRecentlySent, logProactive } from "../../memory/db";
import { generate } from "../../minimax/llm";
import { sendText } from "../../imessage/sdk";
import { SYSTEM_PROMPT, validateResponse, getTemporalVoice } from "../personality";
import { assembleContext } from "../context";

function checkGates(content: string, userId?: string): string | null {
  const hash = createHash("md5").update(content).digest("hex");
  if (wasRecentlySent(hash, 48 * 60, userId)) return null;
  return hash;
}

export async function sendProactive(triggerType: string, prompt: string, userId?: string, chatId?: string, phone?: string): Promise<void> {
  if (!chatId) return;

  const context = await assembleContext(undefined, undefined, phone, userId);
  const system = SYSTEM_PROMPT.replace("{context}", context) + `\ntone: ${getTemporalVoice()}`;
  const raw = await generate(system, prompt);
  const text = validateResponse(raw);
  if (text.length < 5) return;

  const hash = checkGates(text, userId);
  if (!hash) return;

  await sendText(chatId, text);
  logProactive(triggerType, hash, userId);
  console.log(`[proactive] sent ${triggerType} to ${chatId}: ${text.slice(0, 60)}...`);
}
