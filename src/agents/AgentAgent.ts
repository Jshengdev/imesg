
import { promises as fs } from 'fs';
import path from 'path';
import { Task } from '../orchestrator';

export const AgentAgent = {
  name: 'Agent Agent',
  execute: async (task: Task): Promise<void> => {
    console.log(`Executing task with Agent Agent: ${task.description}`);
    const routerPath = path.join(__dirname, '..', 'imessage', 'router.ts');
    const comment = `// ${task.description}\n`;
    await fs.appendFile(routerPath, comment);
  },
};
