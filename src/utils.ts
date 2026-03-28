export function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function normalizeNameWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(w => w.length > 2);
}
