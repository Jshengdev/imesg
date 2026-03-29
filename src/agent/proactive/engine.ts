import { createHash } from "crypto";
import { wasRecentlySent, logProactive, logAgent, getRecentConversation } from "../../memory/db";
import { generate } from "../../minimax/llm";
import { sendText } from "../../imessage/sdk";
import { SYSTEM_PROMPT, validateResponse, getTemporalVoice } from "../personality";
import { assembleContext } from "../context";

function checkGates(content: string, userId?: string): string | null {
  const hash = createHash("md5").update(content).digest("hex");
  if (wasRecentlySent(hash, 48 * 60, userId)) return null;
  return hash;
}

const ACTION_TRIGGERS = new Set(["task_nudge", "email_alert", "email_escalation", "pre_meeting", "cross_source"]);

function getProactiveLabel(triggerType: string): string {
  if (ACTION_TRIGGERS.has(triggerType)) return "🚨 this one's a real one —";
  return "heads up, quick update —";
}

function getRecentProactiveMessages(userId?: string): string {
  const recent = getRecentConversation(10, userId);
  const outgoing = recent.filter(m => m.direction === "out").slice(0, 5);
  if (!outgoing.length) return "";
  return outgoing.map(m => m.content).join("\n");
}

const NO_REPEAT_INSTRUCTION = `
CRITICAL — before you write anything, check what you already told them (below). if you already covered this info:
- do NOT repeat it. instead say something like "same deal as before" or "nothing new since last time" and ONLY mention what changed or what deadline got closer
- if a deadline is now < 24hrs away that wasn't before, flag it: "oh also [thing] is tomorrow now"
- if literally nothing changed, just say "all good, same as earlier — just keep an eye on [the nearest deadline]"
- never info dump. one sentence if nothing changed. two max if a deadline shifted

what you already told them recently:
{recentMessages}`;

export async function sendProactive(triggerType: string, prompt: string, userId?: string, chatId?: string, phone?: string): Promise<void> {
  if (!chatId) return;

  const context = await assembleContext(undefined, undefined, phone, userId);
  const recentMessages = getRecentProactiveMessages(userId);
  const noRepeat = recentMessages
    ? NO_REPEAT_INSTRUCTION.replace("{recentMessages}", recentMessages)
    : "";
  const system = SYSTEM_PROMPT.replace("{context}", context)
    + `\ntone: ${getTemporalVoice()}`
    + noRepeat;
  const raw = await generate(system, prompt);
  const text = validateResponse(raw);
  if (text.length < 5) return;

  const hash = checkGates(text, userId);
  if (!hash) return;

  const label = getProactiveLabel(triggerType);
  await sendText(chatId, label);
  await sendText(chatId, text);
  logProactive(triggerType, hash, userId);
  logAgent({ direction: "out", content: `[${triggerType}] ${text}` }, userId);
  console.log(`[proactive] sent ${triggerType} (${label}) to ${chatId}: ${text.slice(0, 60)}...`);
}
