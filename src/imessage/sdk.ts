
import { IMessageSDK } from '@photon-ai/imessage-kit';

export interface NormalizedMessage {
  id: string;
  text: string;
  sender: string;
  chatId: string;
  isFromMe: boolean;
  isGroupChat: boolean;
  timestamp: number;
  attachments: {
    path: string;
    mimeType?: string;
  }[];
}

const normalizeMessage = (raw: any): NormalizedMessage => {
  return {
    id: raw.id || raw.guid,
    text: raw.text || raw.body || raw.content || raw.message,
    sender: raw.sender || raw.senderName || raw.from,
    chatId: raw.chatId || raw.chatGuid || raw.chat_id,
    isFromMe: Boolean(raw.isFromMe),
    isGroupChat: Boolean(raw.isGroupChat || raw.isGroup || raw.chatType === 'group'),
    timestamp: raw.date ? new Date(raw.date).getTime() : Date.now(),
    attachments: (raw.attachments || []).map((a: any) => ({
      path: a.path || a.filePath,
      mimeType: a.mimeType || a.mime_type,
    })),
  };
};

const processedIds = new Set<string>();
const MAX_PROCESSED_IDS = 10000;

const dedup = (message: NormalizedMessage): NormalizedMessage | null => {
  if (processedIds.has(message.id)) {
    return null;
  }
  if (processedIds.size >= MAX_PROCESSED_IDS) {
    processedIds.clear();
  }
  processedIds.add(message.id);
  return message;
};

let sdk: IMessageSDK | null = null;

const getSDK = (): IMessageSDK => {
  if (!sdk) {
    sdk = new IMessageSDK();
  }
  return sdk;
};

export const sendText = async (to: string, text: string) => {
  try {
    await getSDK().send(to, text);
  } catch (error) {
    console.error('Error sending text message:', error);
  }
};

export const sendAudio = async (to: string, audioPath: string, caption?: string) => {
  try {
    await getSDK().send(to, { files: [audioPath], text: caption });
  } catch (error) {
    console.error('Error sending audio message:', error);
  }
};

export const sendWithVoice = async (to: string, text: string, tts: any): Promise<string | null> => {
  try {
    const audioPath = await tts.speak(text);
    if (audioPath) {
      await sendAudio(to, audioPath);
      return audioPath;
    }
  } catch (error) {
    console.error('Error with TTS, falling back to text message:', error);
  }
  
  await sendText(to, text);
  return null;
};

export const startListening = (onMessage: (message: NormalizedMessage) => void) => {
  getSDK().startWatching((rawMessage) => {
    const normalized = normalizeMessage(rawMessage);
    const message = dedup(normalized);
    if (message) {
      onMessage(message);
    }
  });
};
