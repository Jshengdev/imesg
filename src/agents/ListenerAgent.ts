
import { promises as fs } from 'fs';
import path from 'path';
import { Task } from '../orchestrator';

export const ListenerAgent = {
  name: 'Listener Agent',
  execute: async (task: Task): Promise<void> => {
    console.log(`Executing task with Listener Agent: ${task.description}`);
    const listenerPath = path.join(__dirname, '..', 'imessage', 'listener.ts');
    const comment = `// ${task.description}\n`;
    await fs.appendFile(listenerPath, comment);
  },
};
