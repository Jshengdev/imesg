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
    id: msg.id || msg.guid || '',
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

function getSDK(): IMessageSDK {
  if (!sdk) sdk = new IMessageSDK();
  return sdk;
}

export async function sendText(to: string, text: string): Promise<void> {
  try {
    await getSDK().send(to, text);
  } catch (e) {
    console.error('[sdk] sendText failed:', e);
  }
}

export async function sendAudio(to: string, audioPath: string, caption?: string): Promise<void> {
  try {
    await getSDK().send(to, { files: [audioPath], text: caption });
  } catch (e) {
    console.error('[sdk] sendAudio failed:', e);
  }
}

export async function sendWithVoice(to: string, text: string, tts: (t: string) => Promise<string>): Promise<string | null> {
  let audioPath: string | null = null;
  try { audioPath = await tts(text); } catch (e) { console.warn("[sdk] TTS failed, falling back to text:", e); }
  if (audioPath) await sendAudio(to, audioPath, text);
  else await sendText(to, text);
  return audioPath;
}

export async function startListening(onMessage: (msg: NormalizedMessage) => void): Promise<void> {
  const s = getSDK();
  await s.startWatching({
    onMessage: async (raw: any) => {
      const msg = normalizeMessage(raw);
      if (!msg.id || processedIds.has(msg.id)) return;
      if (processedIds.size >= MAX_PROCESSED) processedIds.clear();
      processedIds.add(msg.id);
      onMessage(msg);
    },
  });
  console.log('[sdk] listening for messages');
}
