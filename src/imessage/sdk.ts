import { IMessageSDK } from '@photon-ai/imessage-kit';

export interface NormalizedMessage {
  id: string;
  text: string;
  sender: string;
  chatId: string;
  isFromMe: boolean;
  isGroupChat: boolean;
  timestamp: number;
  attachments: { path: string; mimeType?: string }[];
}

const processedIds = new Set<string>();
const MAX_PROCESSED = 10_000;

function normalizeMessage(msg: any): NormalizedMessage {
  return {
    id: String(msg.id || msg.guid || ''),
    text: msg.text || msg.body || msg.content || msg.message || '',
    sender: msg.sender || msg.senderName || msg.from || '',
    chatId: msg.chatId || msg.chatGuid || msg.chat_id || '',
    isFromMe: Boolean(msg.isFromMe),
    isGroupChat: Boolean(msg.isGroupChat || msg.isGroup || msg.chatType === 'group'),
    timestamp: msg.date ? new Date(msg.date).getTime() : Date.now(),
    attachments: (msg.attachments || []).map((a: any) => ({
      path: a.path || a.filePath || '',
      mimeType: a.mimeType || a.mime_type,
    })),
  };
}

// Watcher doesn't include attachments — re-fetch when we detect the replacement character
async function enrichAttachments(msg: NormalizedMessage): Promise<NormalizedMessage> {
  const hasReplacementChar = msg.text.includes('\ufffc') || msg.text.includes('￼');
  if (hasReplacementChar) {
    console.log(`[sdk] enrichment check: att=${msg.attachments.length} paths=[${msg.attachments.map(a => a.path).join(',')}] mimes=[${msg.attachments.map(a => a.mimeType).join(',')}]`);
  }
  if (msg.attachments.length > 0 && msg.attachments[0].path) return msg;
  if (!hasReplacementChar) return msg;

  // Wait a moment for the iMessage DB to fully write the attachment record
  await new Promise(r => setTimeout(r, 1500));

  try {
    const result = await getSDK().getMessages({ limit: 10 });
    const messages = (result as any).messages || result;
    // Try matching by ID first, then by sender + recency
    let match = messages.find((m: any) => String(m.id) === msg.id || String(m.guid) === msg.id);
    if (!match) {
      // Fallback: find most recent message from same sender with attachments
      match = messages.find((m: any) =>
        m.sender === msg.sender &&
        m.attachments?.length > 0 &&
        ((m.text || '').includes('\ufffc') || (m.text || '').includes('￼'))
      );
    }
    if (match?.attachments?.length) {
      const enriched = match.attachments.map((a: any) => ({
        path: a.path || a.filePath || '',
        mimeType: a.mimeType || a.mime_type,
      })).filter((a: any) => a.path);
      if (enriched.length) {
        console.log(`[sdk] enriched ${msg.id} with ${enriched.length} attachment(s): ${enriched.map((a: any) => a.path).join(', ')}`);
        return { ...msg, attachments: enriched };
      }
    }
    console.warn(`[sdk] enrichment: found msg but no valid attachments`);
  } catch (e) {
    console.warn('[sdk] attachment enrichment failed:', e);
  }
  return msg;
}

let sdk: IMessageSDK | null = null;
let messageCount = 0;

function getSDK(): IMessageSDK {
  if (!sdk) {
    console.log('[sdk] creating IMessageSDK with debug=true');
    sdk = new IMessageSDK({
      debug: true,
      watcher: {
        pollInterval: 2000,
        excludeOwnMessages: true,
      },
    });
  }
  return sdk;
}

export async function sendText(to: string, text: string): Promise<void> {
  console.log(`[sdk] sendText → ${to}: ${text.slice(0, 80)}`);
  try {
    await getSDK().send(to, text);
  } catch (e: any) {
    // Timeout errors are usually false alarms — AppleScript sent it but SDK confirmation timed out
    if (e?.message?.includes('timeout')) {
      console.warn(`[sdk] send timeout (message likely delivered): ${text.slice(0, 40)}`);
    } else {
      console.error('[sdk] sendText failed:', e);
    }
  }
}

export async function sendBubbles(to: string, bubbles: string[]): Promise<void> {
  for (let i = 0; i < bubbles.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 600 + Math.random() * 600));
    await sendText(to, bubbles[i]);
  }
}

export async function startListening(onMessage: (msg: NormalizedMessage) => Promise<void> | void): Promise<void> {
  const s = getSDK();
  console.log('[sdk] starting watcher...');

  await s.startWatching({
    onMessage: async (raw: any) => {
      try {
        messageCount++;
        console.log(`[sdk] raw #${messageCount}: sender=${raw?.sender} chatId=${raw?.chatId} fromMe=${raw?.isFromMe} text="${(raw?.text || '').slice(0, 50)}" att=${raw?.attachments?.length || 0}`);

        let msg = normalizeMessage(raw);

        if (!msg.id) {
          console.warn('[sdk] skipping — no id');
          return;
        }

        if (processedIds.has(msg.id)) return;
        if (processedIds.size >= MAX_PROCESSED) processedIds.clear();
        processedIds.add(msg.id);

        // Enrich attachments if watcher didn't include them
        msg = await enrichAttachments(msg);

        console.log(`[sdk] → routing: from=${msg.sender} chat=${msg.chatId} fromMe=${msg.isFromMe} text="${msg.text.slice(0, 60)}" att=${msg.attachments.length}`);

        await onMessage(msg);
      } catch (err) {
        console.error('[sdk] onMessage callback error:', err);
      }
    },
    onError: (err: any) => {
      console.error('[sdk] watcher error:', err);
    },
  });

  console.log('[sdk] watcher active');
}
