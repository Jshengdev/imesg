# Hackathon Winning Research & Strategy

## What Actually Wins at MiniMax/Trae Hackathons

### Pattern from MiniMax Hackathon Winners

**AWS x MiniMax MCP Agents Hackathon (May 2026, SF)**
- 1st: **Voice Root** — intelligent voice assistant with personal context. Used MiniMax Audio.
- 2nd: **Word Surf** — web-based game transforming webpages into surfable paths
- 3rd: **Nurse Nora** — healthcare voice assistant for symptom-based illness info
- 4th: **eBay Snipe** — shopping assistant using descriptive input
- 5th: **Vagari MCP** — travel planner with custom itineraries
- **Key insight:** 1/3 of ALL submissions used MiniMax Audio. Voice was the differentiator.

**YCombinator Browser-Use Hackathon (Feb 2026)**
- Winner: **Browser Brawl** — adversarial arena where two agents compete on a live website
- **Key insight:** Creative concept + technical sophistication. Not just "useful" — it was novel.

**MiniMax $150K Challenge**
- Judged on: social impact, commercial potential, scalability, data quality, prompt design, technical execution, usability, end-to-end experience
- Example winners: travel itinerary builder, virtual museum tour, AI piano studio
- **Key insight:** Projects that felt like real products, not demos

### Pattern from Trae AI IDE Hackathons

**Trae Zero Limits Hackathon (June 2025, lablab.ai, $80K prizes)**
- **MCP RAG Optimizer** — zero-config MCP server for retrieval optimization
- **Pulse** — real-time news analysis platform
- **FeelBack** — nostalgia platform using multi-agent orchestration
- **Code Guru** — natural-language to coding exercises
- **Key insight:** Winners showed Trae's multi-agent orchestration, not just autocomplete

**Trae Agent Hackathon (X/Twitter-based)**
- Required: Create custom Agent using Trae combining prompts, tools, and MCP
- Share work with screenshots/short video
- **Key insight:** Trae's agent mode + MCP integration is what they want to see showcased

---

## What Judges Actually Look For (From 5 Devpost Judges)

### The Hierarchy
1. **Meet ALL requirements first** — "Surprising how many submissions don't fulfill basic requirements"
2. **Demo video is your pitch** — judges watch videos before testing anything
3. **Show the "Magic Moment"** — jump straight to the wow, skip signup screens
4. **Don't shoehorn** — judges can tell when you had an independent idea and forced it to fit
5. **Depart from templates** — submissions that merely modify templates get downgraded
6. **Show your code** — technical judges want transparency, not just polished UIs
7. **Leverage provided resources** — judges WANT to see sponsor tools used; it's literally a criterion

### Red Flags That Kill Projects
- Polished presentation but minimal actual code
- Template recycling with cosmetic changes
- Ignoring or partially meeting requirements
- Resubmitted projects from other hackathons
- Back-end heavy projects with no UI to demo
- "Shoehorned" ideas that don't naturally fit the theme

### What Makes Projects Stand Out
- "Would I personally use and install this?" — Warren (Atlassian)
- Unexpected approaches that make judges think
- Genuine passion visible in the pitch
- Tight code + full requirement fulfillment
- Storytelling: "The storytelling component is HUGE" — Karen (Databricks)

---

## MiniMax APIs Available (Use Multiple = Higher Score)

| Category | Models | Key Capability |
|----------|--------|----------------|
| **Text/Chat** | M2.7, M2.5 | Long-context (204K tokens), tool use, agentic workflows |
| **Speech/TTS** | speech-2.8-hd/turbo | 24-40 languages, 7 emotions, voice cloning, 1M chars/request |
| **Video** | Hailuo 2.3 | Text-to-video, image-to-video, 1080p, 6-10s clips |
| **Music** | Music-2.5+ | Text-to-music, emotional vocals, cross-genre |
| **Role-play** | M2-her | Character customization, multi-turn dialogue |

### Multi-Modal Integration Strategy
Using 2-3 APIs shows "depth." The winning pattern from AWS hackathon: voice was in 1/3 of projects. Combining text + speech + one more (vision/video/music) is the sweet spot.

---

## Photon iMessage Kit Capabilities

**What it can do:**
- Send text, images, files via iMessage programmatically
- Watch for incoming messages in real-time (2s polling)
- Auto-reply chains with conditional logic (text matching, sender filtering)
- Group chat support
- Attachment handling (PDF, CSV, VCF, images)
- Scheduled messages
- Plugin system

**What it CANNOT do:**
- Edit/recall messages
- Send tapbacks/typing indicators/effects
- Voice messages or stickers

**Architecture:** SQLite polling + AppleScript sending. Requires Full Disk Access on macOS.

**Install:** `bun add @photon-ai/imessage-kit` or `npm install @photon-ai/imessage-kit better-sqlite3`

---

## The Winning Formula for THIS Hackathon

### Optimizing for Each Criterion

**Product Completeness (25%)** — BIGGEST WEIGHT
- Ship one tight flow that works perfectly end-to-end
- Polish > features. A 2-feature agent that never breaks beats a 10-feature one that crashes
- Must have a working demo link (required submission item)
- "Would I install this?" test

**TRAE AI Usage (20%)**
- Git history must tell a story of Trae building the project step-by-step
- Show multi-agent orchestration, not just autocomplete
- Use Trae's agent mode, MCP integration, chat features
- Document with screenshots of Trae suggestions
- The "description of how you used TRAE stack" is a REQUIRED submission item

**MiniMax Integration (20%)**
- Use 2-3 MiniMax APIs minimum (text + speech + one more)
- "Quality and depth" — don't just call the API, make it central to the experience
- Voice (TTS) was the #1 differentiator at the AWS hackathon
- Describe integration depth in submission

**Innovation & Creativity (20%)**
- Solve a REAL problem you actually have
- iMessage deployment via Photon is already novel (most teams will build web apps)
- Combine modalities in unexpected ways

**Presentation Quality (15%)**
- 2-min demo video (optional but DO IT)
- 5-slide deck (optional but DO IT)
- Jump straight to the "Magic Moment" — show the agent working on a real phone
- Personal story: "I had this problem, I built this"

### Submission Checklist (Don't Miss Any)
- [x] Project name and tagline (Required)
- [x] 2-3 paragraph description (Required)
- [x] Demo link (Required — HIGHLIGHTED as important)
- [x] Description of MiniMax APIs + TRAE stack usage (Required)
- [x] Public GitHub repo with commit history (Required)
- [ ] Demo video max 2 min (Optional — but do it)
- [ ] 5-slide deck (Optional — but do it)

**Submit at:** https://build-with-trae-and-minimax.devpost.com/

---

## Key Links

- [MiniMax API Docs](https://platform.minimax.io/docs/guides/models-intro)
- [MiniMax API Key Form](https://forms.gle/jY5dfn1wSLXwMf3d7)
- [TRAE Setup Guide](https://www.notion.so/Build-with-TRAE-x-MiniMax-Hackathon-LA-Quick-Start-Guide-26bd69a3552e82f398ef81f5f00df68e)
- [Photon iMessage Kit](https://github.com/photon-hq/imessage-kit)
- [Photon Advanced Kit](https://github.com/photon-hq/advanced-imessage-kit)
- [Photon Technical Blog](https://photon.codes/blog/frontier-agent-interaction-on-imessage-tech-overview)
- [MiniMax Awesome Integrations](https://github.com/MiniMax-AI/awesome-minimax-integrations)
- [MiniMax MCP Server](https://github.com/MiniMax-AI/MiniMax-MCP)
- [Devpost Submission](https://build-with-trae-and-minimax.devpost.com/)
