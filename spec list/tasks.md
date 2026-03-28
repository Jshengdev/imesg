
# iMessage AI Assistant: Task List

## Phase 1: Scaffolding (Completed)

- [x] Initialize Bun project
- [x] Install all dependencies
- [x] Configure `tsconfig.json`
- [x] Create `.env` file
- [x] Create `src/config.ts`
- [x] Create `src/memory/db.ts`
- [x] Create `src/minimax/llm.ts`
- [x] Create `src/minimax/tts.ts`
- [x] Create `src/minimax/vision.ts`
- [x] Create `src/imessage/sdk.ts`
- [x] Create `src/imessage/router.ts`

## Phase 2: Listener Implementation

- [ ] Implement the listener loop to watch for new messages.
- [ ] Develop the logic for extracting tasks from messages using the MiniMax LLM.
- [ ] Implement the storage of extracted tasks in the database.

## Phase 3: Agent Implementation

- [ ] Implement the agent loop to process tasks from the database.
- [ ] Develop the logic for generating responses using the MiniMax LLM.
- [ ] Implement the generation of voice notes using the MiniMax TTS service.
- [ ] Implement the sending of text and audio responses to the dedicated agent thread.

## Phase 4: Composio Integration

- [ ] Implement the Composio client.
- [ ] Develop the logic for interacting with Google Calendar.
- [ ] Develop the logic for interacting with Gmail.

## Phase 5: Refinement and Testing

- [ ] Implement comprehensive error handling.
- [ ] Develop a testing strategy for the entire system.
- [ ] Refine the prompts used for the MiniMax LLM.
- [ ] Write a `README.md` with setup and usage instructions.
- [ ] Run the linter to check for code quality.
