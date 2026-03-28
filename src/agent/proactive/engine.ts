import { createHash } from "crypto";
import { config } from "../../config";
import { countRecentProactive, wasRecentlySent, logProactive, getTriggerEngagement } from "../../memory/db";
import { generate } from "../../minimax/llm";
import { textToSpeech } from "../../minimax/tts";
import { sendWithVoice } from "../../imessage/sdk";
import { SYSTEM_PROMPT, validateResponse, getTemporalVoice } from "../personality";
import { assembleContext } from "../context";

let _engagementCache = new Map<string, number>();
let _engagementCacheTime = 0;

function getEngagementRate(triggerType: string): number {
  if (Date.now() - _engagementCacheTime > 30 * 60 * 1000) {
    _engagementCache.clear();
    for (const e of getTriggerEngagement(7)) {
      if (e.total >= 5) _engagementCache.set(e.trigger_type, e.rate);
    }
    _engagementCacheTime = Date.now();
  }
  return _engagementCache.get(triggerType) ?? 1;
}

function isQuietHours(): boolean {
  const h = new Date().getHours();
  const { QUIET_HOURS_START: s, QUIET_HOURS_END: e } = config;
  if (s === e) return false;
  return s < e ? (h >= s && h < e) : (h >= s || h < e);
}

function checkGates(content: string): string | null {
  if (isQuietHours()) return null;
  if (countRecentProactive(60) >= config.MAX_PROACTIVE_PER_HOUR) return null;
  const hash = createHash("md5").update(content).digest("hex");
  if (wasRecentlySent(hash, 48 * 60)) return null;
  return hash;
}

export async function sendProactive(triggerType: string, prompt: string): Promise<void> {
  const engRate = getEngagementRate(triggerType);
  if (engRate < 0.15 && Math.random() > 0.2) {
    console.log(`[proactive] dampening ${triggerType} (engagement: ${(engRate * 100).toFixed(0)}%)`);
    return;
  }

  const context = await assembleContext();
  const system = SYSTEM_PROMPT.replace("{context}", context) + `\ntone: ${getTemporalVoice()}`;
  const raw = await generate(system, prompt);
  const text = validateResponse(raw);
  if (text.length < 5) return;

  const hash = checkGates(text);
  if (!hash) return;

  await sendWithVoice(config.AGENT_CHAT_IDENTIFIER, text, textToSpeech);
  logProactive(triggerType, hash);
  console.log(`[proactive] sent ${triggerType}: ${text.slice(0, 60)}...`);
}
