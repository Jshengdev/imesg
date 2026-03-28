import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const { minimaxApiKey, minimaxApiHost } = config;

export const textToSpeech = async (text: string): Promise<string> => {
  const response = await fetch(`${minimaxApiHost}/v1/text_to_speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${minimaxApiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-Speech-2.8',
      input: text,
      voice: 'male-01'
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const fileName = `${uuidv4()}.m4a`;
  const filePath = path.join(process.cwd(), 'audio', fileName);

  await fs.promises.writeFile(filePath, Buffer.from(audioBuffer));

  return filePath;
};
