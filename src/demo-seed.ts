import { resetDatabase, storeTasks, getDb } from "./memory/db";
import { setDemoMode } from "./demo";

// --- Demo calendar (Teri's real schedule) ---
export const DEMO_CALENDAR = [
  { title: "NVSC Venture Competition Training", start: "9:00 AM", end: "12:30 PM", durationMin: 210, attendees: ["Eric Quick"] },
  { title: "Trae.ai x MiniMax Hackathon", start: "10:00 AM", end: "10:00 PM", durationMin: 720, attendees: ["Johnny Sheng", "Teri Shim"] },
  { title: "COMM 410 Class", start: "2:00 PM", end: "3:30 PM", durationMin: 90, attendees: [] },
];

export const DEMO_FREE_BLOCKS = [
  { label: "7:00 AM - 9:00 AM", durationMin: 120 },
  { label: "12:30 PM - 2:00 PM", durationMin: 90 },
  { label: "3:30 PM - 10:00 PM", durationMin: 390 },
];

// --- Demo emails (what's actually in Teri's inbox) ---
export const DEMO_EMAILS = [
  {
    from: "Johnny Sheng <johnnysheng222@gmail.com>",
    subject: "Chapter 3 revision + TA hours",
    snippet: "Hi Teri, I went through your Chapter 3 draft — the methodology section needs rework. Your sampling framework doesn't align with the hypothesis from Chapter 2. Can you get the revision back to me by Monday end of day? Also, the department needs your TA hours log for March submitted by this week. — Prof. Kim",
  },
  {
    from: "Johnny Sheng <johnnysh@usc.edu>",
    subject: "Update on Intro Slides — Need a Small Favor",
    snippet: "Hi Teri, I'm falling behind on the intro slides for our Thursday presentation. My other course has a midterm this week. Would you be able to put together a brief outline for the intro section? I can fill in the final details by Wednesday night. Also, did Prof. Kim send you the updated grading rubric? — Marcus",
  },
  {
    from: "Eric Quick <ericquick@usc.edu>",
    subject: "NVSC — are you coming to training today?",
    snippet: "Hey Teri, just checking if you're making it to venture comp training today. We need to run through the pitch deck one more time before regionals.",
  },
  {
    from: "Devpost <noreply@devpost.com>",
    subject: "Trae.ai x MiniMax Hackathon — Submission Reminder",
    snippet: "Your hackathon submission is due tonight by 6:30 PM. Make sure your project description, demo video, and team info are all uploaded.",
  },
  {
    from: "Canbo Zhang <canbozhang@usc.edu>",
    subject: "Hey can you help me with my portfolio site?",
    snippet: "Hey Teri, I know you're swamped but you're the best designer I know. Can you take a quick look at my portfolio and tell me what's off? I'm applying to internships next week.",
  },
];

// --- Enable demo mode (bouncer still runs naturally) ---
export function enableDemoMode(): void {
  resetDatabase();
  setDemoMode(true);
  console.log(`[demo-seed] demo mode enabled — bouncer will run, data seeds after approval`);
}

// --- Seed tasks + people after onboarding completes ---
export function seedTasksForUser(userId: string): void {
  storeTasks([
    {
      source: "email",
      description: "Revise Chapter 3 methodology section — sampling framework doesn't align with Chapter 2 hypothesis",
      assigned_by: "Prof. Kim",
      deadline: "Monday EOD",
      urgency: 5,
      estimated_minutes: 120,
      effort_level: "deep",
      deadline_source: "professor",
      deadline_confidence: "hard",
    },
    {
      source: "email",
      description: "Submit March TA hours log to the department",
      assigned_by: "Prof. Kim",
      deadline: "This week",
      urgency: 3,
      estimated_minutes: 15,
      effort_level: "quick",
      deadline_source: "professor",
      deadline_confidence: "soft",
    },
    {
      source: "email",
      description: "Put together outline for group presentation intro section — Marcus is behind on slides",
      assigned_by: "Marcus",
      deadline: "Wednesday night",
      urgency: 4,
      estimated_minutes: 45,
      effort_level: "focused",
      deadline_source: "teammate",
      deadline_confidence: "soft",
    },
    {
      source: "email",
      description: "Forward grading rubric from Prof. Kim to Marcus — he asked if you got it",
      assigned_by: "Marcus",
      deadline: null,
      urgency: 2,
      estimated_minutes: 5,
      effort_level: "quick",
      deadline_source: "inferred",
      deadline_confidence: "inferred",
    },
    {
      source: "email",
      description: "Reply to Eric about NVSC venture comp training — confirm if you're going and run through pitch deck",
      assigned_by: "Eric Quick",
      deadline: "Today",
      urgency: 4,
      estimated_minutes: 10,
      effort_level: "quick",
      deadline_source: "teammate",
      deadline_confidence: "hard",
    },
    {
      source: "email",
      description: "Upload hackathon submission to Devpost — project description, demo video, team info",
      assigned_by: "Devpost",
      deadline: "Today 6:30 PM",
      urgency: 5,
      estimated_minutes: 30,
      effort_level: "focused",
      deadline_source: "explicit",
      deadline_confidence: "hard",
    },
    {
      source: "calendar",
      description: "NVSC training overlaps with hackathon start — decide how to split time",
      assigned_by: null,
      deadline: "Today 9:00 AM",
      urgency: 5,
      estimated_minutes: 5,
      effort_level: "quick",
      deadline_source: "inferred",
      deadline_confidence: "hard",
    },
    {
      source: "email",
      description: "Look at Canbo's portfolio site and give design feedback — he's applying to internships next week",
      assigned_by: "Canbo Zhang",
      deadline: "Next week",
      urgency: 2,
      estimated_minutes: 20,
      effort_level: "quick",
      deadline_source: "inferred",
      deadline_confidence: "soft",
    },
  ], userId);

  const db = getDb();
  const pStmt = db.prepare(`INSERT OR IGNORE INTO people (id, user_id, name, context_notes) VALUES (@id, @user_id, @name, @context)`);
  pStmt.run({ id: "prof-kim", user_id: userId, name: "Prof. Kim", context: "Thesis advisor, wants Chapter 3 revision by Monday, also manages TA hours" });
  pStmt.run({ id: "marcus", user_id: userId, name: "Marcus", context: "Group presentation partner, behind on intro slides, needs outline by Wednesday" });
  pStmt.run({ id: "eric-quick", user_id: userId, name: "Eric Quick", context: "NVSC venture competition teammate, asking about training and pitch deck for regionals" });
  pStmt.run({ id: "canbo-zhang", user_id: userId, name: "Canbo Zhang", context: "Friend asking for portfolio design feedback, applying to internships" });

  console.log(`[demo-seed] seeded 8 tasks + 4 people for user ${userId}`);
}
