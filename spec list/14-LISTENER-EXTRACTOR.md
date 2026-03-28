# Listener Extractor Module Specification

## Overview
The listener extractor analyzes iMessage conversations to identify actionable items.

## Dependencies
- Internal: `generate` from `../minimax/llm`
- Internal: `getDb` from `../memory/db`
- External: `uuid`

## Extraction Types
1. **TASKS** - Things user needs to do
2. **COMMITMENTS** - Things user promised
3. **MEETUPS** - Planned gatherings
4. **PENDING_QUESTIONS** - Questions without answers
5. **PEOPLE** - Names and context

## Response Format
```json
{
  "tasks": [{"description": "", "assigned_by": "", "deadline": "", "urgency": 1}],
  "commitments": [{"description": "", "to_whom": "", "deadline": ""}],
  "meetups": [{"description": "", "who": "", "when": "", "where": ""}],
  "pending_questions": [{"description": "", "asked_by": ""}],
  "people": [{"name": "", "context": ""}]
}
```

## Public API

### `extractPeopleFromText(text, messageIds): ExtractedPeople[]`
Extracts person names using regex patterns.

### `callLLM(messages): Promise<ExtractionResult>`
Calls LLM with extraction prompt.

### `storeEntity(entity): void`
Persists entity to database.

### `storePeople(people): void`
Updates or inserts people records.

### `extractEntities(messages): Promise<ExtractedEntity[]>`
Main extraction function.
