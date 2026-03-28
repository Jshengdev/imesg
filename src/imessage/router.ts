import { startListening } from './sdk';

// This will be expanded later to import and call the actual agent and listener handlers
const agentHandler = (message: any) => {
  console.log('Agent received:', message);
};

const listenerHandler = (message: any) => {
  console.log('Listener received:', message);
};

export const routeMessage = (message: any) => {
  // This logic will need to be updated to properly identify the agent thread
  if (message.chat_id === 'agent_thread_id') { 
    agentHandler(message);
  } else {
    listenerHandler(message);
  }
};

export const startRouter = () => {
  startListening(routeMessage);
  console.log('iMessage router started...');
};
