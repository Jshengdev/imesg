import { Composio } from "composio-core";
import { config } from "../config.js";

let composio: Composio | null = null;
let initDone = false;

function ensureInit(): void {
  if (initDone) return;
  initDone = true;
  try {
    composio = new Composio({ apiKey: config.COMPOSIO_API_KEY });
  } catch (err) {
    console.warn("[composio] init failed, mock mode:", err);
  }
}

export function isMockMode(): boolean {
  ensureInit();
  return composio === null;
}

export function getEntity(userId = "default") {
  if (isMockMode()) throw new Error("Composio in mock mode");
  return composio!.getEntity(userId);
}

export function findArrayInResponse(data: unknown, keys: string[], depth = 0): any[] {
  if (depth > 5) return [];
  if (Array.isArray(data) && data.length > 0) return data;
  if (typeof data === "object" && data !== null) {
    const o = data as Record<string, unknown>;
    for (const k of keys) {
      if (o[k] && Array.isArray(o[k])) return o[k] as any[];
    }
    for (const k of Object.keys(o)) {
      const found = findArrayInResponse(o[k], keys, depth + 1);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export async function executeWithFallback(
  strategies: { actionName: string; params: Record<string, unknown> }[],
  searchKeys: string[],
  label: string,
): Promise<any[]> {
  if (isMockMode()) return [];
  const entity = getEntity();
  for (const s of strategies) {
    try {
      const result = await entity.execute(s);
      const items = findArrayInResponse(result, searchKeys);
      if (items.length > 0) return items;
    } catch (err) {
      console.warn(`[${label}] ${s.actionName} failed:`, (err as Error).message);
    }
  }
  return [];
}
