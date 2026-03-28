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
  } catch (e) {
    console.error('[sdk] sendText failed:', e);
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
        console.log(`[sdk] raw #${messageCount}: sender=${raw?.sender} chatId=${raw?.chatId} fromMe=${raw?.isFromMe} text="${(raw?.text || '').slice(0, 50)}"`);

        const msg = normalizeMessage(raw);

        if (!msg.id) {
          console.warn('[sdk] skipping — no id');
          return;
        }

        if (processedIds.has(msg.id)) return;
        if (processedIds.size >= MAX_PROCESSED) processedIds.clear();
        processedIds.add(msg.id);

        console.log(`[sdk] → routing: from=${msg.sender} chat=${msg.chatId} fromMe=${msg.isFromMe} text="${msg.text.slice(0, 60)}"`);

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
