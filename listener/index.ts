import "dotenv/config";
import { IMessageSDK } from "@photon-ai/imessage-kit";

const AGENT_URL = process.env.AGENT_URL;
const SECRET = process.env.LISTENER_SECRET || "nudge-demo-2026";
const OWNER_PHONE = process.env.OWNER_PHONE;
const IGNORE_IDS = (process.env.IGNORE_CHAT_IDS || "").split(",").map(s => s.trim()).filter(Boolean);

if (!AGENT_URL) { console.error("[listener] AGENT_URL required in .env"); process.exit(1); }
if (!OWNER_PHONE) { console.error("[listener] OWNER_PHONE required in .env"); process.exit(1); }

console.log(`[listener] starting — forwarding to ${AGENT_URL}`);
console.log(`[listener] owner: ${OWNER_PHONE}`);
console.log(`[listener] ignoring chats: ${IGNORE_IDS.join(", ") || "none"}`);

const sdk = new IMessageSDK({
  debug: false,
  watcher: { pollInterval: 2000, excludeOwnMessages: true },
});

const processedIds = new Set<string>();
const MAX_PROCESSED = 10_000;
let pendingBatch: any[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const BATCH_MS = 3000; // batch messages for 3s before sending

async function flushBatch(): Promise<void> {
  if (!pendingBatch.length) return;
  const batch = [...pendingBatch];
  pendingBatch = [];
  flushTimer = null;

  try {
    const res = await fetch(`${AGENT_URL}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SECRET}`,
      },
      body: JSON.stringify({
        owner_phone: OWNER_PHONE,
        messages: batch,
      }),
    });

    if (res.ok) {
      console.log(`[listener] → sent ${batch.length} message(s) to agent`);
    } else {
      console.warn(`[listener] agent returned ${res.status}: ${await res.text()}`);
    }
  } catch (err) {
    console.error(`[listener] failed to reach agent:`, (err as Error).message);
  }
}

function queueMessage(msg: any): void {
  pendingBatch.push(msg);
  if (!flushTimer) {
    flushTimer = setTimeout(flushBatch, BATCH_MS);
  }
}

await sdk.startWatching({
  onMessage: async (raw: any) => {
    try {
      const id = String(raw.id || raw.guid || "");
      if (!id || processedIds.has(id)) return;
      if (processedIds.size >= MAX_PROCESSED) processedIds.clear();
      processedIds.add(id);

      // Skip own outgoing messages
      if (raw.isFromMe) return;

      const chatId = raw.chatId || raw.chatGuid || raw.chat_id || "";
      const sender = raw.sender || raw.senderName || raw.from || "";
      const text = raw.text || raw.body || raw.content || raw.message || "";

      // Skip messages in the agent chat (Teri talking to Nudge — agent handles those)
      if (IGNORE_IDS.some(id => chatId.includes(id) || sender.includes(id))) return;

      // Skip empty messages
      if (!text.trim()) return;

      const isGroupChat = Boolean(raw.isGroupChat || raw.isGroup || raw.chatType === "group");

      console.log(`[listener] ${sender}${isGroupChat ? " (group)" : ""}: ${text.slice(0, 60)}`);

      queueMessage({
        id,
        text,
        sender,
        chat_id: chatId,
        is_group: isGroupChat,
        timestamp: raw.date ? new Date(raw.date).getTime() : Date.now(),
      });
    } catch (err) {
      console.error("[listener] error processing message:", err);
    }
  },
  onError: (err: any) => {
    console.error("[listener] watcher error:", err);
  },
});

console.log("[listener] watching messages — forwarding to agent");

// Keep the process alive; startWatching resolves immediately and the poll
// interval alone does not hold the event loop open in all SDK versions.
await new Promise(() => {});
