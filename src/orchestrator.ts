
import { promises as fs } from 'fs';
import path from 'path';
import { ListenerAgent } from './agents/ListenerAgent';
import { AgentAgent } from './agents/AgentAgent';
import { ComposioAgent } from './agents/ComposioAgent';
import { DatabaseAgent } from './agents/DatabaseAgent';
import { RefinementAgent } from './agents/RefinementAgent';

// Define the structure of a task
export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
}

// Define the structure of an agent
export interface Agent {
  name: string;
  execute: (task: Task) => Promise<void>;
}

class Orchestrator {
  private tasks: Task[] = [];
  private agents: Agent[] = [];
  private specFilePath: string;
  private tasksFilePath: string;
  private checklistFilePath: string;

  constructor() {
    this.specFilePath = path.join(__dirname, '..', 'spec list', 'spec.md');
    this.tasksFilePath = path.join(__dirname, '..', 'spec list', 'tasks.md');
    this.checklistFilePath = path.join(__dirname, '..', 'spec list', 'checklist.md');
    this.registerAgents();
  }

  // Load tasks from the markdown files
  async loadTasks(): Promise<void> {
    const tasksFileContent = await fs.readFile(this.tasksFilePath, 'utf-8');
    const checklistFileContent = await fs.readFile(this.checklistFilePath, 'utf-8');

    const tasksFromTasksMd = this.parseMarkdownTasks(tasksFileContent);
    const tasksFromChecklistMd = this.parseMarkdownTasks(checklistFileContent);

    const allTasks = [...tasksFromTasksMd, ...tasksFromChecklistMd];
    const uniqueTasks = this.getUniqueTasks(allTasks);

    this.tasks = uniqueTasks;
    console.log('Tasks loaded:', this.tasks);
  }

  private parseMarkdownTasks(content: string): Omit<Task, 'id' | 'status'>[] {
    const lines = content.split('\n');
    const tasks: Omit<Task, 'id' | 'status'>[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('- [ ]')) {
        tasks.push({ description: line.trim().replace('- [ ] ', '') });
      }
    }

    return tasks;
  }

  private getUniqueTasks(tasks: Omit<Task, 'id' | 'status'>[]): Task[] {
    const uniqueDescriptions = new Set<string>();
    const uniqueTasks: Task[] = [];
    let idCounter = 1;

    for (const task of tasks) {
      if (!uniqueDescriptions.has(task.description)) {
        uniqueDescriptions.add(task.description);
        uniqueTasks.push({ ...task, id: `task-${idCounter++}`, status: 'pending' });
      }
    }

    return uniqueTasks;
  }

  // Register all agents
  private registerAgents(): void {
    this.agents.push(ListenerAgent);
    this.agents.push(AgentAgent);
    this.agents.push(ComposioAgent);
    this.agents.push(DatabaseAgent);
    this.agents.push(RefinementAgent);
  }

  // Find an agent to execute the task
  private findAgentForTask(task: Task): Agent | undefined {
    const description = task.description.toLowerCase();
    if (description.includes('listener')) {
      return this.agents.find(agent => agent.name === 'Listener Agent');
    }
    if (description.includes('agent')) {
      return this.agents.find(agent => agent.name === 'Agent Agent');
    }
    if (description.includes('composio') || description.includes('google calendar') || description.includes('gmail')) {
      return this.agents.find(agent => agent.name === 'Composio Agent');
    }
    if (description.includes('database') || description.includes('db')) {
        return this.agents.find(agent => agent.name === 'Database Agent');
    }
    if (description.includes('refinement') || description.includes('testing') || description.includes('error handling')) {
        return this.agents.find(agent => agent.name === 'Refinement Agent');
    }
    return undefined;
  }

  private fileModificationTimes: Map<string, number> = new Map();

  // ... (constructor and other methods)

  // Run the orchestration loop
  async run(): Promise<void> {
    await this.loadTasks();

    for (const task of this.tasks) {
      if (task.status === 'pending') {
        console.log(`Starting task: ${task.description}`);
        task.status = 'in_progress';
        
        const agent = this.findAgentForTask(task);
        if (agent) {
          const filePath = this.getFilePathForTask(task);
          if (filePath) {
            const stats = await fs.stat(filePath);
            this.fileModificationTimes.set(filePath, stats.mtimeMs);
          }

          await agent.execute(task);
          task.status = 'completed';
          console.log(`Task completed: ${task.description}`);
          await this.verify(task);
        } else {
          console.error(`No agent found for task: ${task.description}`);
        }
      }
    }
  }

  // Verify the task completion
  async verify(task: Task): Promise<void> {
    console.log(`Verifying task: ${task.description}`);
    const filePath = this.getFilePathForTask(task);
    if (filePath) {
      const previousMtime = this.fileModificationTimes.get(filePath);
      const currentStats = await fs.stat(filePath);
      if (previousMtime && currentStats.mtimeMs > previousMtime) {
        console.log(`Verification successful: ${filePath} has been modified.`);
      } else {
        console.log(`Verification failed: ${filePath} has not been modified.`);
      }
    }
  }

  private getFilePathForTask(task: Task): string | undefined {
    const description = task.description.toLowerCase();
    if (description.includes('listener')) {
      return path.join(__dirname, 'imessage', 'listener.ts');
    }
    if (description.includes('agent')) {
      return path.join(__dirname, 'imessage', 'router.ts');
    }
    if (description.includes('composio')) {
      return path.join(__dirname, 'composio', 'calendar.ts');
    }
    if (description.includes('database') || description.includes('db')) {
      return path.join(__dirname, 'memory', 'db.ts');
    }
    return undefined;
  }
}

const orchestrator = new Orchestrator();
orchestrator.run().catch(console.error);
