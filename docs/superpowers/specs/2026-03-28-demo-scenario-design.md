# Nudge Demo Scenario — Student Day

## Overview

A 2-minute screen recording showing a college student (Teri) whose day is managed by Nudge. Real data from real people — friends send actual emails, texts, and calendar events. The climax: a professor emails about a deadline at the same moment a teammate texts about the same project. Nudge synthesizes both into one casual text before Teri even opens her inbox.

**Core thesis:** Nudge reorganizes your priorities using your Gmail, Calendar, and what people text you — all without you explicitly telling it to save anything.

---

## Two-Mac Architecture

```
Teri's Mac (listener)                  Agent Mac (+16267221956)
┌──────────────────────┐              ┌──────────────────────────┐
│  listener/index.ts    │   HTTP POST │  src/server.ts            │
│                       │ ──────────▶ │    → store in messages DB │
│  Photon SDK watches   │ port 3456   │    → extract tasks        │
│  ALL of Teri's chats  │             │    → decision engine:     │
│                       │             │      urgency vs disruption│
│  Filters out agent    │             │                           │
│  chat (+1626...)      │             │  Nudge agent responds     │
│                       │             │  in agent chat to Teri    │
│  Batches every 3s     │             │                           │
│  POSTs raw messages   │             │  Email + Calendar via     │
│                       │             │  Composio OAuth           │
└──────────────────────┘              └───────────────────────────┘
       WiFi ←───────── same network ──────────→ WiFi
```

