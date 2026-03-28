import { BasicKit } from '@photon-ai/imessage-kit';

const imessage = new BasicKit();

export const sendText = async (chatId: string, text: string) => {
  await imessage.sendText(chatId, text);
};

export const sendAudio = async (chatId: string, filePath: string) => {
  await imessage.sendFile(chatId, filePath);
};

export const startListening = (callback: (message: any) => void) => {
  imessage.listen(callback);
};
