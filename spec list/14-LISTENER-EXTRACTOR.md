# Listener Extractor Module Specification

## Overview
The listener extractor (`src/listener/extractor.ts`) analyzes iMessage conversations to identify actionable items like tasks, commitments, meetups, and people.

## Dependencies
- Internal: `generate` from `../minimax/llm`
- Internal: `getDb` from `../memory/db`
- External: `uuid` for ID generation

## Extraction Prompt
The LLM is instructed to extract the following entity types:

1. **TASKS** - Things the user needs to do (who asked, what, when)
2. **COMMITMENTS** - Things the user promised (to whom, what, when)
3. **MEETUPS** - Planned or proposed gatherings (who, when, where)
4. **PENDING_QUESTIONS** - Questions asked to the user without answers
5. **DEADLINES** - Any time-sensitive items
6. **URGENCY** - Rating 1-5

## Response Format (JSON)
```json
{
  "tasks": [{"description": "", "assigned_by": "", "deadline": "", "urgency": 1}],
  "commitments": [{"description": "", "to_whom": "", "deadline": ""}],
  "meetups": [{"description": "", "who": "", "when": "", "where": ""}],
  "pending_questions": [{"description": "", "asked_by": "", "asked_at": ""}],
  "people": [{"name": "", "context": ""}]
}
```

## Person Name Patterns
Names are extracted using regex patterns:
```typescript
/(?:with|w\/) ([A-Z][a-z]+ [A-Z][a-z]+)/g   // "with John Smith"
/@([A-Za-z]\w+)/g                              // @username
/([A-Z][a-z]+ [A-Z][a-z]+)(?:'s| sent| shared| replied| asked| said)/g
```

## Data Types

### ExtractedEntity
```typescript
interface ExtractedEntity {
  type: "task" | "commitment" | "meetup" | "pending_question";
  description: string;
  assigned_by?: string;
  to_whom?: string;
  deadline?: string;
  urgency?: number;
  who?: string;
  when?: string;
  where?: string;
  asked_by?: string;
  asked_at?: string;
  source_message_id: string;
}
```

### ExtractedPeople
```typescript
interface ExtractedPeople {
  name: string;
  context: string;
  source_message_ids: string[];
}
```

## Public API

### `extractPeopleFromText(text: string, messageIds: string[]): ExtractedPeople[]`
Extracts person names using regex patterns.

**Parameters:**
- `text: string` - Combined message text
- `messageIds: string[]` - Associated message IDs

**Returns:** Array of extracted people

### `callLLM(messages: IMessage[]): Promise<ExtractionResult>`
Calls LLM with extraction prompt.

**Parameters:**
- `messages: IMessage[]` - Batch of messages to analyze

**Returns:** Parsed JSON result or empty arrays on failure

### `storeEntity(entity: ExtractedEntity): void`
Persists entity to database.

**Behavior:**
- **task**: Inserts into `tasks` table with `source='imessage'`
- **commitment**: Inserts into `tasks` table with default urgency 2

### `storePeople(people: ExtractedPeople[]): void`
Updates or inserts people records.

**Behavior:**
- If person exists: updates `last_contact` and `relationship_context`
- If new: inserts with `open_tasks=0`

### `extractEntities(messages: IMessage[]): Promise<ExtractedEntity[]>`
Main extraction function.

**Parameters:**
- `messages: IMessage[]` - Messages to analyze

**Returns:** Array of extracted entities

**Behavior:**
1. Calls LLM with formatted message batch
2. Extracts people via regex patterns
3. Merges LLM people with pattern people (dedup by lowercase name)
4. Stores people records
5. Converts LLM tasks/commitments to ExtractedEntity
6. Stores entities
7. Returns all entities

## Usage Example
```typescript
import { extractEntities } from './listener/extractor';

const messages = [
  { id: '1', sender: 'Alice', content: 'Hey, can you review my PR by tomorrow?' },
  { id: '2', sender: 'Bob', content: 'Dont forget to send the report to Sarah' }
];

const entities = await extractEntities(messages);
// Returns: [
//   { type: 'task', description: 'Review PR', assigned_by: 'Alice', deadline: 'tomorrow', ... },
//   { type: 'commitment', description: 'Send report to Sarah', to_whom: 'Sarah', ... }
// ]
```

## Error Handling
- LLM call failures return empty arrays
- Database errors are logged but don't crash extraction
- Invalid JSON from LLM returns empty arrays
