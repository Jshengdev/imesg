// Message batcher — collects rapid-fire messages before processing
// Waits for a pause in typing (1.5s gap) or max wait (6s), then combines

interface PendingBatch {
  messages: { id: string; text: string; raw: any }[];
  timer: ReturnType<typeof setTimeout>;
  maxTimer: ReturnType<typeof setTimeout>;
}

const TYPING_GAP_MS = 1500;  // wait 1.5s after last message
const MAX_WAIT_MS = 6000;    // force process after 6s

export class MessageBatcher {
  private pending = new Map<string, PendingBatch>();

  constructor(private onBatch: (chatId: string, combinedText: string, raw: any) => Promise<void>) {}

  add(chatId: string, id: string, text: string, raw: any): void {
    let batch = this.pending.get(chatId);

    if (!batch) {
      // First message — start both timers
      batch = {
        messages: [],
        timer: setTimeout(() => this.flush(chatId), TYPING_GAP_MS),
        maxTimer: setTimeout(() => this.flush(chatId), MAX_WAIT_MS),
      };
      this.pending.set(chatId, batch);
    } else {
      // Subsequent message — reset the typing gap timer
      clearTimeout(batch.timer);
      batch.timer = setTimeout(() => this.flush(chatId), TYPING_GAP_MS);
    }

    batch.messages.push({ id, text, raw });
    console.log(`[batcher] ${chatId}: queued "${text.slice(0, 40)}" (${batch.messages.length} in batch)`);
  }

  private async flush(chatId: string): Promise<void> {
    const batch = this.pending.get(chatId);
    if (!batch || batch.messages.length === 0) return;

    clearTimeout(batch.timer);
    clearTimeout(batch.maxTimer);
    this.pending.delete(chatId);

    // Combine all messages, dedup
    const seen = new Set<string>();
    const texts: string[] = [];
    for (const m of batch.messages) {
      const lower = (m.text || "").toLowerCase().trim();
      if (lower && !seen.has(lower)) {
        seen.add(lower);
        texts.push(m.text);
      }
    }

    const combined = texts.join("\n");
    const lastRaw = batch.messages[batch.messages.length - 1].raw;
    console.log(`[batcher] ${chatId}: flushing ${batch.messages.length} msgs → "${combined.slice(0, 60)}"`);

    try {
      await this.onBatch(chatId, combined, lastRaw);
    } catch (err) {
      console.error("[batcher] flush handler error:", err);
    }
  }
}
