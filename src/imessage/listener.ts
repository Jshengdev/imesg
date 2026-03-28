import { IMessage, getIMessage } from '@photon-ai/imessage-kit';
import { processMessage } from '../agent';

let imessage: IMessage;

async function main() {
    imessage = await getIMessage();

    imessage.on('message', async (message) => {
        console.log('New message received:', message.text);
        if (message.fromMe) {
            return;
        }
        await processMessage(message);
    });

    console.log('iMessage listener started');
}

main().catch(console.error);
