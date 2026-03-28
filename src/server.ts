import http from "node:http";
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

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

export function startServer(): void {
  const server = http.createServer(async (req, res) => {
    const pathname = req.url ?? "/";

    if (req.method === "GET" && pathname === "/health") {
      res.writeHead(200).end("ok");
      return;
    }

    if (req.method === "POST" && pathname === "/api/messages") {
      if (req.headers.authorization !== `Bearer ${config.LISTENER_SECRET}`) {
        res.writeHead(401).end("unauthorized");
        return;
      }
      try {
        const body = await readBody(req);
        const payload = JSON.parse(body) as ListenerPayload;
        const result = await handleMessages(payload);
        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true, ...result }));
      } catch (err) {
        console.error("[server] error:", err);
        res.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: false, error: (err as Error).message }));
      }
      return;
    }

    res.writeHead(404).end("not found");
  });

  server.listen(config.LISTENER_PORT, () => {
    console.log(`[server] listening on port ${config.LISTENER_PORT}`);
  });
}
