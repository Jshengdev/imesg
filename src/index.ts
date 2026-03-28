import "./config";
import { startListening } from "./imessage/sdk";
import { routeMessage } from "./imessage/router";
import { getDb, storeMessage } from "./memory/db";
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

// Boot iMessage listener
try {
  await startListening(async (msg) => {
    const route = routeMessage(msg);
    if (route === "listener") {
      storeMessage({
        id: msg.id,
        chat_id: msg.chatId,
        sender: msg.sender,
        content: msg.text,
        direction: "in",
        has_attachment: msg.attachments.length > 0,
        attachment_type: msg.attachments[0]?.mimeType,
        attachment_path: msg.attachments[0]?.path,
      });
    } else if (route === "agent") {
      await handleAgentMessage(msg);
    }
    // "ignore" → do nothing
  });
  console.log("[nudge] listening.");
} catch (e) {
  console.error("[nudge] iMessage connection failed:", e);
  console.log("[nudge] running without iMessage — other systems still available");
}

// Start background systems
try { startExtractionLoop(); } catch (e) { console.error("[nudge] extraction loop failed:", e); }
try { startProactiveEngine(); } catch (e) { console.error("[nudge] proactive engine failed:", e); }

console.log("[nudge] all systems up.");
