# Component: Extractor Upgrade (`src/listener/extractor.ts`)

## Purpose
Enrich extracted tasks with time estimates, effort level, environment, deadline source, and deadline confidence. Also extract tasks from emails.

## Implementation

### Updated extraction prompt
```
Analyze these messages. Extract as JSON:
{
  "tasks": [{
    "description": "specific task",
    "assigned_by": "person name or null",
    "deadline": "date string or null",
    "urgency": 1-5,
    "estimated_minutes": 15|30|45|60|90|120,
    "effort_level": "quick|focused|deep",
    "environment": "anywhere|computer|in-person",
    "deadline_source": "explicit|inferred|professor|teammate",
    "deadline_confidence": "hard|soft|inferred",
    "depends_on_description": "description of task this depends on, or null"
  }],
  "commitments": [...],
  "people": [...]
}

Guidelines for inference:
- "due tomorrow" = hard deadline, explicit source
- "can you do X soon" = soft deadline, inferred
- "review my section" = 15-30min, quick, computer
- "write the analysis" = 60-90min, focused, computer
- "meet with professor" = 30min, focused, in-person
- If unclear, default: 30min, focused, anywhere, urgency 3
```

### Updated storeTasks call
Pass the new fields through to `storeTasks()` which now accepts them.

### Email extraction
Add new function `extractFromEmails(emails: EmailSummary[]): ExtractionResult` that:
1. Takes email summaries
2. Uses same LLM extraction prompt adapted for emails
3. Sets `deadline_source: "professor"` or `"teammate"` based on sender context
4. Called during `/poll` and email polling intervals

### Dependency resolution
When a task has `depends_on_description`, after storing:
1. Search existing tasks for matching description
2. If found, set `depends_on` to that task's ID
3. If not found, store the description string (resolve later when matching task appears)

## Verification
- "kim says writeup due tomorrow" → urgency 5, hard deadline, estimated 60min, professor source
- "can u review my section" → urgency 3, soft deadline, estimated 15min, quick effort
- Photo of rubric → multiple tasks created with appropriate estimates
- Dependency linking: "review sarah's section" depends on sarah finishing her section
