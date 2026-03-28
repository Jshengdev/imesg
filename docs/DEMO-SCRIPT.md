# iMesg Demo Script

## Demo Overview
Full demonstration of iMesg's autonomous AI assistant capabilities through a realistic day-in-the-life scenario.

**Duration:** 10-15 minutes  
**Audience:** Potential users, investors, team demos  
**Goal:** Showcase proactive intelligence, task management, and seamless assistant integration

---

## Phase 1: First Contact (The Bouncer) 🎬
**Time: Real-time**  
**Goal:** Show personality and vetting process

### Setup
```
[Screenshot: iMessage chat with "New Contact - Unknown"]
```

### Demo Flow
```
YOU: hey
NUDGE: who dis
YOU: it's me, john
NUDGE: o nice. ceo of your own life i assume
YOU: yeah something like that
NUDGE: so what keeps u busy these days
YOU: work stuff, grad school, trying to stay on top of everything
NUDGE: fun. you sound like a person with too many tabs open
YOU: accurate
NUDGE: alright

VERDICT: APPROVED

NUDGE: welcome to nudge. let me get the lay of the land
```

**What this shows:**
- Personality and humor (not corporate)
- Smart conversational ability
- Gatekeeping adds exclusivity/curiosity
- Natural flow, not scripted

---

## Phase 2: OAuth & First Look 🏠
**Time: Real-time**  
**Goal:** Connect integrations and show initial intelligence

### OAuth Prompt
```
NUDGE: alright john, two quick sign-ins
gmail: https://auth.composio.link/...
calendar: https://auth.composio.link/...
same google account for both. text me when you're done
```

### Post-Connection Reveal
```
YOU: done
NUDGE: locked in, john
give me a sec to look around...

scanned 47 unread emails
3 meetings today
you're.cc'd on 4 slack threads
oh and your professor emailed twice

i'll keep an eye on things
```

**What this shows:**
- OAuth integration works
- Quick intelligence gathering
- Personalized introduction (not generic "I'm ready!")
- Shows what it already knows about you

---

## Phase 3: Morning Briefing ☀️
**Time: 8:00 AM (via `/time 8:00 AM`)**
**Goal:** Demonstrate proactive daily digest

### Trigger
```
YOU: /time 8:00 AM
NUDGE: time set to 8:00 AM — simulation mode active
```

### Proactive Message (Nudge sends WITHOUT prompting)
```
[8:00 AM]
NUDGE: morning john

today you got:
• 3 meetings (standup, design review, 1:1 with sarah)
• 14 unread emails (3 from people you're meeting today)
• 2 urgent tasks (professor email, team budget review)
• free blocks: 12-1pm, 3-4pm

hot take: your afternoon is actually looking clear for once
```

**What this shows:**
- Time simulation works
- Proactive behavior (Nudge sent without being asked)
- Multi-source aggregation (email + calendar + tasks)
- Actionable insights, not just data dump

---

## Phase 4: The Teammates Update 👥
**Time: 9:15 AM**
**Goal:** Show how Nudge tracks and prioritizes team asks

### Proactive Message
```
[9:15 AM]
NUDGE: updates from the squad:

👤 SARAH (1:1 at 10am)
"when you get a chance, can you review the Q2 budget?
also sent over the new hire headcount proposal"
→ action: review budget doc (linked in email)

👤 MIKE (teammate)
"hey did you see my PR? need approval before standup"
→ action: approve/review PR #847

👤 DR. SMITH (professor)
"reminder: thesis draft due Friday"
→ action: thesis draft (2 days)

👤 MOM
"call me when you're free this week :)"
→ action: call mom (no rush, but she'd like to)

💡 sarah's emails have your name in the subject
   — probably wants an answer before your 1:1
```

**What this shows:**
- Natural language parsing of email context
- Relationship identification (teammates, professor, family)
- Priority inference (Sarah = urgent because meeting + multiple emails)
- Friendly, human-like formatting

---

## Phase 5: Priority Check 📋
**Time: 9:20 AM**
**Goal:** Show intelligent task ranking

### Command
```
YOU: /priority
```

