import { config } from '../config';
import type { NormalizedMessage } from './sdk';

export function routeMessage(msg: NormalizedMessage): 'agent' | 'listener' | 'ignore' {
  if (msg.chatId === config.AGENT_CHAT_IDENTIFIER) {
    return msg.isFromMe ? 'ignore' : 'agent';
  }
  return 'listener';
}
