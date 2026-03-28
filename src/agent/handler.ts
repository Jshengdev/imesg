import { generate, generateJSON, generateWithTools } from "../minimax/llm";
import { analyzeImage } from "../minimax/vision";
import { sendText, type NormalizedMessage } from "../imessage/sdk";
import { logAgent, resetDatabase, registerUser, getUserByPhone, getActiveUsers, updateUser } from "../memory/db";
import { checkUserConnected, getOAuthLinks } from "../integrations/composio";
import { SYSTEM_PROMPT, POST_HISTORY_ENFORCEMENT, validateResponse, validateDraft, getTemporalVoice } from "./personality";
import { TOOL_DEFS, createToolExecutor } from "./tools";

// --- Onboarding state ---

const MAX_USERS = 6;
const onboardConvo = new Map<string, string[]>(); // phone → conversation history
const pendingOAuth = new Map<string, number>(); // phone → sentAt timestamp

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// --- LLM Bouncer: evaluates if user has shared enough to be worth assisting ---

const BOUNCER_PROMPT = `you're nudge. someone just texted you. you don't know them yet.

your vibe: "who dis" energy. you're chill but you don't just help anyone. you want to know who they are first.

the flow:
1. first message from them → respond with something like "who dis" or "new phone who dis" or "yo who's this"
2. they say something → try to guess their name or what they do based on vibes. be playful about it. "you sound like a sarah" or "lemme guess... cs major?"
3. keep guessing / chatting until they confirm their name
4. once you know their name → ask what keeps them busy. are they swamped? do they live in their inbox? calendar packed? do they forget stuff?
5. once you have: their name (confirmed) + what they do + how busy they are → say EXACTLY "VERDICT: APPROVED" on its own line at the end of your message

rules:
- ONE message at a time. short. lowercase. texting energy
- never explain what nudge is or what you do. if they ask, just say "i help busy people stay on top of their shit"
- never sound like a bot. never say "how can i help you" or "what brings you here"
- be funny. roast a little. the gatekeeping IS the charm
- if they just say "hey" or "yo" back, that's fine — just keep vibing and probing
- DON'T approve until you have: confirmed first name + what they do + sense of how busy/chaotic they are

conversation so far:
{history}`;

const EXTRACT_PROFILE_PROMPT = `extract the user's profile from this onboarding conversation. return JSON:
{
  "name": "their first name (confirmed by them, not your guess)",
  "profile": "what they do, how busy they are, whether they use email/calendar heavily — one or two sentences max",
  "email_heavy": true or false,
  "calendar_heavy": true or false
}
only use what they actually said or confirmed. don't make stuff up.`;

async function handleOnboarding(msg: NormalizedMessage): Promise<boolean> {
  const phone = msg.sender || msg.chatId;
  if (!phone) return false;

  // Get or create user
  let user = getUserByPhone(phone);
  if (!user) {
    registerUser(phone, msg.chatId);
    user = getUserByPhone(phone);
  }

  const stage = user?.onboard_stage ?? "new";

  // Already fully onboarded
  if (stage === "active") return false;

  // Stage: waiting_oauth — they clicked links, checking if connected
  if (stage === "waiting_oauth") {
    const status = await checkUserConnected(phone);
    if (status.gmail || status.calendar) {
      updateUser(phone, { onboard_stage: "active" });
      const name = user?.name || "friend";
      await sendText(msg.chatId, `locked in, ${name.toLowerCase()}`);
      await sleep(1200);
      await sendText(msg.chatId, "i can see your calendar and email now. try \"what should i focus on\" or \"check my email\"");
      return true;
    } else {
      await sendText(msg.chatId, "don't see it yet — make sure you finished signing in on both links");
      return true;
    }
  }

  // Stage: new or evaluating — bouncer conversation
  if (stage === "new" || stage === "evaluating") {
    // Capacity check
    if (getActiveUsers().filter(u => u.onboard_stage === "active").length >= MAX_USERS) {
      await sendText(msg.chatId, "at capacity rn. try again later");
      return true;
    }

    // Build conversation history
    if (!onboardConvo.has(phone)) onboardConvo.set(phone, []);
    const history = onboardConvo.get(phone)!;
    history.push(`them: ${msg.text}`);

    // Run bouncer LLM
    const system = BOUNCER_PROMPT.replace("{history}", history.join("\n"));
    const raw = await generate(system, msg.text);
    const approved = raw.includes("VERDICT: APPROVED");

    // Clean the response — remove the VERDICT line
    const response = raw.replace(/\n?VERDICT:\s*APPROVED\n?/gi, "").trim();

    if (approved) {
      // Extract name + profile from conversation
      const convoText = history.join("\n");
      const extracted = await generateJSON(EXTRACT_PROFILE_PROMPT, convoText);
      const name = extracted.name || "friend";
      const profile = extracted.profile || "";

      updateUser(phone, { name, profile, onboard_stage: "waiting_oauth" });
      console.log(`[handler] bouncer approved ${phone} as "${name}" — ${profile}`);

      // Send approval + OAuth links
      if (response) {
        await sendText(msg.chatId, validateResponse(response));
        await sleep(1500);
      }

      await sendText(msg.chatId, `alright ${name.toLowerCase()}, two quick google sign-ins and i'm yours`);
      await sleep(1500);

      const links = await getOAuthLinks(phone);
      if (links.gmail) {
        await sendText(msg.chatId, `gmail: ${links.gmail}`);
        await sleep(600);
      }
      if (links.calendar) {
        await sendText(msg.chatId, `calendar: ${links.calendar}`);
        await sleep(600);
      }
      await sendText(msg.chatId, "same google account for both. text me when you're done");
      pendingOAuth.set(phone, Date.now());
      onboardConvo.delete(phone);
      history.push(`nudge: ${response}`);
    } else {
      // Still evaluating — send bouncer response
      updateUser(phone, { onboard_stage: "evaluating" });
      const cleaned = validateResponse(response);
      if (cleaned) {
        await sendText(msg.chatId, cleaned);
        history.push(`nudge: ${cleaned}`);
      }
    }

    return true;
  }

  return false;
}

