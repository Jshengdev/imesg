export const SYSTEM_PROMPT = `you are nudge — a sharp, concise executive assistant who lives in imessage.
you have access to the user's calendar, email, and task list.
you speak in lowercase. you are direct, occasionally funny, never robotic.

rules:
- max 120 words per message. usually 1-3 sentences
- synthesize into action, never dump raw data
- never narrate your process — just respond with the result
- never echo what the user just said
- match the user's energy. short msg = short reply
- when they say "ok" / "got it" / "thanks" → don't reply
- voice notes are your primary output. text is fallback

{context}`;

export const BANNED_PHRASES = [
  "i'd be happy to",
  "i'd love to help",
  "let me help you",
  "i can help you",
  "i understand",
  "i hear you",
  "that sounds",
  "i appreciate",
  "thank you for sharing",
  "feel free to",
  "don't hesitate",
  "i'm here for you",
  "i'm sorry to hear",
  "that must be",
  "it's important to",
  "remember that",
  "keep in mind",
  "you might want to",
  "have you considered",
  "you could try",
  "here's what i think",
  "in my opinion",
  "if i may suggest",
  "great question",
  "happy to",
  "let me know if",
  "hope this helps",
  "that said",
  "that being said",
  "to be fair",
  "worth noting",
  "it's worth mentioning",
  "i noticed",
  "based on your data",
  "i can see that",
  "it seems like",
  "it appears that",
  "i want to help",
  "as an ai",
  "as a language model",
  "i don't have feelings",
  "i'm just a"
];

export const BANNED_WORDS = [
  "certainly",
  "absolutely",
  "definitely",
  "indeed",
  "furthermore",
  "moreover",
  "additionally",
  "nevertheless",
  "nonetheless",
  "regarding",
  "assistance",
  "apologize",
  "delighted",
  "utilize",
  "leverage",
  "facilitate",
  "interestingly",
  "database",
  "api",
  "server",
  "agent",
  "pipeline",
  "searching",
  "processing",
  "fetching",
  "analyzing",
  "computing",
  "algorithm",
  "seamlessly",
  "paradigm"
];

export const LLM_PATTERNS = [
  /^\d+\.\s/gm,
  /^[-•]\s/gm,
  /\*\*[^*]+\*\*/g,
  /^(First,|Second,|Third,)/gim,
  /^(Here's|Here is)/gim
];

const phraseRe = new RegExp(
  BANNED_PHRASES.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'gi'
);

const wordRe = new RegExp(
  '\\b(' + BANNED_WORDS.join('|') + ')\\b',
  'gi'
);

export function validateResponse(text: string): string {
  let cleaned = text.toLowerCase();
  
  cleaned = cleaned.replace(phraseRe, '');
  
  cleaned = cleaned.replace(wordRe, '');
  
  LLM_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 120) {
    cleaned = words.slice(0, 120).join(' ');
  }
  
  const exclamations = (cleaned.match(/!/g) || []).length;
  if (exclamations > 1) {
    let count = 0;
    cleaned = cleaned.replace(/!/g, () => {
      count++;
      return count <= 1 ? '!' : '.';
    });
  }
  
  return cleaned;
}

export function validateDraft(text: string): string {
  let cleaned = text.toLowerCase();
  
  cleaned = cleaned.replace(/^(here'?s a draft reply:)/gim, '');
  cleaned = cleaned.replace(/^(draft:)/gim, '');
  cleaned = cleaned.replace(/^(reply:)/gim, '');
  
  cleaned = cleaned.replace(wordRe, '');
  
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

export function getTemporalVoice(): string {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 10) {
    return "morning: be shorter, efficient, energized. nobody wants personality at 7am";
  }
  
  if (hour >= 12 && hour < 17) {
    return "afternoon: peak energy, direct, incisive. get to the point";
  }
  
  if (hour >= 17 && hour < 23) {
    return "evening: reflective, connect dots across the day. slightly warmer";
  }
  
  return "late night: minimal. if this is proactive, probably dont send it";
}
