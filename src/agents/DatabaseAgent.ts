
import { promises as fs } from 'fs';
import path from 'path';
import { Task } from '../orchestrator';

export const DatabaseAgent = {
  name: 'Database Agent',
  execute: async (task: Task): Promise<void> => {
    console.log(`Executing task with Database Agent: ${task.description}`);
    const dbPath = path.join(__dirname, '..', 'memory', 'db.ts');
    const comment = `// ${task.description}\n`;
    await fs.appendFile(dbPath, comment);
  },
};
