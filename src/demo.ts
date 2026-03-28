let virtualTime: number | null = null;
let demoMode = false;

export function now(): number {
  return virtualTime ?? Date.now();
}

export function nowDate(): Date {
  return new Date(now());
}

export function isDemoMode(): boolean {
  return demoMode;
}

export function setDemoMode(enabled: boolean): void {
  demoMode = enabled;
  console.log(`[demo] demo mode ${enabled ? "on" : "off"}`);
}

export function setVirtualTime(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  virtualTime = d.getTime();
  console.log(`[demo] virtual time set to ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`);
  return d;
}

export function clearVirtualTime(): void {
  virtualTime = null;
  console.log("[demo] virtual time cleared");
}