**Listener** (Teri's Mac): watches her Messages database, forwards raw texts from mom/Sarah/groupmates to the agent over HTTP. Never responds. Never runs LLM. ~100 lines of code.

**Agent** (your Mac): receives listener data, pulls Gmail + Calendar via Composio, runs decision engine, responds to Teri in the agent chat via iMessage.

---

## Demo Commands

Six commands for demo control. These are harness, not user features.

### `/demo`
Sets demo mode. Pre-caches calendar + email in background. Skips OAuth wait (OAuth must already be done before demo day). Bouncer still runs normally.

### `/time HH:MM`
Sets virtual clock. All time-dependent code uses this. Immediately runs the decision engine at the new time. Enables fast-forwarding through a day.

### `/important`
On-demand housekeeping scan. Reads emails, cross-refs against tasks + calendar, flags contradictions or pressing changes.

### `/priority`
Runs the task ranking engine. Returns prioritized plan mapped to calendar gaps. Offers to block time.

### `/poll`
Forces all channels to check for new data. Runs extraction on unprocessed messages, pulls new emails + calendar, feeds through decision engine.

### `/reset`
Wipes database. Restarts onboarding from scratch.

---

## The Climax: Cross-Source Synthesis

The demo's centerpiece moment. Within the same 30-second window:

**Gmail**: Prof Kim → "CS 301 Final Project — writeup due tomorrow by 11:59pm"
**iMessage** (via listener): Sarah → "hey have u started the data analysis part yet? kim just emailed and its due tmrw"

Both arrive at the agent:
1. Email poller catches Kim's email → extracts deadline task (hard, tomorrow, professor)
2. Listener catches Sarah's text → extracts task (data analysis, from teammate)
3. Decision engine evaluates: same project, two sources, hard deadline < 24hr
4. Cross-refs: Sarah is a teammate + emailed about same project + calendar shows CS 301 lecture

**Nudge texts Teri one message:**
> "kim and sarah are both on u about cs 301. writeup due tmrw 11:59 and sarah needs the analysis part. u have a gap at 4 — want me to block it?"

One text. Two sources. No notification overload.

---

## Demo Scenario Script

### Pre-Recording Setup

**On Teri's Google account:**

Calendar events for demo day:
| Time | Title | Attendees |
|------|-------|-----------|
| 9:00-10:15 | CS 301 Lecture | (none) |
| 10:30-11:30 | Office Hours - Prof Kim | kim's email |
| 12:00-12:30 | Lunch w/ Sarah | sarah's email |
| 4:00-6:00 | (FREE — the gap) | |
| 6:30-7:30 | Study Group | 2-3 emails |

**Emails to send to Teri's Gmail (have friends send these BEFORE recording):**
1. **Prof Kim** (friend with any email): Subject "CS 301 Final Project - Deadline Reminder" — "Hi all, reminder that your group writeup is due tomorrow by 11:59pm. Make sure all team members have contributed their sections."
2. **Sarah** (teammate): Subject "re: group project" — "hey did you see kim's email? i finished my section, can you review it? also we still need the data analysis part done before we can submit"
3. **Mom**: Subject "Dinner Thursday" — "Don't forget dinner Thursday! Also did you pay rent?"

**iMessages to send DURING recording (friends text Teri's real number):**
- **Sarah**: "hey have u started the data analysis part yet? kim just emailed and its due tmrw"
- **Mom**: "call me when you get a chance honey"

**Photo ready on Teri's camera roll:**
Screenshot of assignment rubric:
```
CS 301 Final Project Rubric
- Group Writeup: 40% (due tomorrow 11:59pm)
- Data Analysis: 30% (due tomorrow 11:59pm)
- Presentation: 30% (due next Friday)
```

### Both Macs Running

**Agent Mac:**
```bash
cd imesg && bun run src/index.ts
# Console shows: [nudge] all systems up. [server] listening on port 3456
```

**Teri's Mac:**
```bash
cd listener && bun run start
# Console shows: [listener] watching messages — forwarding to agent
```

### Recording Script

| Time | What happens | What Nudge does | Feature |
|------|-------------|-----------------|---------|
| 0:00 | Teri texts the agent number | | |
| 0:03 | | "who dis" | Bouncer personality |
| 0:08 | Teri: "it's teri, i'm a cs student drowning rn" | | |
| 0:12 | | "teri huh. inbox person or calendar person" | Gatekeeping charm |
| 0:16 | Teri: "both honestly, midterms are killing me" | | |
| 0:20 | | VERDICT: APPROVED → "alright teri" → reveal fires | Onboarding complete |
| 0:25 | | "so u have office hours with kim at 10:30 and sarah emailed about the group project... ur booked" | **Reveal: cross-source awareness** |
| 0:30 | **THE CLIMAX**: Sarah texts Teri "hey have u started the data analysis part yet? kim just emailed" (goes through listener) AND Prof Kim's email is already in Gmail | | |
| 0:35 | | `/poll` or listener auto-triggers → decision engine fires | |
| 0:38 | | "kim and sarah are both on u about cs 301. writeup due tmrw 11:59 and sarah needs the analysis part. u have a gap at 4 — want me to block it?" | **Cross-source synthesis** |
| 0:45 | Teri: "yeah block it" | | |
| 0:48 | | "blocked 4-5:30 for cs 301. also ur mom texted — not urgent, save it for after study group?" | Calendar blocking + priority triage |
| 0:55 | Teri sends photo of assignment rubric | | |
| 1:00 | | "writeup 40%, analysis 30%, presentation 30%... analysis is the bottleneck since sarah's waiting on u for it" | Vision + task extraction from photo |
| 1:08 | Teri: "what should i do first" | | |
| 1:12 | | "data analysis first (sarah's blocked on u, ~45min), then review her section (15min), then writeup contributions (30min). all fits in ur 4-5:30 block. presentation not til next week" | **Task ranking engine** |
| 1:20 | Teri: "draft a reply to sarah" | | |
| 1:25 | | draft: "just saw kim's email — gonna knock out the analysis during my 4pm block, can review ur section after. we're good" | Contextual email drafting |
| 1:32 | Teri: "done with the analysis" | | |
| 1:36 | | "nice. sarah's unblocked — review her section next (15min). still on track for 11:59" | Task completion + re-rank |
| 1:42 | `/time 18:00` | | |
| 1:45 | | "3 of 5 done today. writeup contributions still open — that's #1 for tomorrow morning. see u then" | **Proactive EOD review** |
| 1:50 | Mom texts Teri "call me when you get a chance honey" (through listener) | | |
| 1:53 | | "ur mom wants a call. nothing urgent — maybe after study group at 7:30?" | Listener + smart triage |
| 2:00 | End | | |

---

## Verification Checklist

### Pre-Demo (run day before)

**Infrastructure:**
- [ ] Agent Mac: `bun run src/index.ts` boots clean — all systems up
- [ ] Agent Mac: `curl http://localhost:3456/health` returns "ok"
- [ ] Teri's Mac: `cd listener && bun run start` connects and watches
- [ ] Test POST: listener sends a test message → agent receives and stores it
- [ ] Both Macs on same WiFi network
- [ ] OAuth already completed for Teri's phone number (check with `checkUserConnected`)

**Data:**
- [ ] 3 emails in Teri's Gmail (Kim, Sarah, Mom)
- [ ] 5 calendar events on demo day
- [ ] 4:00-6:00 gap is clear
- [ ] Photo of rubric saved to Teri's camera roll

### Demo Flow (run through once before recording)

**Onboarding (0:00-0:25):**
- [ ] `/reset` clears everything
- [ ] `/demo` sets demo mode, pre-caches data
- [ ] Bouncer fires on first text ("who dis")
- [ ] 2-3 exchanges → VERDICT: APPROVED
- [ ] Reveal mentions real names from email + calendar

**Cross-Source Climax (0:25-0:48):**
- [ ] Sarah texts Teri → listener forwards to agent within 3s
- [ ] Agent extracts task from Sarah's text
- [ ] Agent connects Sarah's text + Kim's email = same project
- [ ] Nudge sends ONE synthesized message mentioning both
- [ ] Message mentions the 4pm gap and offers to block it
- [ ] "yeah block it" → real calendar event created

**Task Intelligence (0:48-1:42):**
- [ ] Photo analyzed → tasks created with time estimates
- [ ] `/priority` or "what should i do first" → ranked plan with times
- [ ] "draft a reply to sarah" → draft references tasks + deadlines
- [ ] "done with the analysis" → task marked complete, next task surfaced

**Proactive (1:42-2:00):**
- [ ] `/time 18:00` → EOD review fires proactively
- [ ] Mom's text (via listener) → correctly deprioritized, queued for after study group

### Failure Recovery
- If listener disconnects → agent still works for direct messages, just no passive listening
- If Composio fails → email/calendar return empty, agent still responds with what it has
- If LLM is slow → responses may take 3-5s instead of 1-2s. Acceptable for screen recording (can cut)
- If decision engine returns "silent" when it should "send" → use `/poll` to force re-evaluation

---

## Files Created/Modified

### New Files
| File | Purpose |
|------|---------|
| `src/demo.ts` | Virtual clock + demo mode flag |
| `src/agent/ranking.ts` | Task scoring + ranking + calendar fitting |
| `src/agent/proactive/decision-engine.ts` | Unified urgency-vs-disruption decision gate |
| `src/server.ts` | HTTP server receiving listener data |
| `src/utils.ts` | Shared helpers (fmtTime, normalizeNameWords) |
| `listener/index.ts` | Teri's Mac — watches iMessages, POSTs to agent |
| `listener/package.json` | Listener dependencies |
| `listener/.env.example` | Listener config template |

### Modified Files
| File | Changes |
|------|---------|
| `src/index.ts` | Boot sequence starts HTTP server |
| `src/agent/handler.ts` | Routes /demo, /time, /important, /priority, /poll; task completion; demo mode OAuth skip |
| `src/agent/tools.ts` | Added block_time, send_email tools (by Trae) |
| `src/agent/personality.ts` | Upgraded prompts, simplified validation (prompt-driven not regex-driven) |
| `src/memory/db.ts` | 7 new task columns, completion/dependency queries |
| `src/listener/extractor.ts` | Enriched task extraction, runExtractionOnce() |
| `src/integrations/calendar.ts` | blockTime, findAndBlockTime (by Trae) |
| `src/integrations/gmail.ts` | sendEmail (by Trae) |
| `src/agent/context.ts` | Virtual clock support |
| `src/agent/crossref.ts` | Shared fmtTime import |
| `src/agent/proactive/triggers-event.ts` | Virtual clock support |
| `src/agent/proactive/triggers-scheduled.ts` | Virtual clock support |