### Response
```
📋 PRIORITY QUEUE:
━━━━━━━━━━━━━━━━━━

1. 🔥 URGENT — Reply to Sarah (Q2 Budget)
   ↳ Meeting at 10:00 AM | Sarah Chen
   ⏰ inferred deadline: before standup (30 min)

2. ⚡ HIGH — Approve Mike's PR
   ↳ blocking team deployment | Mike Torres
   ⏰ deadline: before standup

3. ⚡ HIGH — Thesis draft email to Dr. Smith
   ↳ Due Friday | 3 days left
   💡 blocking: can't finalize until approved

4. 📅 SCHEDULED — Team standup prep
   ↳ 9:30 AM (10 min away)
   💡 2 agenda items from Sarah

5. 📌 NORMAL — Call mom
   ↳ mentioned "call when free"
   ⏰ suggested: after meetings clear

6. 🧹 LOW — Follow up with John from marketing
   ↳ waiting 2 days | not urgent
```

**What this shows:**
- Intelligent ranking (not just deadline sorting)
- Inferred urgency from meeting context
- Clear reasoning for each ranking
- Actionable suggestions

---

## Phase 6: The Image Capture 📸
**Time: 9:25 AM**
**Goal:** Show multimodal understanding and task creation

### User Action
```
[Sends photo of whiteboard with meeting notes]
```

### Analysis
```
NUDGE: nice whiteboard. extracted:

meeting: Design Review
date: Friday 2pm
attendees: you, sarah, kevin, lisa
action items:
  • john — research competitor pricing (before friday)
  • sarah — update mockups
  • kevin — technical feasibility

💾 saved as: "Design Review prep"
📋 created task: "research competitor pricing" (due: friday)
   → linked to design review meeting

want me to draft a message to the team confirming these?
```

**What this shows:**
- Vision/OCR capability
- Smart task extraction from photos
- Context linking (meeting → task)
- Proactive offer to communicate

---

## Phase 7: Message Drafting and Sending ✍️
**Time: 9:28 AM**
**Goal:** Show contextual message generation AND immediate sending

### Command
```
YOU: yeah draft something for the team
```

### Response
```
NUDGE: here you go — three options:

Option A (casual):
"yo got the action items from the whiteboard. 
i'm on pricing research, should have it done by thursday.
sarah — mockups ready whenever. kevin — lmk on tech stuff"

Option B (formal):
"Confirmed action items from design review:
- Pricing research: in progress, due Friday
- Mockups: Sarah
- Technical: Kevin

Let me know if anything needs adjustment."

Option C (short):
"on it. pricing research done by thursday."

💾 saved draft to sent folder (sarah, kevin, lisa)

send one, edit, or try again?
```

### User Sends It
```
YOU: send option A
```

### Response
```
NUDGE: sent ✓ — "action items confirmation" to sarah@company.com, kevin@team.com, lisa@team.com
```

**What this shows:**
- Multiple style options
- Maintains conversation context
- Drafts to email (not just text)
- User keeps control (not auto-sent)
- **CAN ACTUALLY SEND** (not just draft)
- Immediate confirmation with ✓

---

## Phase 7b: Reply to Sarah Immediately 📤
**Time: 9:35 AM**
**Goal:** Show instant email response

### Command
```
YOU: reply to sarah about the budget
```

### Response
```
NUDGE: here's what i got from your unread emails and the meeting context:

Subject: Re: Q2 Budget Review
"Hey Sarah — reviewed the budget doc and headcount proposal.
Both look good to move forward. Happy to discuss any specifics
in our 1:1 at 10 if you want to dig deeper.

Thanks,
John"

send it?
```

### User Sends It
```
YOU: do it
```

### Response
```
NUDGE: sent ✓ — "Re: Q2 Budget Review" to sarah@company.com

👍 sarah will see this before your 1:1
```

**What this shows:**
- Context-aware response (pulls from emails + meetings)
- Quick send with natural language ("do it", "send it")
- Shows timing benefit ("she'll see this before your 1:1")

---

## Phase 8: Housekeeping Check 🧹
**Time: 10:15 AM**
**Goal:** Show proactive contradiction detection

### Command
```
YOU: /important
```

