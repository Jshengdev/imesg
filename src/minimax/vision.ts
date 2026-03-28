import OpenAI from 'openai';
import { config } from '../config';
import fs from 'fs';

const { minimaxApiKey, minimaxApiHost } = config;

const openai = new OpenAI({
  apiKey: minimaxApiKey,
  baseURL: `${minimaxApiHost}/v1`,
});

const imageToBase64 = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
};

export const analyzeImage = async (imagePath: string) => {
  const base64Image = imageToBase64(imagePath);

  const response = await openai.chat.completions.create({
    model: 'MiniMax-M2.7',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What is in this image?' },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ],
      },
    ],
  });

  return response.choices[0].message.content;
};