// --- Tool guidance ---

const TOOL_GUIDANCE = `you have tools. use them to look things up before responding — don't guess.

when to use tools:
- user asks about schedule/meetings/availability → get_calendar
- user asks about email/inbox → get_emails
- user asks what to focus on or what's pending → get_tasks
- user mentions a person by name → get_person
- user asks to draft/write/reply to an email → get_emails first (for context), then save_email_draft. tell them "saved a draft in your gmail" after
- when connecting dots across sources → get_cross_insights
- when you need context on prior conversation → get_conversation

rules:
- save_email_draft saves a draft. it does NOT send the email. never tell the user you sent anything
- pull data before giving advice. don't make up calendar events or emails
- you can call multiple tools if needed
- keep your final response short and casual — the tools give you info, but you still text like a friend`;

// --- Main handler ---

export function classifyIntent(text: string): string {
  const rules: [RegExp, string][] = [
    [/\b(?:tasks?|todos?|focus|prioriti|urgent|what.*should|what.*next)/i, "task"],
    [/\b(?:emails?|inbox|unread|mails?|gmail|summar\w* emails?)/i, "email"],
    [/\b(?:calendar|schedule|meetings?|free at|busy|what time|standup|when\b.*\bis\b)/i, "schedule"],
    [/\b(?:draft|write\b.*\b(?:to|reply)|reply to|respond to|compose|response to)/i, "draft"],
    [/\b(?:who\b|what did \w+ (?:say|ask|send|want|need))/i, "person"],
  ];
  for (const [re, intent] of rules) if (re.test(text)) return intent;
  return "general";
}

export async function handleAgentMessage(msg: NormalizedMessage): Promise<void> {
  const replyTo = msg.chatId;
  const phone = msg.sender || msg.chatId;
  console.log(`[handler] ${phone}: ${msg.text?.slice(0, 60)}`);

  // /reset — wipe everything
  if (/^\/?reset$/i.test(msg.text?.trim() || "")) {
    console.log(`[handler] /reset from ${phone}`);
    onboardConvo.delete(phone);
    pendingOAuth.delete(phone);
    resetDatabase();
    await sendText(replyTo, "reset done. everything cleared");
    await sleep(800);
    await sendText(replyTo, "text me anything to start over");
    return;
  }

  // Onboarding check
  const handled = await handleOnboarding(msg);
  if (handled) return;

  // Skip non-messages
  if (!msg.text && !msg.attachments.length) return;

  // Skip acknowledgments
  if (/^(ok|okay|k|got it|thanks|thx|ty|bet|cool|word|aight|nice)\.?$/i.test(msg.text?.trim() || "")) return;

  // Get user for personalized context
  const user = getUserByPhone(phone);
  const userId = user?.id;
  const userName = user?.name;

  logAgent({ direction: "in", content: msg.text }, userId);

  try {
    // Build system prompt with user identity
    let userContext = TOOL_GUIDANCE;
    if (userName) userContext = `you're talking to ${userName}. ${user?.profile || ""}\n\n` + userContext;

    const system = SYSTEM_PROMPT.replace("{context}", userContext)
      + `\ntone: ${getTemporalVoice()}`
      + `\n\n${POST_HISTORY_ENFORCEMENT}`;

    // Handle image attachments
    let userContent = msg.text;
    const imageAtt = msg.attachments.find(a => /\.(jpe?g|png|gif|webp)$/i.test(a.path));
    if (imageAtt) {
      try {
        const analysis = await analyzeImage(imageAtt.path);
        userContent = `[user sent a photo: ${analysis}]${msg.text ? `\n\ntheir message: ${msg.text}` : ""}`;
      } catch (e) {
        console.warn("[handler] vision failed:", e);
        userContent = `[user sent a photo but couldn't read it]${msg.text ? `\n\n${msg.text}` : ""}`;
      }
    }

    // LLM with tool calling
    const executor = createToolExecutor(phone);
    const { text, toolsCalled } = await generateWithTools(system, userContent, TOOL_DEFS, executor);

    console.log(`[handler] tools called: ${toolsCalled.length ? toolsCalled.join(", ") : "none"}`);

    const isDraft = toolsCalled.includes("save_email_draft");
    const response = isDraft ? validateDraft(text) : validateResponse(text);

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
