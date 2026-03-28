import { generate } from "../minimax/llm";
import { analyzeImage } from "../minimax/vision";
import { sendText, type NormalizedMessage } from "../imessage/sdk";
import { logAgent, resetDatabase, registerUser, getUserByPhone, getActiveUsers } from "../memory/db";
import { checkUserConnected, getOAuthLinks } from "../integrations/composio";
import { SYSTEM_PROMPT, POST_HISTORY_ENFORCEMENT, validateResponse, validateDraft, getTemporalVoice } from "./personality";
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

// --- User onboarding ---

const MAX_USERS = 6;
const onboardedUsers = new Set<string>();
const pendingOAuth = new Map<string, { gmail?: string; calendar?: string; sentAt: number }>();

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function getOrCreateUserId(phone: string, chatId: string): string {
  let user = getUserByPhone(phone);
  if (!user) {
    registerUser(phone, chatId);
    user = getUserByPhone(phone);
  }
  return user?.id ?? phone;
}

async function handleOnboarding(msg: NormalizedMessage): Promise<boolean> {
  const phone = msg.sender || msg.chatId;
  if (!phone) return false;

  // User says "done" after OAuth
  if (pendingOAuth.has(phone) && /\b(done|connected|signed in|logged in|ready|finished|yes|yep|yea|yeah)\b/i.test(msg.text)) {
    const status = await checkUserConnected(phone);
    if (status.gmail || status.calendar) {
      onboardedUsers.add(phone);
      pendingOAuth.delete(phone);
      await sendText(msg.chatId, "nice, you're in");
      await sleep(1200);
      await sendText(msg.chatId, "i can see your calendar and email now. ask me anything — \"what should i focus on\", \"check my email\", send me a photo, whatever");
      return true;
    } else {
      await sendText(msg.chatId, "hmm don't see it yet. make sure you clicked both links and finished signing in with google");
      return true;
    }
  }

  // Already onboarded
  if (onboardedUsers.has(phone)) return false;

  // Check if already connected from a previous session
  const status = await checkUserConnected(phone);
  if (status.gmail || status.calendar) {
    onboardedUsers.add(phone);
    return false;
  }

  // Capacity check
  if (getActiveUsers().length >= MAX_USERS && !onboardedUsers.has(phone)) {
    await sendText(msg.chatId, "hey — at capacity rn (6 users max). try again later");
    return true;
  }

  // New user — conversational onboarding
  console.log(`[handler] new user ${phone} — onboarding`);
  const links = await getOAuthLinks(phone);
  if (!links.gmail && !links.calendar) {
    await sendText(msg.chatId, "yo something broke on my end. text me again in a sec");
    return true;
  }

  await sendText(msg.chatId, "hey, i'm nudge");
  await sleep(1500);
  await sendText(msg.chatId, "i read your calendar and email so i can tell you what actually matters. two quick google sign-ins and you're set");
  await sleep(2000);

  if (links.gmail) {
    await sendText(msg.chatId, `1) gmail: ${links.gmail}`);
    await sleep(600);
  }
  if (links.calendar) {
    await sendText(msg.chatId, `2) calendar: ${links.calendar}`);
    await sleep(600);
  }

  await sendText(msg.chatId, "same google account for both. text me \"done\" when you're through");
  pendingOAuth.set(phone, { ...links, sentAt: Date.now() });
  return true;
}

// --- Main handler ---

const MAX_RETRIES = 2;

async function generateValidated(system: string, user: string): Promise<string> {
  for (let i = 0; i <= MAX_RETRIES; i++) {
    const raw = await generate(system, user);
    const cleaned = validateResponse(raw);
    if (cleaned.length >= 5) return cleaned;
    console.warn(`[handler] validation stripped too much (attempt ${i + 1}), retrying...`);
  }
  return "hmm let me think on that";
}

export async function handleAgentMessage(msg: NormalizedMessage): Promise<void> {
  const replyTo = msg.chatId;
  const phone = msg.sender || msg.chatId;
  console.log(`[handler] ${phone}: ${msg.text?.slice(0, 60)}`);

  // /reset — wipe everything
  if (/^\/?reset$/i.test(msg.text?.trim() || "")) {
    console.log(`[handler] /reset from ${phone}`);
    onboardedUsers.delete(phone);
    pendingOAuth.delete(phone);
    resetDatabase();
    await sendText(replyTo, "reset done. everything cleared");
    await sleep(800);
    await sendText(replyTo, "text me anything to start over");
    return;
  }

  // Register user in DB + get userId
  const userId = getOrCreateUserId(phone, replyTo);

  // Onboarding check
  const handled = await handleOnboarding(msg);
  if (handled) return;

  // Skip non-messages
  if (!msg.text && !msg.attachments.length) return;

  // Skip acknowledgments
  if (/^(ok|okay|k|got it|thanks|thx|ty|bet|cool|word|aight|nice)\.?$/i.test(msg.text?.trim() || "")) return;

  logAgent({ direction: "in", content: msg.text }, userId);

  try {
    const imageAtt = msg.attachments.find(a => /\.(jpe?g|png|gif|webp)$/i.test(a.path));
    const intent: Intent = imageAtt ? "photo" : classifyIntent(msg.text);
    const context = await assembleContext(intent, msg.text, phone, userId);
    const hint = INTENT_HINTS[intent];

    const system = SYSTEM_PROMPT.replace("{context}", context)
      + `\ntone: ${getTemporalVoice()}`
      + (hint ? `\nfocus: ${hint}` : "")
      + `\n\n${POST_HISTORY_ENFORCEMENT}`;

    let userContent = msg.text;
    if (imageAtt) {
      try {
        const analysis = await analyzeImage(imageAtt.path);
        userContent = `[user sent a photo: ${analysis}]${msg.text ? `\n\ntheir message: ${msg.text}` : ""}`;
      } catch (e) {
        console.warn("[handler] vision failed:", e);
        userContent = `[user sent a photo but couldn't read it]${msg.text ? `\n\n${msg.text}` : ""}`;
      }
    }

    const response = intent === "draft"
      ? validateDraft(await generate(system, userContent))
      : await generateValidated(system, userContent);

    await sendText(replyTo, response);
    logAgent({ direction: "out", content: response, message_type: "text" }, userId);
    console.log(`[handler] → ${replyTo}: ${response.slice(0, 60)}`);
  } catch (err) {
    console.error("[handler] failed:", err);
    try {
      await sendText(replyTo, "something broke. try again in a sec");
    } catch (e) { console.error("[handler] fallback failed:", e); }
  }
}
