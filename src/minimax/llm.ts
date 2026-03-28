import OpenAI from 'openai';
import { MINIMAX_API_KEY } from '../config';

const openai = new OpenAI({
    apiKey: MINIMAX_API_KEY,
    baseURL: 'https://api.minimax.chat/v1',
});

export async function getCompletion(prompt: string) {
    if (!MINIMAX_API_KEY) {
        throw new Error('MINIMAX_API_KEY is not set');
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'abab5.5-chat',
            messages: [{ role: 'user', content: prompt }],
            stream: false,
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error getting completion from MiniMax:', error);
        throw error;
    }
}
