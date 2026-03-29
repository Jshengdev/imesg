import { Composio } from "composio-core";
import { config } from "../config";

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

// --- Per-user OAuth onboarding ---

// Normalize phone to a safe entity ID: +12134240682 → user-12134240682
function phoneToEntityId(phone: string): string {
  return "user-" + phone.replace(/[^0-9]/g, "");
}

export async function getUserEntity(phone: string) {
  if (isMockMode()) throw new Error("Composio in mock mode");
  return composio!.getEntity(phoneToEntityId(phone));
}

export async function checkUserConnected(phone: string): Promise<{ gmail: boolean; calendar: boolean }> {
  if (isMockMode()) return { gmail: false, calendar: false };
  try {
    const entity = composio!.getEntity(phoneToEntityId(phone));
    const connections = await entity.getConnections();
    const apps = (connections || []).map((c: any) => (c.appName || c.app || "").toLowerCase());
    return {
      gmail: apps.some((a: string) => a.includes("gmail")),
      calendar: apps.some((a: string) => a.includes("calendar") || a.includes("googlecalendar")),
    };
  } catch {
    return { gmail: false, calendar: false };
  }
}

export async function getOAuthLinks(phone: string): Promise<{ gmail?: string; calendar?: string }> {
  if (isMockMode()) return {};
  const entity = composio!.getEntity(phoneToEntityId(phone));
  const links: { gmail?: string; calendar?: string } = {};

  try {
    const gmailResult = await entity.initiateConnection({ appName: "gmail" });
    if (gmailResult.redirectUrl) links.gmail = gmailResult.redirectUrl;
  } catch (e) {
    console.warn("[composio] gmail oauth init failed:", (e as Error).message);
  }

  try {
    const calResult = await entity.initiateConnection({ appName: "googlecalendar" });
    if (calResult.redirectUrl) links.calendar = calResult.redirectUrl;
  } catch (e) {
    console.warn("[composio] calendar oauth init failed:", (e as Error).message);
  }

  return links;
}

// --- Execute with per-user entity ---

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
  phone?: string,
): Promise<any[]> {
  if (isMockMode()) return [];
  const entityId = phone ? phoneToEntityId(phone) : "default";
  console.log(`[composio] ${label}: using entity=${entityId} (phone=${phone || "none"})`);
  const entity = phone ? composio!.getEntity(entityId) : getEntity();
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
