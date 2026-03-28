import { config } from "../config";
import { generate } from "../minimax/llm";
import { textToSpeech } from "../minimax/tts";
import { analyzeImage } from "../minimax/vision";
import { sendText, sendWithVoice, type NormalizedMessage } from "../imessage/sdk";
import { logAgent } from "../memory/db";
import { SYSTEM_PROMPT, validateResponse, validateDraft, getTemporalVoice } from "./personality";
import { assembleContext } from "./context";

export type Intent = "task" | "email" | "schedule" | "person" | "photo" | "draft" | "general";

const INTENT_RULES: [RegExp, Intent][] = [
  [/\b(?:tasks?|todos?|focus|prioriti|urgent|what.*should|what.*next)/i, "task"],
  [/\b(?:emails?|inbox|unread|mails?|gmail|summar\w* emails?)/i, "email"],
  [/\b(?:calendar|schedule|meetings?|free at|busy|what time|standup|when\b.*\bis\b)/i, "schedule"],
  [/\b(?:draft|write\b.*\b(?:to|reply)|reply to|respond to|compose|response to)/i, "draft"],
  [/\b(?:who\b|what did \w+ (?:say|ask|send|want|need))/i, "person"],
];

const INTENT_HINTS: Record<Intent, string> = {
  task: "user is asking about tasks — prioritize actionable items with urgency and timing",
  email: "user is asking about email — triage, highlight action-needed, skip noise",
  schedule: "user is asking about their schedule — reference specific times, spot opportunities",
  person: "user is asking about a specific person — surface what they asked, owe, or need",
  draft: "user wants you to draft something — write the actual content, keep their voice",
  photo: "user sent a photo — describe what you see, extract actionable info",
  general: "",
};

export function classifyIntent(text: string): Intent {
  for (const [re, intent] of INTENT_RULES) if (re.test(text)) return intent;
  return "general";
}

const MAX_RETRIES = 2;

async function generateValidated(system: string, user: string): Promise<string> {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const raw = await generate(system, user);
    const cleaned = validateResponse(raw);
    if (cleaned.length >= 5) return cleaned;
    console.warn(`[handler] validation stripped too much (attempt ${i + 1}), retrying...`);
  }
  return "hmm, let me think on that";
}

export async function handleAgentMessage(msg: NormalizedMessage): Promise<void> {
  logAgent({ direction: "in", content: msg.text });

  try {
    const imageAtt = msg.attachments.find(a => /\.(jpe?g|png|gif|webp)$/i.test(a.path));
    const intent: Intent = imageAtt ? "photo" : classifyIntent(msg.text);
    const context = await assembleContext(intent, msg.text);
    const hint = INTENT_HINTS[intent];
    const system = SYSTEM_PROMPT.replace("{context}", context) + `\ntone: ${getTemporalVoice()}` + (hint ? `\nfocus: ${hint}` : "");

    let userContent = msg.text;
    if (imageAtt) {
      try {
        const analysis = await analyzeImage(imageAtt.path);
        userContent = `[user sent a photo: ${analysis}]${msg.text ? `\n\ntheir message: ${msg.text}` : ""}`;
      } catch (e) {
        console.warn("[handler] vision failed:", e);
        userContent = `[user sent a photo but i couldn't read it]${msg.text ? `\n\n${msg.text}` : ""}`;
      }
    }

    const response = intent === "draft"
      ? validateDraft(await generate(system, userContent))
      : await generateValidated(system, userContent);
    const audioPath = await sendWithVoice(config.AGENT_CHAT_IDENTIFIER, response, textToSpeech);

    logAgent({
      direction: "out",
      content: response,
      message_type: audioPath ? "voice" : "text",
      audio_path: audioPath ?? undefined,
    });
  } catch (err) {
    console.error("[handler] failed:", err);
    try {
      await sendText(config.AGENT_CHAT_IDENTIFIER, "something went wrong — try again in a sec");
      logAgent({ direction: "out", content: "(error fallback)", message_type: "text" });
    } catch (e) { console.error("[handler] fallback send failed:", e); }
  }
}