### Response
```
⚠️ HOUSEKEEPING SCAN:
━━━━━━━━━━━━━━━━━━━━

🔥 CONFLICT: Sarah email — "RE: Q2 Budget"
↳ You have a meeting in 5 min about budget
↳ Sarah hasn't heard back yet
💡 suggest: quick reply or bring up in 1:1

⚠️ CONFLICT: Dr. Smith — "Thesis Draft"
↳ Due Friday, advisor hasn't seen outline
↳ You have 3 meetings this afternoon
💡 suggest: block 1hr today to draft outline

📬 PENDING: Mike PR
↳ Waiting 45 min, blocking deployment
↳ Standup mentioned it
💡 suggest: review during standup

📊 NOISE FILTERED:
↳ 8 emails marked as newsletters/copy-all
↳ 2 calendar invites (auto-declined irrelevant ones)

💡 today's looking manageable. 
   sarah thing is the only real fire
```

**What this shows:**
- Contradiction detection (email vs. calendar)
- Priority filtering (not overwhelming)
- Actionable suggestions
- Time-aware analysis

---

## Phase 9: Calendar Time Blocking ⏰
**Time: 11:00 AM**
**Goal:** Show smart calendar blocking for thesis work

### Proactive Message (Nudge sees thesis task is pending)
```
[11:00 AM]
NUDGE: noticed your thesis outline is still on the list
you've got a free block 12-1pm — want me to block it for thesis work?
```

### User Confirms
```
YOU: yeah block it
```

### Response
```
NUDGE: blocked ✓ 12:00 PM - 1:00 PM — thesis outline work

⏰ now protected on your calendar
💡 you got this — 1 hour is enough to get the outline done
```

**What this shows:**
- Proactive suggestion (noticed thesis task pending)
- Smart time detection (found free block)
- Calendar integration (actually blocks time)
- Contextual encouragement

### Alternative: Explicit Blocking Request
```
YOU: block 2 hours for thesis work tomorrow morning
NUDGE: blocked ✓ tomorrow 9:00 AM - 11:00 AM — thesis work
```

### Smart Blocking Based on Priority
```
YOU: block time for all my urgent tasks
NUDGE: based on your priority list, blocking:
✓ 12:00 PM - 1:00 PM today — thesis outline (urgent)
✓ tomorrow 9:00 AM - 10:00 AM — thesis draft (blocking)

both protected. now go crush them
```

---

## Phase 10: Task Completion ✅
**Time: 11:30 AM**
**Goal:** Show task tracking and status updates

### After completing Sarah email
```
YOU: done with the budget email
```

### Response
```
✅ marked "reply to sarah (Q2 budget)" as done

📊 MORNING SCORE: 2/4 tasks
   ✅ approved mike's PR
   ✅ replied to sarah

⏳ REMAINING:
   • thesis draft outline (friday)
   • call mom (flexible)
   • competitor research (friday)

💡 you're on a roll. 
   free until 1pm — good time for thesis work?
```

### Command
```
YOU: /remaining
```

### Response
```
📊 DAY STATUS:
━━━━━━━━━━━━━━━━━━
✅ Completed: 2 tasks
⏳ Remaining: 4 tasks
   • 1 urgent (thesis outline)
   • 3 flexible

🏆 Progress: 33% done
   keeps it up and you'll clear by 5
```

---

## Phase 11: Time Jump to EOD 🌆
**Time: 6:00 PM (via `/time +8h`)**
**Goal:** Show end-of-day review

### Command
```
YOU: /time +8 hours
NUDGE: time advanced 8 hours — it's now 6:00 PM
```

### Proactive Message (EOD Review)
```
[6:00 PM]
NUDGE: EOD wrap-up:

✅ DONE TODAY:
   • replied to sarah (Q2 budget approved!)
   • approved mike's PR (deployed 🚀)
   • thesis outline started (40% done)

📋 TOMORROW'S PREVIEW:
   • standup at 9:30am
   • design review prep (your research done?)
   • thesis outline due

👀 STILL WAITING:
   • mom called twice (she says hi btw)
   • marketing john follow-up (low priority)

🌟 tomorrow's looking lighter. 
   might even have time for lunch outside

solid day, john. 
want me to draft a "wrapping up" message to the team?
```

---

## Phase 12: See Tomorrow 👀
**Time: 7:00 PM**
**Goal:** Look ahead to tomorrow

### Command
```
YOU: what's tomorrow look like
```

