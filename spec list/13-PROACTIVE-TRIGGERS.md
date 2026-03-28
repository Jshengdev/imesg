# Proactive Triggers Specification

## Overview
The proactive triggers are scheduled and event-based triggers that initiate proactive conversations with the user.

## Scheduled Triggers

### Morning Briefing (`morningBriefing`)
- **Schedule:** Configurable hour (default: 8 AM)
- **Prompt:** "give a brief morning briefing with today's top priorities, any urgent emails, and schedule highlights. keep it under 60 seconds of listening."
- **Trigger Type:** `morning_briefing`

### Task Nudge (`taskNudge`)
- **Schedule:** Every 30 minutes
- **Condition:** Only sends if urgent tasks (urgency >= 4) exist
- **Prompt:** Lists urgent tasks, asks which to tackle first
- **Trigger Type:** `task_nudge`

### Email Alert (`emailAlert`)
- **Schedule:** Configurable (default: every 10 minutes)
- **Condition:** Only sends if unread emails exist
- **Prompt:** Shows unread count, top 5 sender/subject
- **Trigger Type:** `email_alert`

### Schedule Optimizer (`scheduleOptimizer`)
- **Schedule:** Every 15 minutes
- **Condition:** Free block >= 30 min AND pending tasks exist
- **Deduplication:** One suggestion per (block start + top task) combination
- **Prompt:** Suggests using free time for top task
- **Trigger Type:** `schedule_optimizer`

### Email Escalation (`emailEscalation`)
- **Schedule:** Configurable (default: every 10 minutes)
- **Condition:** Any sender has 3+ unread emails
- **Deduplication:** Per sender (stops nagging once acknowledged)
- **Prompt:** Flags flooding senders, offers triage help
- **Trigger Type:** `email_escalation`

### End of Day Review (`endOfDayReview`)
- **Schedule:** Configurable hour (default: 6 PM)
- **Prompt:** Summarizes day's meetings and tasks
- **Trigger Type:** `end_of_day_review`

## Event-Based Triggers

### Pre-Meeting Prep (`preMeetingPrep`)
- **Polling:** Every `CALENDAR_POLL_MS` (default: 5 minutes)
- **Condition:** Meeting starting within `PRE_MEETING_MINUTES` (default: 15)
- **Deduplication:** Per (meeting title + start time)
- **Prompt:** Flags upcoming meeting with attendees, offers prep help
- **Trigger Type:** `pre_meeting_prep`

### Follow-Up Reminder (`followUpReminder`)
- **Polling:** Every `CALENDAR_POLL_MS` (default: 5 minutes)
- **Condition:** Meeting ended 30 min to 3 hours ago AND has attendees
- **Deduplication:** Per (meeting title + end time)
- **Prompt:** Suggests drafting follow-up summary or action items
- **Trigger Type:** `follow_up_reminder`

### Cross-Source Pairing (`crossSourcePairing`)
- **Polling:** Every `CALENDAR_POLL_MS` (default: 5 minutes)
- **Condition:** Person in meeting AND (has unread email OR assigned task)
- **Deduplication:** Per (person + meeting title)
- **Prompt:** Connects meeting attendee to related emails/tasks
- **Trigger Type:** `cross_source_pairing`

## Scheduling Utilities

### `scheduleAt(targetHour: number, fn: () => Promise<void>): void`
Schedules a function to run daily at a specific hour.

**Behavior:**
1. Calculates next occurrence of target hour
2. Sets timeout for that duration
3. Runs function
4. Schedules next occurrence recursively

### `scheduleMorningBriefing(): void`
Convenience function calling `scheduleAt(config.morningBriefingHour, morningBriefing)`

### `scheduleEodReview(): void`
Convenience function calling `scheduleAt(config.eodReviewHour, endOfDayReview)`

## Deduplication Sets
In-memory Sets with max size 200 to prevent duplicate triggers:
- `PRE` - Pre-meeting prep
- `FOLLOW` - Follow-up reminders
- `CROSS` - Cross-source pairing
- `global.__schedOptDedup` - Schedule optimizer
- `global.__emailEscDedup` - Email escalation

## Trigger Engine Startup
```typescript
export function startProactiveEngine(): void {
  scheduleMorningBriefing();
  scheduleEodReview();
  setInterval(preMeetingPrep, config.calendarPollMs);
  setInterval(taskNudge, 30 * 60 * 1000);
  setInterval(emailAlert, config.emailPollMs);
  setInterval(emailEscalation, config.emailPollMs);
  setInterval(scheduleOptimizer, 15 * 60 * 1000);
  setInterval(followUpReminder, config.calendarPollMs);
  setInterval(crossSourcePairing, config.calendarPollMs);
}
```

## Error Handling
Each trigger wraps its logic in try-catch with console error logging:
```typescript
export async function morningBriefing(): Promise<void> {
  try { 
    await sendProactive("morning_briefing", "..."); 
  } catch (e) { 
    console.error('[trigger] morning_briefing failed:', e); 
  }
}
```
