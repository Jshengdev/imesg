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
import { enableDemoMode, seedTasksForUser, DEMO_EMAILS, DEMO_CALENDAR, DEMO_FREE_BLOCKS } from "../demo-seed";
import { evaluate } from "./proactive/decision-engine";
import { rankTasks, formatRankedPlan } from "./ranking";
import { getCachedInsights } from "./crossref";
import { runExtractionOnce, extractTasksFromEmails } from "../listener/extractor";

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

const REVEAL_PROMPT = `you just got access to someone's gmail and calendar. you're nudge — lives in iMessage.

your job: write ONE message (the "clock" message). you're sizing them up. combine their name, personality, and what you found in their data to make a sharp, specific read on who they are as a person. not useful info — just proving you see them. like a friend who just glanced at your phone and already knows your whole deal.

rules:
- ONE message only. 2 sentences max
- reference something specific from their data that reveals WHO they are, not what's on their schedule
- be perceptive not helpful. you're clocking them, not briefing them
- example energy: "ah {name}, [specific observation that shows you get their vibe/situation]"
- lowercase, no periods, casual
- don't list anything. don't summarize. just read them

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

      await sendText(msg.chatId, "give me a sec to look around...");
      await sleep(2500);

      // In demo mode, seed tasks + people immediately
      const currentUserId = user?.id;
      if (isDemoMode() && currentUserId) {
        seedTasksForUser(currentUserId);
      }

      // Post-OAuth reveal — 3 beats: clock → got you → positioning
      try {
        // Use demo data if available, otherwise pull live
        let calData: string;
        let emailData: string;

        if (isDemoMode()) {
          emailData = DEMO_EMAILS.map(e => `${e.from}: ${e.subject} — ${e.snippet}`).join("\n");
          calData = DEMO_CALENDAR.map(e => `${e.start}-${e.end}: ${e.title}${e.attendees.length ? ` (with ${e.attendees.join(", ")})` : ""}`).join("\n");
        } else {
          const [cal, gmail] = await Promise.allSettled([
            analyzeCalendar(phone),
            analyzeGmail(phone),
          ]);
          calData = cal.status === "fulfilled" ? cal.value.insights : "no calendar data yet";
          emailData = gmail.status === "fulfilled" ? gmail.value.insights : "no email data yet";

          // Extract tasks from emails
          if (gmail.status === "fulfilled" && gmail.value.emails.length) {
            extractTasksFromEmails(gmail.value.emails, currentUserId).catch(() => {});
          }
        }

        // Beat 1: "Clock you" — sharp read on who they are
        const revealPrompt = REVEAL_PROMPT
          .replace("{name}", name)
          .replace("{profile}", user?.profile || "")
          .replace("{emails}", emailData)
          .replace("{calendar}", calData);

        const clockMsg = await generate(revealPrompt, "size them up in one message");
        const cleanedClock = validateResponse(clockMsg.toLowerCase());
        if (cleanedClock.length > 5) {
          await sendText(msg.chatId, cleanedClock);
        }
        await sleep(2000);

        // Beat 2: "I got you" — proactive + commands
        const gotYouPrompt = `you're nudge. you just clocked someone and now you're telling them what you can do. but the vibe is "don't worry, i'm already watching" not "here's a feature list"

write ONE message. structure:
- start with something like "don't trip though" or "but you don't gotta do anything"
- mention you're proactively keeping an eye on their calendar, inbox, and tasks
- casually drop that they can text you things like "what's on my calendar", "check my email", "what should i focus on", or send you photos of assignments
- end with "but honestly i'll probably hit you up first"

rules:
- one message, 2-3 sentences max
- lowercase, no periods, casual
- don't number things or use bullet points
- make it sound like a friend explaining their deal, not a product tour`;

        const gotYouMsg = await generate(gotYouPrompt, "tell them what you do");
        const cleanedGotYou = validateResponse(gotYouMsg.toLowerCase());
        if (cleanedGotYou.length > 5) {
          await sendText(msg.chatId, cleanedGotYou);
        }
        await sleep(2000);

        // Beat 3: "Positioning lock" — secretary you always wanted, tied to their context
        const positionPrompt = `you're nudge. you just told someone what you can do. now lock the positioning.

