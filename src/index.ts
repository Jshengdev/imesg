import "./config";
import { startListening } from "./imessage/sdk";
import { routeMessage } from "./imessage/router";
import { getDb, storeMessage, getUserByPhone, registerUser } from "./memory/db";
import { handleAgentMessage } from "./agent/handler";
import { startExtractionLoop } from "./listener/extractor";
import { startProactiveEngine } from "./agent/proactive";

console.log("[nudge] starting...");

try {
  getDb();
  console.log("[nudge] database ready");
} catch (e) {
  console.error("[nudge] database init failed:", e);
}

try {
  await startListening(async (msg) => {
    const route = routeMessage(msg);
    if (route === "ignore") return;

    // Auto-register user on first message
    const phone = msg.sender || msg.chatId;
    let user = getUserByPhone(phone);
    if (!user) {
      registerUser(phone, msg.chatId);
      user = getUserByPhone(phone);
    }
    const userId = user?.id ?? undefined;

    // Store with userId
    storeMessage({
      id: msg.id,
      user_id: userId,
      chat_id: msg.chatId,
      sender: msg.sender,
      content: msg.text,
      direction: "in",
      has_attachment: msg.attachments.length > 0,
      attachment_type: msg.attachments[0]?.mimeType,
      attachment_path: msg.attachments[0]?.path,
    });

    await handleAgentMessage(msg);
  });
  console.log("[nudge] listening.");
} catch (e) {
  console.error("[nudge] iMessage connection failed:", e);
  console.log("[nudge] running without iMessage — other systems still available");
}

try { startExtractionLoop(); } catch (e) { console.error("[nudge] extraction loop failed:", e); }
try { startProactiveEngine(); } catch (e) { console.error("[nudge] proactive engine failed:", e); }

console.log("[nudge] all systems up.");
