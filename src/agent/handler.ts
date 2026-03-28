import { generate, generateJSON, generateWithTools } from "../minimax/llm";
import { analyzeImage } from "../minimax/vision";
import { sendText, sendBubbles, type NormalizedMessage } from "../imessage/sdk";
import { logAgent, resetDatabase, registerUser, getUserByPhone, getActiveUsers, updateUser, getTaskQueue, getTasksWithDetails, completeTaskByDescription, storeMessage } from "../memory/db";
import { checkUserConnected, getOAuthLinks } from "../integrations/composio";
import { SYSTEM_PROMPT, POST_HISTORY_ENFORCEMENT, validateResponse, validateDraft, getTemporalVoice } from "./personality";
import { TOOL_DEFS, createToolExecutor } from "./tools";
import { splitIntoBubbles } from "../imessage/bubble-split";
import { MessageBatcher } from "../imessage/batcher";
import { analyzeCalendar } from "../integrations/calendar";
import { analyzeGmail } from "../integrations/gmail";
import { setDemoMode, isDemoMode, setVirtualTime, now } from "../demo";
import { evaluate } from "./proactive/decision-engine";
import { rankTasks, formatRankedPlan } from "./ranking";
import { getCachedInsights } from "./crossref";
import { runExtractionOnce } from "../listener/extractor";

// --- Onboarding state ---

const MAX_USERS = 6;
const onboardConvo = new Map<string, string[]>();
const pendingOAuth = new Map<string, number>();

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// --- LLM Bouncer ---

const BOUNCER_PROMPT = `you're nudge. new number. you have a wall up — not a paywall, a vibe wall. u dont help just anyone

flow:
1. "who dis"
2. they respond → guess something about them. one line
3. get their name confirmed
4. ask one thing about how busy they are
5. name + role + busyness confirmed → "VERDICT: APPROVED" on its own line

voice:
- 1 sentence. max 8 words if possible
- lowercase no periods
- typed with one thumb while walking
- if they ask what u are: "wouldnt u like to know" or "someone who pays attention"
- roast > politeness

good responses: "who dis" / "u sound like a designer" / "inbox person or calendar person"
bad responses: anything over 12 words. anything with two questions. anything explaining what u do

{history}`;

const EXTRACT_PROFILE_PROMPT = `extract the user's profile from this conversation. return JSON:
{
  "name": "their first name (confirmed by them)",
  "profile": "what they do, how busy they are — one sentence",
  "email_heavy": true or false,
  "calendar_heavy": true or false
}
only use what they said. don't invent.`;

const REVEAL_PROMPT = `you just got access to someone's gmail and calendar. you're nudge — their new AI assistant who lives in iMessage.

look at this data and introduce yourself by flexing what you already know about them. surprise them. be specific — reference actual email senders, meeting names, patterns you notice.

rules:
- MAX 3 separate short messages. each one is 1 sentence
- first message: flex one specific thing you found (a name, a meeting, a pattern)
- second message: one more observation that shows you actually looked
- third message: "i'll keep an eye on things" or similar
- be cocky about how much you already know. don't list. don't summarize. just drop specifics casually

their name: {name}
their profile: {profile}

their email data:
{emails}

their calendar data:
{calendar}`;

// --- Onboarding handler ---