### Response
```
📅 TOMORROW (Thursday):

MEETINGS:
   • 9:30am — Team standup (30 min)
   • 2:00pm — Design Review (1 hour)
   • 4:00pm — 1:1 with Kevin

TASKS CARRYING OVER:
   • Thesis outline (still 40% — need to finish)
   • Competitor research (due friday)
   • Call mom (she's persistent)

⚠️ WATCH OUT:
   • thesis deadline is friday — you're behind
   • design review prep needs your research

💡 SUGGESTION:
   block 9-11am tomorrow for thesis work
   then you're clear for afternoon meetings

want me to block it?
```

---

## Phase 13: Image Creates Task 📸
**Time: 7:05 PM**
**Goal:** Show the whiteboard → task flow again

### User Action
```
[Sends photo of receipts/business cards]
```

### Response
```
NUDGE: extracted from the receipts:
• coffee with potential client (~$45)
• conference registration ($299)
• flight to NYC ($427)

📊 expense report ready: $771 total
💾 created expense report task (due: submit by friday)

also caught:
• business card: jane doe, VP Product at TechCorp
• note: "interested in partnership"
📋 created follow-up task: "email jane about partnership"

want me to draft that intro email?
```

---

## Demo Summary 🎯

### What We Showcased

| Feature | Demo Moment |
|---------|-------------|
| **Personality** | Bouncer flow, casual tone |
| **Proactive** | Morning digest, EOD review |
| **Time Simulation** | `/time` command, time jumps |
| **Multi-source** | Email + Calendar + Tasks aggregated |
| **Vision** | Whiteboard, receipts, photos |
| **Task Management** | Creation, ranking, completion |
| **Priority Intelligence** | Inferred deadlines, meeting conflicts |
| **Email Drafting** | Email drafts with context |
| **Email Sending** | Actually sends emails (not just draft!) |
| **Calendar Blocking** | Block time for tasks |
| **Housekeeping** | `/important` contradiction scan |
| **Relationship Tracking** | Teammates, professor, mom |

### Key Demo Commands

| Command | Purpose |
|---------|---------|
| `/time 8:00 AM` | Jump to morning |
| `/time +2h` | Advance 2 hours |
| `/time reset` | Back to real time |
| `/priority` | Re-rank tasks |
| `/important` | Scan for conflicts |
| `/done 1,2` | Mark tasks complete |
| `/remaining` | Show task status |

### Sample Data to Pre-load

**Emails:**
- Sarah: Q2 budget review, headcount proposal
- Mike: PR approval request
- Dr. Smith: Thesis deadline reminder
- Mom: "Call me when free"
- Marketing John: Follow-up (low priority)

**Calendar:**
- 9:30am: Team standup
- 10:00am: 1:1 with Sarah
- 2:00pm: Design review prep
- 4:00pm: 1:1 with Kevin

**Tasks:**
- Review Q2 budget (urgent, from Sarah)
- Approve PR (high, from Mike)
- Thesis outline (medium, from Dr. Smith)
- Call mom (low, family)

---

## Technical Implementation Checklist

### Required Features
- [ ] `/time` command with simulation mode
- [ ] Proactive engine respects simulated time
- [ ] `/priority` command with LLM ranking
- [ ] `/important` command with conflict detection
- [ ] `/done` and `/remaining` commands
- [ ] Image → task extraction
- [x] Contextual message drafting
- [x] **Email sending (not just drafting)** ← NEW
- [x] **Calendar time blocking** ← NEW
- [ ] Demo mode flag (reduced restrictions)

### Email Sending Features
- [x] `sendEmail()` function in gmail.ts
- [x] `send_email` tool in tools.ts
- [x] Composio action: `GMAIL_SEND_EMAIL`
- [ ] Multiple recipient support
- [ ] Reply-to threading (In-Reply-To header)
- [ ] Send confirmation with ✓

### Calendar Blocking Features
- [x] `blockTime()` function in calendar.ts
- [x] `findAndBlockTime()` function in calendar.ts
- [x] `block_time` tool in tools.ts
- [x] Composio action: `GOOGLECALENDAR_CREATE_EVENT`
- [ ] Proactive blocking suggestions
- [ ] Smart time slot finding

### Nice to Have
- [ ] Multiple draft style options
- [x] Emoji-enhanced responses
- [ ] Progress tracking (33% done)
- [ ] Celebration messages on completion

### Sample Data Scripts
- [ ] Script to populate demo emails
- [ ] Script to create demo calendar events
- [ ] Script to seed tasks with relationships
