
import { Task } from '../orchestrator';
import { exec } from 'child_process';

export const RefinementAgent = {
  name: 'Refinement Agent',
  execute: async (task: Task): Promise<void> => {
    console.log(`Executing task with Refinement Agent: ${task.description}`);
    if (task.description.toLowerCase().includes('lint')) {
      await new Promise<void>((resolve, reject) => {
        exec('bun run lint', (error, stdout, stderr) => {
          if (error) {
            console.error(`Linter failed: ${error}`);
            reject(error);
            return;
          }
          console.log(`Linter output: ${stdout}`);
          if (stderr) {
            console.error(`Linter errors: ${stderr}`);
          }
          resolve();
        });
      });
    }
  },
};
