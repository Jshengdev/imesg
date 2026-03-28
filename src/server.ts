import { config } from "./config";
import { storeMessage, getUserByPhone } from "./memory/db";
import { runExtractionOnce } from "./listener/extractor";
import { evaluate } from "./agent/proactive/decision-engine";

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

  for (const msg of messages) {
    storeMessage({
      id: msg.id,
      user_id: userId,
      chat_id: msg.chat_id,
      sender: msg.sender,
      content: msg.text,
      direction: "in",
    });
    console.log(`[server] stored from ${msg.sender}: ${msg.text.slice(0, 60)}`);
  }

  const extracted = await runExtractionOnce(userId);

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

  return { stored: messages.length, extracted };
}

export function startServer(): void {
  Bun.serve({
    port: config.LISTENER_PORT,
    async fetch(req) {
      const { pathname } = new URL(req.url);

      if (req.method === "GET" && pathname === "/health") {
        return new Response("ok");
      }

      if (req.method === "POST" && pathname === "/api/messages") {
        if (req.headers.get("Authorization") !== `Bearer ${config.LISTENER_SECRET}`) {
          return new Response("unauthorized", { status: 401 });
        }
        try {
          const payload = await req.json() as ListenerPayload;
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

  console.log(`[server] listening on port ${config.LISTENER_PORT}`);
}