async function handleOnboarding(msg: NormalizedMessage): Promise<boolean> {
  const phone = msg.sender || msg.chatId;
  if (!phone) return false;

  let user = getUserByPhone(phone);
  if (!user) {
    registerUser(phone, msg.chatId);
    user = getUserByPhone(phone);
  }

  const stage = user?.onboard_stage ?? "new";

  // Already active
  if (stage === "active") return false;

  // Waiting for OAuth completion
  if (stage === "waiting_oauth") {
    // In demo mode, skip OAuth wait — assume already connected
    const status = isDemoMode() ? { gmail: true, calendar: true } : await checkUserConnected(phone);
    if (status.gmail || status.calendar) {
      updateUser(phone, { onboard_stage: "active" });
      const name = user?.name || "friend";

      await sendText(msg.chatId, `locked in, ${name.toLowerCase()}`);
      await sleep(1500);
      await sendText(msg.chatId, "give me a sec to look around...");
      await sleep(2000);

      // Post-OAuth reveal — scan their data and surprise them
      try {
        const [cal, gmail] = await Promise.allSettled([
          analyzeCalendar(phone),
          analyzeGmail(phone),
        ]);

        const calData = cal.status === "fulfilled" ? cal.value.insights : "no calendar data yet";
        const emailData = gmail.status === "fulfilled" ? gmail.value.insights : "no email data yet";

        const revealPrompt = REVEAL_PROMPT
          .replace("{name}", name)
          .replace("{profile}", user?.profile || "")
          .replace("{emails}", emailData)
          .replace("{calendar}", calData);

        const reveal = await generate(revealPrompt, "introduce yourself based on what you found");
        const bubbles = splitIntoBubbles(reveal.toLowerCase());
        const cleaned = bubbles.map(b => validateResponse(b)).filter(b => b.length > 5);
        if (cleaned.length) {
          await sendBubbles(msg.chatId, cleaned);
        }
      } catch (e) {
        console.warn("[handler] reveal failed:", e);
        await sendText(msg.chatId, "i'm in your inbox and calendar now. i'll keep things tight — you just do your thing");
      }

      return true;
    } else {
      await sendText(msg.chatId, "don't see it yet — make sure you finished both links");
      return true;
    }
  }

  // Bouncer conversation (new or evaluating)
  if (stage === "new" || stage === "evaluating") {
    if (getActiveUsers().filter((u: any) => u.onboard_stage === "active").length >= MAX_USERS) {
      await sendText(msg.chatId, "at capacity rn. try again later");
      return true;
    }

    if (!onboardConvo.has(phone)) onboardConvo.set(phone, []);
    const history = onboardConvo.get(phone)!;
    history.push(`them: ${msg.text}`);

    const system = BOUNCER_PROMPT.replace("{history}", history.join("\n"));
    const raw = await generate(system, msg.text);
    const approved = raw.includes("VERDICT: APPROVED");
    const response = raw.replace(/\n?VERDICT:\s*APPROVED\n?/gi, "").trim();

    if (approved) {
      const convoText = history.join("\n");
      const extracted = await generateJSON(EXTRACT_PROFILE_PROMPT, convoText);
      const name = extracted.name || "friend";
      const profile = extracted.profile || "";

      updateUser(phone, { name, profile, onboard_stage: "waiting_oauth" });
      console.log(`[handler] bouncer approved ${phone} as "${name}" — ${profile}`);

      if (response) {
        const bubbles = splitIntoBubbles(validateResponse(response));
        await sendBubbles(msg.chatId, bubbles);
        await sleep(1200);
      }

      await sendText(msg.chatId, `alright ${name.toLowerCase()}, two quick sign-ins`);
      await sleep(1200);

      const links = await getOAuthLinks(phone);
      if (links.gmail) { await sendText(msg.chatId, `gmail: ${links.gmail}`); await sleep(500); }
      if (links.calendar) { await sendText(msg.chatId, `calendar: ${links.calendar}`); await sleep(500); }
      await sendText(msg.chatId, "same google account for both. text me when you're done");

      pendingOAuth.set(phone, now());
      onboardConvo.delete(phone);
    } else {
      updateUser(phone, { onboard_stage: "evaluating" });
      const cleaned = validateResponse(response);
      if (cleaned) {
        const bubbles = splitIntoBubbles(cleaned);
        await sendBubbles(msg.chatId, bubbles);
        history.push(`nudge: ${cleaned}`);
      }
    }

    return true;
  }

  return false;
}

// --- Helpers ---

function buildSystem(context: string): string {
  return SYSTEM_PROMPT.replace("{context}", context)
    + `\ntone: ${getTemporalVoice()}`
    + `\n\n${POST_HISTORY_ENFORCEMENT}`;
}

// --- Tool guidance ---

