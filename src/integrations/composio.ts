import { Composio } from '@composio/core';
import { config } from '../config';

let composio: Composio | null = null;
let initDone = false;

async function ensureInit() {
  if (initDone) {
    return;
  }
  initDone = true;
  try {
    if (!config.composioApiKey) {
      throw new Error('COMPOSIO_API_KEY is not set');
    }
    composio = new Composio({ apiKey: config.composioApiKey });
    // A simple check to see if the connection is valid
    await composio.apps.list();
  } catch (error) {
    console.warn('Composio initialization failed, staying in mock mode.', error);
    composio = null;
  }
}

export function isMockMode(): boolean {
  return composio === null;
}

export async function getEntity(userId = 'default') {
  await ensureInit();
  if (isMockMode()) {
    throw new Error('Composio is in mock mode, cannot get entity.');
  }
  return composio!.getEntity(userId);
}

const DEFAULT_SEARCH_KEYS = ["items", "events", "messages", "emails", "threads", "data", "results"];

export function findArrayInResponse(data: any, keys: string[] = DEFAULT_SEARCH_KEYS, depth = 0): any[] {
  if (depth > 5) {
    return [];
  }

  if (Array.isArray(data) && data.length > 0) {
    return data;
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // First, check the preferred keys
    for (const key of keys) {
      if (key in data && Array.isArray(data[key]) && data[key].length > 0) {
        return data[key];
      }
    }

    // If not found, recurse into all properties
    for (const key in data) {
      const result = findArrayInResponse(data[key], keys, depth + 1);
      if (result.length > 0) {
        return result;
      }
    }
  }

  return [];
}

export async function executeWithFallback(
  strategies: { actionName: string; params: any }[],
  searchKeys: string[] = DEFAULT_SEARCH_KEYS,
  label: string
): Promise<any[]> {
  await ensureInit();
  if (isMockMode()) {
    console.log(`Composio is in mock mode. Skipping execution for "${label}".`);
    return [];
  }

  const entity = await getEntity();

  for (const strategy of strategies) {
    try {
      console.log(`Executing action: ${strategy.actionName} for "${label}"`);
      const response = await entity.execute(strategy.actionName, strategy.params);
      const results = findArrayInResponse(response, searchKeys);
      if (results.length > 0) {
        console.log(`Found ${results.length} results for "${label}" using action ${strategy.actionName}.`);
        return results;
      }
    } catch (error) {
      console.warn(`Execution failed for action ${strategy.actionName} in "${label}":`, error);
    }
  }

  console.log(`No results found for "${label}" after trying all strategies.`);
  return [];
}
