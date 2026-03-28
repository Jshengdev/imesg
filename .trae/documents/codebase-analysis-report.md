# iMesg Codebase Analysis & Cleanup Report

**Generated**: March 28, 2026
**Project Type**: iMessage AI Assistant (TypeScript/Bun + Next.js frontend)
**Status**: Hackathon project (March 27-28, 2026) - Post-hackathon cleanup needed

---

## 🚨 CRITICAL ISSUES (Break Build)

### 1. Missing/Broken Exports in `minimax/llm.ts`
**Files Affected**: 5 files
- `src/listener/extractor.ts` - imports `generateJSON` (NOT EXPORTED)
- `src/agent/proactive/engine.ts` - imports `generate` (NOT EXPORTED)
- `src/agent/handler.ts` - imports `generate` (NOT EXPORTED)
- `src/minimax/vision.ts` - imports `client`, `stripThinkTags` (NOT EXPORTED)

**Current State**: `llm.ts` only exports `getCompletion`

**Fix Required**: Either implement the missing functions or refactor imports

### 2. Missing Functions in `memory/db.ts`
**Files Affected**: 4 files
- `src/listener/extractor.ts` - imports `getUnprocessedMessages`, `markProcessed`, `storeTasks` (NOT EXPORTED)
- `src/agent/proactive/triggers-event.ts` - imports `getTaskQueue` (NOT EXPORTED)
- `src/agent/proactive/triggers-scheduled.ts` - imports `getTaskQueue` (NOT EXPORTED)
- `src/agent/proactive/engine.ts` - imports `countRecentProactive`, `wasRecentlySent`, `logProactive`, `getTriggerEngagement` (NOT EXPORTED)
- `src/agent/handler.ts` - imports `logAgent` (NOT EXPORTED)
- `src/agent/context.ts` - imports `getTaskQueue`, `getRecentConversation`, `getPersonDossier` (NOT EXPORTED)

**Current State**: `db.ts` only exports `getDb`

**Fix Required**: Implement missing database functions

### 3. Missing Config Properties
**Files Affected**: `src/agent/handler.ts`, `src/index.ts`
- `config.agentChatIdentifier` used but NOT exported from `config.ts`
- `config.calendarPollMs` used in `proactive/index.ts` but NOT exported
- `config.emailPollMs` used in `proactive/index.ts` but NOT exported

**Fix Required**: Add missing config properties

### 4. Empty Files
- `src/minimax/client.ts` - Empty file (0 lines)
- `src/memory/messages.ts` - Empty file (0 lines)
- `src/memory/tasks.ts` - Empty file (0 lines)
- `src/imessage/listener.ts` - Only has placeholder code

---

## ⚠️ DEPENDENCY ISSUES

### 5. Duplicate Composio Packages
**Problem**: Two different composio packages in `package.json`:
```json
"@composio/core": "^0.6.7",
"composio-core": "^0.5.39"
```
These are likely different versions of the same package. Use only ONE.

**Files Using Different Packages**:
- `/src/integrations/composio.ts` - uses `@composio/core`
- `/src/composio/calendar.ts` - uses `composio-core`

### 6. Unused Dependencies
```json
"uuid": "^13.0.0"  // NOT used anywhere in codebase
```
Better-sqlite3 IS used (in `memory/db.ts`), so keep it.

### 7. Redundant Dependencies
```json
"dotenv": "^17.3.1"  // Redundant with Bun
```
**CLAUDE.md says**: "Bun automatically loads .env, so don't use dotenv."

### 8. Multiple Lock Files (Confusing)
Three lock files exist:
- `bun.lock` (Bun)
- `pnpm-lock.yaml` (pnpm)
- `package-lock.json` (npm)

**Recommendation**: Choose ONE package manager (Bun recommended per CLAUDE.md)

---

## 🗂️ DUPLICATE/ORPHANED FILES

### 9. Duplicate Composio Implementations
Two different Composio integrations exist:
- `/src/integrations/composio.ts` - Full implementation with fallback logic
- `/src/composio/calendar.ts` - Partial implementation with placeholder comments
- `/src/agents/ComposioAgent.ts` - Mock agent that appends comments to files

**Recommendation**: Consolidate to one implementation

### 10. Unused Agent Orchestration System
`/src/orchestrator.ts` + `/src/agents/` directory:
- Contains mock agents that just append comments to files
- Not imported anywhere in main `index.ts`
- Reads from `spec list/` markdown files
- **This appears to be a failed experiment** - can be deleted

### 11. Root Level Leftover Files
- `index.ts` - Prints "Hello via Bun!" (leftover scaffold file)
- `sdk_example.py` - Unrelated Python file (GitHub API example)

### 12. Duplicate Documentation Files
Multiple PRD/architecture docs:
- `.trae/documents/iMesg_prd.md` + `spec list/PRD.md` (similar content)
- `.trae/documents/iMesg_technical_architecture.md` + `.trae/documents/iMessage_AI_Assistant_Technical_Architecture.md`
- `.trae/documents/iMessage_AI_Assistant_PRD.md` (duplicate naming)

### 13. Outdated Hackathon Documentation
The `ideation-doc/` folder contains hackathon strategy docs:
- `HACKATHON_INFO.md`
- `RESEARCH_WINNING_STRATEGY.md`
- `DEVELOPMENT_STRATEGY.md`
- `TRAE_MINIMAX_USAGE_LOG.md`

**Hackathon was March 27-28, 2026** - These are now outdated and should be archived/deleted

---

## 📋 CLEANUP PRIORITIES

### Priority 1: FIX BREAKING ISSUES
1. Implement missing exports in `minimax/llm.ts`
2. Implement missing functions in `memory/db.ts`
3. Add missing config properties
4. Delete or populate empty files

### Priority 2: REMOVE UNUSED CODE
1. Delete `src/agents/` directory (unused mock agents)
2. Delete `src/orchestrator.ts`
3. Delete root `index.ts` and `sdk_example.py`
4. Delete `ideation-doc/` folder (outdated)

### Priority 3: FIX DEPENDENCIES
1. Remove duplicate `composio-core` (keep `@composio/core`)
2. Remove unused `uuid` dependency
3. Remove redundant `dotenv` dependency
4. Choose one lock file (delete `pnpm-lock.yaml` and `package-lock.json` if using Bun)

### Priority 4: CLEAN DOCUMENTATION
1. Consolidate duplicate PRD files
2. Delete redundant architecture docs
3. Update `.trae/documents/` to have single source of truth

---

## 📊 FILE COUNT SUMMARY

**Total Source Files**: 50+ TypeScript files
**Critical Issues**: 4 categories
**Warnings**: 4 categories
**Cleanup Candidates**: 10+ files/directories

---

## 🎯 RECOMMENDED ACTIONS

1. **Immediate**: Fix the broken imports (Priority 1)
2. **After Hackathon**: Clean up unused code and docs
3. **Tech Debt**: Standardize on single Composio package
4. **Documentation**: Create single source of truth for specs

Would you like me to start cleaning up? I recommend starting with Priority 2 (removing unused code) since those are safe deletions that won't break anything.
