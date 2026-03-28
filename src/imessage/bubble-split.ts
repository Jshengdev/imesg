// Bubble splitting — adapted from Icarus semantic-split.ts
// Splits long LLM responses into multiple iMessage bubbles (max 4)

const MAX_BUBBLES = 4;
const TOPIC_MARKERS = /\s+(also|anyway|btw|oh and)\s+/i;
const SENTIMENT_MARKERS = /\s+(but|however|though)\s+/i;

function semanticSplit(text: string, max: number): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= 160) return [trimmed];

  // Split into sentences
  const raw = trimmed.match(/[^.!?]+[.!?]*/g) || [trimmed];
  const sentences = raw.map(s => s.trim()).filter(s => s.length > 0);

  // Further split long sentences at semantic markers
  const segments: string[] = [];
  for (const sent of sentences) {
    if (sent.length > 80) {
      const topic = TOPIC_MARKERS.exec(sent);
      if (topic && topic.index > 10) {
        segments.push(sent.slice(0, topic.index).trim());
        segments.push(sent.slice(topic.index).trim());
        continue;
      }
      const sentiment = SENTIMENT_MARKERS.exec(sent);
      if (sentiment && sentiment.index > 10) {
        segments.push(sent.slice(0, sentiment.index).trim());
        segments.push(sent.slice(sentiment.index).trim());
        continue;
      }
    }
    segments.push(sent);
  }

  // Merge tiny segments with previous
  const merged: string[] = [];
  for (const seg of segments) {
    if (merged.length > 0 && seg.length < 20) {
      merged[merged.length - 1] += " " + seg;
    } else {
      merged.push(seg);
    }
  }

  // Cap by merging smallest adjacent pairs
  while (merged.length > max) {
    let minIdx = 0, minLen = Infinity;
    for (let i = 0; i < merged.length - 1; i++) {
      const combined = merged[i].length + merged[i + 1].length;
      if (combined < minLen) { minLen = combined; minIdx = i; }
    }
    merged.splice(minIdx, 2, merged[minIdx] + " " + merged[minIdx + 1]);
  }

  return merged.length > 0 ? merged : [trimmed];
}

export function splitIntoBubbles(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Try newline splits first (LLM often separates thoughts with \n)
  const lines = trimmed.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1 && lines.length <= MAX_BUBBLES) return lines;

  // Short messages stay as one bubble
  if (trimmed.length < 200) return [trimmed];

  // Semantic split for longer text
  return semanticSplit(trimmed, MAX_BUBBLES);
}
