# Proactive Triggers Specification

## Overview
Scheduled and event-based triggers for proactive conversations.

## Scheduled Triggers

### Morning Briefing
- **Schedule:** Configurable hour (default: 8 AM)
- **Trigger Type:** `morning_briefing`

### Task Nudge
- **Schedule:** Every 30 minutes
- **Condition:** Urgent tasks exist (urgency >= 4)
- **Trigger Type:** `task_nudge`

### Email Alert
- **Schedule:** Every 10 minutes
- **Condition:** Unread emails exist
- **Trigger Type:** `email_alert`

### Schedule Optimizer
- **Schedule:** Every 15 minutes
- **Condition:** Free block >= 30 min AND tasks exist
- **Trigger Type:** `schedule_optimizer`

### Email Escalation
- **Schedule:** Every 10 minutes
- **Condition:** Sender has 3+ unread emails
- **Trigger Type:** `email_escalation`

### End of Day Review
- **Schedule:** Configurable hour (default: 6 PM)
- **Trigger Type:** `end_of_day_review`

## Event-Based Triggers

### Pre-Meeting Prep
- **Polling:** Every 5 minutes
- **Condition:** Meeting within 15 minutes
- **Trigger Type:** `pre_meeting_prep`

### Follow-Up Reminder
- **Polling:** Every 5 minutes
- **Condition:** Meeting ended 30 min to 3 hours ago
- **Trigger Type:** `follow_up_reminder`

### Cross-Source Pairing
- **Polling:** Every 5 minutes
- **Condition:** Person in meeting with related emails/tasks
- **Trigger Type:** `cross_source_pairing`

## Deduplication
In-memory Sets (max 200) prevent duplicate triggers:
- `PRE` - Pre-meeting prep
- `FOLLOW` - Follow-up reminders
- `CROSS` - Cross-source pairing
