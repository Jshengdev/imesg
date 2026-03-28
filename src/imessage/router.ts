import type { NormalizedMessage } from './sdk';

export function routeMessage(msg: NormalizedMessage): 'agent' | 'ignore' {
  // Ignore our own outgoing messages
  if (msg.isFromMe) return 'ignore';
  return 'agent';
}
