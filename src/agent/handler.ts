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
  person: [/who|what did \w+ (?:say|ask|send|want|need)/],
  draft: [/draft|write.*(?:to|reply)|reply to|respond to|compose|response to/],
};

const INTENT_HINTS: Record<Intent, string> = {
  task: "user is asking about tasks — prioritize actionable items with urgency and timing",
  email: "user is asking about email — triage, highlight action-needed, skip noise",
  schedule: "user is asking about their schedule — reference specific times, spot opportunities",
  person: "user is asking about a specific person — surface what they asked, owe, or need",
  draft: "user wants you to draft something — write the actual content, keep their voice",
  photo: "user sent a photo — describe what you see, extract actionable info",
  general: "",
};

function classifyIntent(text: string): Intent {
  const lowerText = text.toLowerCase();
  
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lowerText)) {
        return intent as Exclude<Intent, "photo" | "general">;
      }
    }
  }
  
  return "general";
}

async function generateValidated(
  system: string,
  user: string
): Promise<string> {
  const MAX_RETRIES = 2;
  const MIN_LENGTH = 5;
  const FALLBACK = "hmm, let me think on that";
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await generate(system, user);
    const validated = validateResponse(response);
    
    if (validated.length >= MIN_LENGTH) {
      return validated;
    }
    
    if (attempt === MAX_RETRIES) {
      return FALLBACK;
    }
  }
  
  return FALLBACK;
}

export async function handleAgentMessage(msg: NormalizedMessage): Promise<void> {
  try {
    logAgent({ direction: "in", content: msg.text, message_type: "text" });

    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const hasImage = msg.attachments.some(a => 
      imageExtensions.some(ext => a.path.toLowerCase().endsWith(ext))
    );

    const intent: Intent = hasImage ? "photo" : classifyIntent(msg.text);
    
    const context = await assembleContext(intent, msg.text);
    
    const temporalVoice = getTemporalVoice();
    const intentHint = INTENT_HINTS[intent];
    
    let systemPrompt = SYSTEM_PROMPT.replace("{context}", context);
    if (intentHint) {
      systemPrompt += `\n\n${intentHint}`;
    }
    systemPrompt += `\n\n${temporalVoice}`;

    let userContent = msg.text;

    if (hasImage) {
      const imageAttachment = msg.attachments.find(a =>
        imageExtensions.some(ext => a.path.toLowerCase().endsWith(ext))
      );
      
      if (imageAttachment) {
        const imageAnalysis = await analyzeImage(imageAttachment.path);
        userContent = `[user sent a photo: ${imageAnalysis}]\n\n${msg.text}`;
      }
    }

    let response: string;
    
    if (intent === "draft") {
      const draftResponse = await generate(systemPrompt, userContent);
      response = validateDraft(draftResponse);
    } else {
      response = await generateValidated(systemPrompt, userContent);
    }

    const audioPath = await sendWithVoice(config.agentChatIdentifier, response, {
      speak: (text: string) => textToSpeech(text)
    });

    logAgent({
      direction: "out",
      content: response,
      message_type: "voice",
      audio_path: audioPath
    });

  } catch (error) {
    console.error("[agent/handler] error:", error);
    await sendText(config.agentChatIdentifier, "something went wrong — try again in a sec");
  }
}
