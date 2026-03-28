# iMessage AI Assistant: Specification

## Overview
iMesg is an AI-powered iMessage assistant that provides intelligent message assistance, task management, calendar integration, and proactive reminders using MiniMax AI models.

## System Architecture
```
iMessage → Message Router → Listener (extract tasks)
                        → Agent (generate responses) → TTS (voice)
                                                      → Calendar
                                                      → Gmail
                              SQLite Database
```

## Module Specifications

### Core Modules
| Module | File | Description |
|--------|------|-------------|
| Configuration | 01-CONFIG.md | Environment variables and settings |
| MiniMax LLM | 02-MINIMAX-LLM.md | Text generation with M2.7 |
| MiniMax TTS | 03-MINIMAX-TTS.md | Text-to-speech |
| MiniMax Vision | 04-MINIMAX-VISION.md | Image analysis |
| iMessage SDK | 05-IMESSAGE-SDK.md | Send/receive iMessages |
| iMessage Router | 06-IMESSAGE-ROUTER.md | Route messages |
| Database | 07-DATABASE.md | SQLite persistence |

### Agent Modules
| Module | File | Description |
|--------|------|-------------|
| Personality | 08-AGENT-PERSONALITY.md | Nudge persona |
| Context | 09-AGENT-CONTEXT.md | Context assembly |
| Handler | 10-AGENT-HANDLER.md | Intent classification |
| Agent Router | 11-AGENT-ROUTER.md | SDK bridging |

### Proactive Engine
| Module | File | Description |
|--------|------|-------------|
| Engine | 12-PROACTIVE-ENGINE.md | Rate limiting/dedup |
| Triggers | 13-PROACTIVE-TRIGGERS.md | Scheduled/event triggers |

### Integrations
| Module | File | Description |
|--------|------|-------------|
| Composio | 15-COMPOSIO.md | Third-party framework |
| Calendar | 16-CALENDAR.md | Google Calendar |
| Gmail | 17-GMAIL.md | Gmail integration |

### Listener
| Module | File | Description |
|--------|------|-------------|
| Extractor | 14-LISTENER-EXTRACTOR.md | Task extraction |

## Technology Stack
- **Runtime**: Bun
- **Language**: TypeScript
- **iMessage**: @photon-ai/imessage-kit
- **Database**: better-sqlite3
- **AI**: MiniMax (M2.7, Speech 2.8)
- **Integrations**: composio-core

## Key Features
1. Real-time Message Processing
2. Task Extraction from conversations
3. Voice Responses via TTS
4. Calendar Integration
5. Gmail Integration
6. Proactive Nudges (morning briefing, task reminders)
7. Image Analysis
