import { getTaskQueue, getRecentConversation, getPersonDossier } from '../memory/db.js';
import { pullTodayEvents, findFreeBlocks, CalendarEvent, FreeBlock } from '../integrations/calendar.js';
import { pullUnreadEmails, EmailSummary } from '../integrations/gmail.js';

function fmtTime(d: Date): string {
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minStr = minutes.toString().padStart(2, '0');
  return `${hour12}:${minStr} ${ampm}`;
}

function fmtEvents(events: CalendarEvent[]): string {
  if (!events || events.length === 0) {
    return '## your schedule today\nNo events scheduled';
  }

  const lines = ['## your schedule today'];
  for (const event of events) {
    const time = fmtTime(event.start);
    const attendees = event.attendees.length > 0 ? ` (${event.attendees.join(', ')})` : '';
    lines.push(`- ${time}: ${event.title}${attendees}`);
  }
  return lines.join('\n');
}

function fmtFreeBlocks(blocks: FreeBlock[]): string {
  if (!blocks || blocks.length === 0) {
    return '## free blocks\nNo free blocks found';
  }

  const lines = ['## free blocks'];
  for (const block of blocks) {
    const startTime = fmtTime(block.start);
    const endTime = fmtTime(block.end);
    const durationMin = block.durationMin;
    lines.push(`- ${startTime}-${endTime} (${durationMin} min)`);
  }
  return lines.join('\n');
}

function fmtTasks(tasks: any[]): string {
  const topTasks = tasks ? tasks.slice(0, 10) : [];
  
  if (topTasks.length === 0) {
    return '## task queue\nNo pending tasks';
  }

  const lines = ['## task queue'];
  topTasks.forEach((task, index) => {
    let line = `${index + 1}. ${task.description}`;
    
    if (task.urgency !== undefined) {
      const urgencyLabel = getDayName(task.deadline);
      line += ` [urgency: ${task.urgency}]`;
    }
    
    if (task.deadline) {
      const dueLabel = getDayName(task.deadline);
      line += ` [due: ${dueLabel}]`;
    }
    
    lines.push(line);
  });
  return lines.join('\n');
}

function getDayName(dateStr: string): string {
  if (!dateStr) return 'unknown';
  
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const dayDiff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (dayDiff === 0) return 'today';
  if (dayDiff === 1) return 'tomorrow';
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function fmtEmails(emails: EmailSummary[]): string {
  const topEmails = emails ? emails.slice(0, 5) : [];
  
  if (topEmails.length === 0) {
    return '## unread emails\nNo unread emails';
  }

  const lines = ['## unread emails'];
  for (const email of topEmails) {
    const snippet = email.snippet.length > 50 ? email.snippet.slice(0, 50) + '...' : email.snippet;
    lines.push(`- from ${email.from}: ${email.subject} — ${snippet}`);
  }
  return lines.join('\n');
}

function fmtConversation(entries: any[]): string {
  if (!entries || entries.length === 0) {
    return '## recent conversation\nNo recent conversation';
  }

  const reversed = [...entries].reverse();
  const lines = ['## recent conversation'];
  
  for (const entry of reversed) {
    const role = entry.direction === 'in' ? 'user' : 'nudge';
    lines.push(`${role}: ${entry.content}`);
  }
  
  return lines.join('\n');
}

function getSectionOrder(intent?: string): string[] {
  switch (intent) {
    case 'task':
      return ['conversation', 'tasks', 'blocks', 'events', 'emails'];
    case 'email':
      return ['conversation', 'emails', 'tasks', 'events', 'blocks'];
    case 'schedule':
      return ['conversation', 'events', 'blocks', 'tasks', 'emails'];
    case 'draft':
      return ['conversation', 'emails', 'tasks', 'events', 'blocks'];
    case 'person':
      return ['conversation', 'tasks', 'emails', 'events', 'blocks'];
    default:
      return ['conversation', 'events', 'blocks', 'tasks', 'emails'];
  }
}

export function extractPersonName(text: string): string | null {
  const patterns = [
    /(?:what did|who said|tell me about|anything from|heard from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:from|to|with)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:Sarah|John|Mike|Tom|Lisa|Amy|Jim|Bob|Alice)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export function extractDraftRecipient(text: string): string | null {
  const patterns = [
    /(?:reply to|reply)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:about|regarding)/i,
    /(?:draft email|email)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:email|reply)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export async function assembleContext(intent?: string, userText?: string): Promise<string> {
  const results = await Promise.allSettled([
    pullTodayEvents(),
    getTaskQueue(),
    pullUnreadEmails(20),
    getRecentConversation(8)
  ]);

  let events: CalendarEvent[] = [];
  let tasks: any[] = [];
  let emails: EmailSummary[] = [];
  let conversation: any[] = [];

  if (results[0].status === 'fulfilled') {
    events = results[0].value;
  }

  if (results[1].status === 'fulfilled') {
    tasks = results[1].value;
  }

  if (results[2].status === 'fulfilled') {
    emails = results[2].value;
  }

  if (results[3].status === 'fulfilled') {
    conversation = results[3].value;
  }

  const freeBlocks = findFreeBlocks(events);
  const sectionOrder = getSectionOrder(intent);
  const sections: { [key: string]: string } = {
    conversation: fmtConversation(conversation),
    events: fmtEvents(events),
    blocks: fmtFreeBlocks(freeBlocks),
    tasks: fmtTasks(tasks),
    emails: fmtEmails(emails)
  };

  if ((intent === 'person' || intent === 'draft') && userText) {
    const name = intent === 'person' ? extractPersonName(userText) : extractDraftRecipient(userText);
    if (name) {
      const dossier = getPersonDossier(name);
      if (dossier) {
        sections['dossier'] = fmtDossier(dossier);
      }
    }
  }

  const orderedSections: string[] = [];
  for (const section of sectionOrder) {
    if (sections[section]) {
      orderedSections.push(sections[section]);
    }
  }

  if (sections['dossier']) {
    orderedSections.unshift(sections['dossier']);
  }

  return orderedSections.join('\n\n');
}

function fmtDossier(dossier: any): string {
  const lines = [`## ${dossier.name}'s dossier`];
  
  if (dossier.context_notes) {
    lines.push(`**Context notes**: ${dossier.context_notes}`);
  }
  
  if (dossier.last_contact) {
    const lastContact = new Date(dossier.last_contact).toLocaleDateString();
    lines.push(`**Last contact**: ${lastContact}`);
  }
  
  if (dossier.messages && dossier.messages.length > 0) {
    lines.push('\n**Recent messages**:');
    dossier.messages.slice(0, 3).forEach((msg: any) => {
      lines.push(`- [${msg.direction === 'in' ? 'received' : 'sent'}]: ${msg.content}`);
    });
  }
  
  if (dossier.tasks && dossier.tasks.length > 0) {
    lines.push('\n**Open tasks**:');
    dossier.tasks.slice(0, 3).forEach((task: any) => {
      lines.push(`- ${task.description}`);
    });
  }
  
  return lines.join('\n');
}
