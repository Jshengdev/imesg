# iMessage AI Assistant: Specification

## 1. Overview

### 1.1. Project Summary

A Node.js/Bun-based background service that acts as an AI assistant for iMessage. It connects to the local iMessage data, processes conversations, and responds in a dedicated thread.

### 1.2. Goals

To create a personal AI assistant that can manage tasks, provide information, and interact with other services, all within the iMessage ecosystem.

### 1.3. Non-Goals

This is not a GUI application. It has no web, desktop, or mobile interface. The user interacts with it entirely through iMessage.

## 2. System Architecture

### 2.1. Core Components

- **Listener**: Monitors iMessage conversations for tasks and triggers.
- **Agent**: Executes tasks and communicates with the user in a dedicated iMessage thread.
- **iMessage Kit**: The bridge to the local iMessage database and sending functionality.
- **MiniMax AI**: The suite of AI models for language understanding, text-to-speech, and vision.
- **Composio**: The integration layer for third-party services like Google Calendar and Gmail.
- **SQLite Database**: For local storage of messages, tasks, and logs.

### 2.2. Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **iMessage Integration**: `@photon-ai/imessage-kit`
- **Database**: `better-sqlite3`
- **AI Models**: MiniMax (M2.7, Speech 2.8, Vision) via `openai` client
- **Service Integration**: `composio-core`
- **Configuration**: `dotenv`
- **Utilities**: `uuid`

## 3. Features

### 3.1. Real-time Message Processing

The Listener will continuously monitor `chat.db` for new messages.

### 3.2. Task Extraction

The Listener will use the MiniMax LLM to identify actionable tasks from conversations.

### 3.3. Dedicated Agent Thread

The Agent will communicate with the user in a separate iMessage thread to avoid cluttering personal conversations.

### 3.4. Voice Note Responses

The Agent will use the MiniMax TTS service to generate voice note responses.

### 3.5. Google Calendar & Gmail Integration

The Agent will use Composio to interact with Google Calendar and Gmail.

### 3.6. Local Data Persistence

The system will use a local SQLite database to store messages, tasks, and logs.

### 3.7. Image Analysis

The system will be able to analyze images sent in iMessage conversations.

## 4. Implementation Details

### 4.1. Configuration

API keys and other sensitive data will be stored in a `.env` file and accessed via a typed `config.ts` module.

### 4.2. Database Schema

The database will have tables for `messages`, `tasks`, `people`, `agent_log`, and `proactive_log`.

### 4.3. AI Model Interaction

All interactions with the MiniMax APIs will be centralized in their respective modules (`llm.ts`, `tts.ts`, `vision.ts`).

### 4.4. iMessage Routing

A router will be implemented to direct messages to the appropriate handler (Agent or Listener) based on the chat of origin.