const TOOL_GUIDANCE = `you have tools. use them to look things up before responding — don't guess.

when to use tools:
- user asks about schedule/meetings/availability → get_calendar
- user asks about email/inbox → get_emails
- user asks what to focus on or what's pending → get_tasks
- user mentions a person by name → get_person
- user asks to draft/write/reply to an email → get_emails first, then save_email_draft
- when connecting dots across sources → get_cross_insights
- when you need context on prior conversation → get_conversation

rules:
- save_email_draft saves a draft, does NOT send. never say you sent anything
- pull data before giving advice. don't make up events or emails
- you can call multiple tools
- keep your final response short — the tools give you info, you still text like a friend`;

// --- Main handler (called by batcher or directly) ---

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

async function processMessage(msg: NormalizedMessage): Promise<void> {
  const replyTo = msg.chatId;
  const phone = msg.sender || msg.chatId;
  const user = getUserByPhone(phone);
  const userId = user?.id;

  const text = msg.text?.trim() || "";

  // /reset
  if (/^\/?reset$/i.test(text)) {
    onboardConvo.delete(phone);
    pendingOAuth.delete(phone);
    resetDatabase();
    await sendText(replyTo, "reset. everything cleared");
    await sleep(600);
    await sendText(replyTo, "text me to start over");
    return;
  }

  // /demo — enable demo mode, pre-cache data
  if (/^\/?demo$/i.test(text)) {
    setDemoMode(true);
    analyzeCalendar(phone).catch(() => {});
    analyzeGmail(phone).catch(() => {});
    await sendText(replyTo, "demo mode on");
    return;
  }

  // /time HH:MM — set virtual clock, trigger proactive engine
  const timeMatch = text.match(/^\/?time\s+(\d{1,2}):(\d{2})$/i);
  if (timeMatch) {
    const h = parseInt(timeMatch[1]), m = parseInt(timeMatch[2]);
    const t = setVirtualTime(h, m);
    const label = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    await sendText(replyTo, `time set to ${label.toLowerCase()}`);
    if (userId) {
      const result = await evaluate("time_change", userId, replyTo, phone, `time jumped to ${label}`);
      console.log(`[handler] /time → engine: ${result.action} (${result.reason})`);
    }
    return;
  }

  // /important — housekeeping scan
  if (/^\/?important$/i.test(text)) {
    const [cal, gmail] = await Promise.all([analyzeCalendar(phone), analyzeGmail(phone)]);
    const tasks = getTaskQueue(userId);
    const prompt = `housekeeping check. compare current tasks against latest email and calendar. flag contradictions, new deadlines, or anything pressing.\n\ntasks: ${tasks.slice(0, 10).map((t: any) => t.description).join("; ")}\nemail: ${gmail.insights}\ncalendar: ${cal.insights}\ncross-ref: ${getCachedInsights()}`;
    const system = buildSystem("");
    const raw = await generate(system, prompt);
    const response = validateResponse(raw);
    await (response.length > 5
      ? sendBubbles(replyTo, splitIntoBubbles(response))
      : sendText(replyTo, "checked everything. nothing new rn"));
    logAgent({ direction: "out", content: response }, userId);
    return;
  }

  // /priority — ranked task plan
  if (/^\/?priority$/i.test(text)) {
    const tasks = getTasksWithDetails(userId);
    const cal = await analyzeCalendar(phone);
    const ranked = rankTasks(tasks, cal.freeBlocks);
    const plan = formatRankedPlan(ranked, cal.freeBlocks);
    const system = buildSystem(`current priority plan:\n${plan}`);
    const raw = await generate(system, "give the priority breakdown. be specific about times, order, and why");
    const response = validateResponse(raw);
    await sendBubbles(replyTo, splitIntoBubbles(response));
    logAgent({ direction: "out", content: response }, userId);
    return;
  }

  // /poll — force check all channels
  if (/^\/?poll$/i.test(text)) {
    if (userId) {
      const result = await evaluate("manual", userId, replyTo, phone, "manual poll — check everything");
      if (result.action === "silent") {
        await sendText(replyTo, "checked everything. nothing new rn");
      }
      console.log(`[handler] /poll → engine: ${result.action} (${result.reason})`);
    } else {
      await sendText(replyTo, "not set up yet. text me to get started");
    }
    return;
  }

  // Onboarding
  const handled = await handleOnboarding(msg);
  if (handled) return;

  // Skip empty / acknowledgments
  if (!msg.text && !msg.attachments.length) return;
  if (/^(ok|okay|k|got it|thanks|thx|ty|bet|cool|word|aight|nice)\.?$/i.test(msg.text?.trim() || "")) return;

  // Task completion detection
  const doneMatch = msg.text?.match(/(?:done|finished|completed|knocked out)\s+(?:with\s+)?(?:the\s+)?(.+)/i);
  if (doneMatch && userId) {
    const desc = doneMatch[1].trim();
    const result = completeTaskByDescription(desc, userId);
    if (result.found) {
      console.log(`[handler] task completed: "${desc}" → ${result.taskId}`);
    }
    // Fall through to normal LLM flow — it will see the updated task list and respond naturally
  }

  logAgent({ direction: "in", content: msg.text }, userId);

  try {
    const userContext = user?.name
      ? `you're talking to ${user.name}. ${user.profile || ""}\n\n${TOOL_GUIDANCE}`
      : TOOL_GUIDANCE;
    const system = buildSystem(userContext);

    let userContent = msg.text;
    const imageAtt = msg.attachments.find(a => /\.(jpe?g|png|gif|webp)$/i.test(a.path));
    if (imageAtt) {
      try {
        const analysis = await analyzeImage(imageAtt.path);
        userContent = `[user sent a photo: ${analysis}]${msg.text ? `\n\n${msg.text}` : ""}`;

        // Also extract tasks from the photo content (rubric → tasks, screenshot → action items)
        storeMessage({ chat_id: replyTo, sender: "photo", content: analysis, direction: "in", user_id: userId });
        runExtractionOnce(userId).then(count => {
          if (count) console.log(`[handler] photo → ${count} task(s) extracted`);
        }).catch(() => {});
      } catch (e) {
        userContent = `[photo — couldn't read it]${msg.text ? `\n\n${msg.text}` : ""}`;
      }
    }

    const executor = createToolExecutor(phone);
    const { text, toolsCalled } = await generateWithTools(system, userContent, TOOL_DEFS, executor);
    console.log(`[handler] tools: ${toolsCalled.length ? toolsCalled.join(", ") : "none"}`);

    const isDraft = toolsCalled.includes("save_email_draft");
    const response = isDraft ? validateDraft(text) : validateResponse(text);

    // Split into bubbles and send
    const bubbles = splitIntoBubbles(response);
    await sendBubbles(replyTo, bubbles);

    logAgent({ direction: "out", content: response, message_type: "text" }, userId);
    console.log(`[handler] → ${replyTo}: ${response.slice(0, 60)}`);
  } catch (err) {
    console.error("[handler] failed:", err);
    try { await sendText(replyTo, "something broke. try again in a sec"); } catch {}
  }
}

// --- Batcher: collects rapid-fire messages before processing ---

const batcher = new MessageBatcher(async (chatId, combinedText, raw) => {
  // Reconstruct a NormalizedMessage from the batched data
  const msg: NormalizedMessage = {
    ...raw,
    text: combinedText,
    chatId,
  };
  await processMessage(msg);
});

export async function handleAgentMessage(msg: NormalizedMessage): Promise<void> {
  const phone = msg.sender || msg.chatId;
  console.log(`[handler] ${phone}: ${msg.text?.slice(0, 60)}`);

  // Commands bypass batcher (immediate)
  if (/^\/?(?:reset|demo|time|important|priority|poll)\b/i.test(msg.text?.trim() || "")) {
    await processMessage(msg);
    return;
  }

  // Everything else goes through the batcher
  batcher.add(msg.chatId, msg.id, msg.text || "", msg);
}
