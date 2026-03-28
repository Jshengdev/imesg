export type UserCtx = { userId: string; chatId: string; phone: string };

/** Bounded dedup set: check, bound-clear, add. Returns true if already seen (skip). */
export function dedupAdd(set: Set<string>, key: string, limit = 200): boolean {
  if (set.has(key)) return true;
  if (set.size >= limit) set.clear();
  set.add(key);
  return false;
}
