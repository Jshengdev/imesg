import { config } from '../config';
import { NormalizedMessage } from './sdk';

export const routeMessage = (msg: NormalizedMessage): 'agent' | 'listener' | 'ignore' => {
  if (msg.chatId === config.agentChatIdentifier) {
    return msg.isFromMe ? 'ignore' : 'agent';
  }
  return 'listener';
};
