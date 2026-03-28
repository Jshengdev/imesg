import { config } from "../config";
import { generate } from "../minimax/llm";
import { textToSpeech } from "../minimax/tts";
import { analyzeImage } from "../minimax/vision";
import { sendText, sendWithVoice, NormalizedMessage } from "../imessage/sdk";
import { logAgent } from "../memory/db";
import { SYSTEM_PROMPT, validateResponse, validateDraft, getTemporalVoice } from "./personality";
import { assembleContext } from "./context";

export type Intent = "task" | "email" | "schedule" | "person" | "photo" | "draft" | "general";

const INTENT_PATTERNS: Record<Exclude<Intent, "photo" | "general">, RegExp[]> = {
  task: [/tasks?|todos?|focus|prioriti|urgent|what.*should|what.*next/],
  email: [/emails?|inbox|unread|mails?|gmail|summar\w* emails?/],
  schedule: [/calendar|schedule|meetings?|free at|busy|what time|standup|when.*is/],
  person: [/who|what did \w+ (?:say|ask