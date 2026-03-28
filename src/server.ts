import { storeMessage, getUserByPhone } from "./memory/db";
import { runExtractionOnce } from "./listener/extractor";
import { evaluate } from "./agent/proactive/decision-engine";

const PORT = parseInt(process.env.LISTENER_PORT || "3456");
const SECRET = process.env.LISTENER_SECRET || "nudge-demo-2026";

interface IncomingMessage {
  id: string;
  text: string;
  sender: string;
  chat_id: string;
  is_group: boolean;
  timestamp: number;
}

interface ListenerPayload {
  owner_phone: string;
  messages: IncomingMessage[];
}

async function handleMessages(payload: ListenerPayload): Promise<{ stored: number; extracted: number }> {
  const { owner_phone, messages } = payload;
  if (!messages?.length) return { stored: 0, extracted: 0 };

  const user = getUserByPhone(owner_phone);
  const userId = user?.id;
  const chatId = user?.chat_id;

  let stored = 0;
  for (const msg of messages) {
    storeMessage({
      id: msg.id,
      user_id: userId,
      chat_id: msg.chat_id,
      sender: msg.sender,
      content: msg.text,
      direction: "in",
    });
    stored++;
    console.log(`[server] stored from ${msg.sender}: ${msg.text.slice(0, 60)}`);
  }

  // Run extraction immediately on the new messages
  const extracted = await runExtractionOnce(userId);

  // If tasks were extracted, evaluate whether to proactively message the user
  if (extracted > 0 && userId && chatId) {
    const senders = [...new Set(messages.map(m => m.sender))].join(", ");
    const result = await evaluate(
      "listener",
      userId,
      chatId,
      owner_phone,
      `${extracted} task(s) extracted from messages by ${senders}`,
    );
    console.log(`[server] decision engine: ${result.action} (${result.reason})`);
  }

  return { stored, extracted };
}

export function startServer(): void {
  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      // Health check
      if (req.method === "GET" && new URL(req.url).pathname === "/health") {
        return new Response("ok");
      }

      // Message ingestion endpoint
      if (req.method === "POST" && new URL(req.url).pathname === "/api/messages") {
        // Auth check
        const auth = req.headers.get("Authorization");
        if (auth !== `Bearer ${SECRET}`) {
          return new Response("unauthorized", { status: 401 });
        }

        try {
          const payload = (await req.json()) as ListenerPayload;
          const result = await handleMessages(payload);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          console.error("[server] error:", err);
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      }

      return new Response("not found", { status: 404 });
    },
  });

  console.log(`[server] listening on port ${PORT} — ready for listener data`);
}