the user is: ${name}, ${user?.profile || "busy person"}
their calendar: ${calData.slice(0, 200)}
their email: ${emailData.slice(0, 200)}

write ONE message that:
- frames this as "you just unlocked the secretary you've always wanted" (or a variation that fits their context)
- ties it specifically to THEIR situation — reference something concrete about their life that makes this feel built for them
- make them feel like this is exactly what they needed at exactly the right time

rules:
- one message, 1-2 sentences
- lowercase, no periods, casual
- should feel like a closing line that makes them go "damn, yeah actually"
- don't be generic. connect it to their actual data`;

        const positionMsg = await generate(positionPrompt, "lock the positioning");
        const cleanedPosition = validateResponse(positionMsg.toLowerCase());
        if (cleanedPosition.length > 5) {
          await sendText(msg.chatId, cleanedPosition);
        }
      } catch (e) {
        console.warn("[handler] reveal failed:", e);
        await sendText(msg.chatId, "i see you. don't worry about keeping track of everything — that's my job now");
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
- user asks to draft/write/reply to an email → MUST call get_emails first to find the sender's email address, then MUST call save_email_draft with to, subject, body. do NOT say "draft saved" without actually calling save_email_draft
- user asks to send an email → MUST call send_email with to, subject, body
- user wants to block calendar time → MUST call block_time with title and duration
- when connecting dots across sources → get_cross_insights
- when you need context on prior conversation → get_conversation

CRITICAL rules:
- NEVER say you did something without calling the tool. if you say "draft saved" you MUST have called save_email_draft. if you say "blocked" you MUST have called block_time
- save_email_draft saves a draft, does NOT send. never say you sent anything
- pull data before giving advice. don't make up events or emails
- you can call multiple tools in sequence
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

  // /demo — enable demo mode, bouncer still runs naturally
  if (/^\/?demo$/i.test(text)) {
    enableDemoMode();
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
    await sleep(1500);

    if (isDemoMode() && userId) {
      // In demo mode, generate a context-aware proactive message using seeded tasks
      const tasks = getTaskQueue(userId);
      const taskList = tasks.slice(0, 6).map((t: any) => `- ${t.description} (urgency ${t.urgency}, ~${t.estimated_minutes}min, due: ${t.deadline || "no deadline"})`).join("\n");

      const timePrompt = `you're nudge. the time is now ${label}. here are the user's tasks:\n${taskList}\n\ncalendar context:\n- NVSC Venture Comp Training: 9:00 AM - 12:30 PM\n- Trae.ai x MiniMax Hackathon: 10:00 AM - 10:00 PM\n- COMM 410 Class: 2:00 PM - 3:30 PM\n- Devpost hackathon submission due: 6:30 PM\n\nbased on the current time, send a proactive message:\n- flag any deadline that's < 60 min away with urgency\n- after flagging the immediate thing, mention what comes AFTER and suggest blocking specific time for it\n- if offering to block time, say "want me to block [time range] for [task]?" so they can just say yes\n- be specific with times, not vague\n- 2-3 sentences max, casual, lowercase`;

      const system = buildSystem("");
      const raw = await generate(system, timePrompt);
      const response = validateResponse(raw);
      const isAction = tasks.some((t: any) => t.urgency >= 4);
      const label2 = isAction ? "🚨 this one's a real one —" : "heads up, quick update —";
      await sendText(replyTo, label2);
      await sleep(800);
      await sendBubbles(replyTo, splitIntoBubbles(response));
      logAgent({ direction: "out", content: `[time_${label}] ${response}` }, userId);
    } else if (userId) {
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

  // /priority — ranked task plan with calendar blocking offer
  if (/^\/?priority$/i.test(text)) {
    const tasks = getTasksWithDetails(userId);
    if (!tasks.length) {
      await sendText(replyTo, "no tasks yet — text me what you're working on or send me a screenshot and i'll build your list");
      return;
    }
    let cal;
    try {
      cal = await analyzeCalendar(phone);
    } catch {
      cal = { events: [], freeBlocks: [], insights: "", actionItems: [], tags: [] };
    }
    const ranked = rankTasks(tasks, cal.freeBlocks || []);
    const plan = formatRankedPlan(ranked, cal.freeBlocks || []);
    // Use demo free blocks as fallback if live calendar is empty
    const hasLiveBlocks = (cal.freeBlocks || []).length > 0;
    const freeBlockSummary = hasLiveBlocks
      ? cal.freeBlocks.map((b: any) => `${b.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}-${b.end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} (${b.durationMin}min)`).join(", ")
      : isDemoMode()
        ? DEMO_FREE_BLOCKS.map(b => `${b.label} (${b.durationMin}min)`).join(", ")
        : "no free blocks today";
    const system = buildSystem(`current priority plan:\n${plan}\n\nfree blocks: ${freeBlockSummary}`);
    const raw = await generate(system, "list the top 5 tasks in order. for each one: task name, how long it takes, and when its due. keep each one to ONE short line. at the end ask 'want me to block these off on your calendar?' — thats it, no extra commentary");
    const response = validateResponse(raw);
    await sendBubbles(replyTo, splitIntoBubbles(response));
    logAgent({ direction: "out", content: response }, userId);
    return;
  }

  // /poll — force check all channels
  if (/^\/?poll$/i.test(text)) {
    if (userId) {
      const result = await evaluate("manual", userId, replyTo, phone, "manual poll — check everything");
      if (result.action === "silent" || result.action === "queue") {
        await sendText(replyTo, "checked everything — nothing new since last time, you're good");
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

    // Detect image: check attachments OR the replacement character (image without caption)
    const imageAtt = msg.attachments.find(a =>
      /\.(jpe?g|png|gif|webp|heic|tiff?)$/i.test(a.path) ||
      (a.mimeType && a.mimeType.startsWith("image/"))
    );
    const hasImageMarker = (msg.text || "").includes("\ufffc") || (msg.text || "").includes("￼");

    if (imageAtt || (hasImageMarker && msg.attachments.length > 0)) {
      const att = imageAtt || msg.attachments[0];
      console.log(`[handler] image detected: path="${att.path}" mime="${att.mimeType}" attachments=${msg.attachments.length}`);

      // Send immediate "looking at it" feedback
      await sendText(replyTo, "got the photo, give me a sec to read it...");

      if (att.path) {
        try {
          const analysis = await analyzeImage(att.path);
          console.log(`[handler] vision result: ${analysis.slice(0, 200)}`);

          // Store and extract tasks from photo
          storeMessage({ chat_id: replyTo, sender: "photo", content: analysis, direction: "in", user_id: userId });
          const taskCount = await runExtractionOnce(userId);
          console.log(`[handler] photo → ${taskCount} task(s) extracted`);

          // Give LLM the analysis + user profile for mismatch detection
          const profileHint = user?.profile ? `\n\n[context: this user is ${user.name}, ${user.profile}. if this doesn't match their field/major, be playful about it — "i'll add it but i don't think this is yours!" then confirm you added the tasks]` : "";
          userContent = `[user sent a photo and i extracted this: ${analysis}]\n\n[i found ${taskCount} task(s) and added them to your priority list]${profileHint}`;
        } catch (e) {
          console.error(`[handler] vision failed:`, e);
          userContent = "[photo came through but i couldn't read it clearly — tell them what's on it]";
        }
      } else {
        console.warn(`[handler] attachment found but no path — raw:`, JSON.stringify(msg.attachments));
        userContent = "[user sent a photo but the file path was empty — ask them to resend it]";
      }
    } else if (hasImageMarker && msg.attachments.length === 0) {
      console.warn(`[handler] replacement char detected but no attachments found`);
      userContent = "[user tried to send a photo but it didn't come through — ask them to resend]";
    }

    console.log(`[handler] creating tool executor with phone=${phone}`);
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
