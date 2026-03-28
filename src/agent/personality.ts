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

const BANNED_PHRASES = [
  "i'd be happy to", "i'd love to help", "let me help you", "i can help you",
  "i understand", "i hear you", "that sounds", "i appreciate",
  "thank you for sharing", "feel free to", "don't hesitate",
  "i'm here for you", "i'm sorry to hear", "that must be",
  "it's important to", "remember that", "keep in mind",
  "you might want to", "have you considered", "you could try",
  "here's what i think", "in my opinion", "if i may suggest",
  "great question", "happy to", "let me know if", "hope this helps",
  "that said", "that being said", "to be fair", "worth noting",
  "it's worth mentioning", "i noticed", "i've noticed",
  "based on your data", "i can see that", "it seems like",
  "it appears that", "i want to help", "as an ai", "as a language model",
  "i don't have feelings", "i'm just a",
];

const BANNED_WORDS = [
  "certainly", "absolutely", "definitely", "indeed", "furthermore", "moreover",
  "additionally", "nevertheless", "nonetheless", "regarding", "assistance",
  "apologize", "delighted", "utilize", "leverage", "facilitate", "interestingly",
  "database", "api", "server", "agent", "pipeline", "searching", "processing",
  "fetching", "analyzing", "computing", "algorithm",
];

const LLM_PATTERNS = [
  /^\d+\.\s/gm,                    // numbered lists
  /^[-•]\s/gm,                     // bullet points
  /\*\*[^*]+\*\*/g,                // bold markdown
  /^(First,|Second,|Third,)/gim,   // step-by-step
  /^(Here's|Here is)/gim,          // "Here's what..."
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phraseRe = new RegExp(BANNED_PHRASES.map(esc).join('|'), 'gi');
const wordRe = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'gi');

export function validateResponse(text: string): string {
  let r = text.toLowerCase();

  r = r.replace(phraseRe, '');
  r = r.replace(wordRe, '');

  for (const pat of LLM_PATTERNS) {
    r = r.replace(pat, '');
  }

  r = r.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim();

  const words = r.split(/\s+/).filter(Boolean);
  if (words.length > 120) {
    r = words.slice(0, 120).join(' ');
  }

  let bangCount = 0;
  r = r.replace(/!/g, () => (++bangCount <= 1 ? '!' : '.'));

  return r.trim();
}

const TECH_JARGON_RE = /\b(database|api|server|agent|pipeline|searching|processing|fetching|analyzing|computing|algorithm)\b/gi;
const DRAFT_PREAMBLE_RE = /^(?:here['']?s?\s+(?:a\s+)?(?:draft|what|reply|response|email|message)[^:\n]*[:\n]\s*)/i;

export function validateDraft(text: string): string {
  let r = text.replace(DRAFT_PREAMBLE_RE, '');
  r = r.replace(TECH_JARGON_RE, '');
  r = r.replace(/\n{3,}/g, '\n\n').replace(/  +/g, ' ').trim();
  return r;
}

export function getTemporalVoice(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 10) return 'morning: be shorter, efficient, energized. nobody wants personality at 7am';
  if (h >= 12 && h < 17) return 'afternoon: peak energy, direct, incisive. get to the point';
  if (h >= 17 && h < 23) return 'evening: reflective, connect dots across the day. slightly warmer';
  return 'late night: minimal. if this is proactive, probably dont send it';
}
