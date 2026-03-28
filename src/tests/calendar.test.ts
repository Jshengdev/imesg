import { describe, test, expect } from "bun:test";

describe("Calendar Integration Tests", () => {
  test("should detect attachment type correctly", () => {
    const detectType = (path: string) => {
      const ext = path.toLowerCase().split(".").pop() || "";
      const imageExts = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"];
      const audioExts = ["m4a", "mp3", "wav", "aac", "aiff"];
      if (imageExts.includes(ext)) return "image";
      if (audioExts.includes(ext)) return "audio";
      return "file";
    };

    expect(detectType("photo.jpg")).toBe("image");
    expect(detectType("image.PNG")).toBe("image");
    expect(detectType("voice.m4a")).toBe("audio");
    expect(detectType("document.pdf")).toBe("file");
    expect(detectType("video.mp4")).toBe("file");
  });

  test("should calculate free blocks correctly", () => {
    const events = [
      { start: new Date("2026-03-28T10:00:00"), end: new Date("2026-03-28T11:00:00") },
      { start: new Date("2026-03-28T14:00:00"), end: new Date("2026-03-28T15:00:00") },
    ];

    const findFreeBlocks = (events: any[]) => {
      if (events.length === 0) return [];

      const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
      const freeBlocks: any[] = [];

      for (let i = 0; i < sorted.length - 1; i++) {
        const currentEnd = sorted[i].end;
        const nextStart = sorted[i + 1].start;

        if (nextStart > currentEnd) {
          const durationMs = nextStart.getTime() - currentEnd.getTime();
          const durationMin = Math.floor(durationMs / (1000 * 60));

          if (durationMin >= 30) {
            freeBlocks.push({
              start: currentEnd,
              end: nextStart,
              durationMin,
            });
          }
        }
      }

      return freeBlocks;
    };

    const freeBlocks = findFreeBlocks(events);
    expect(freeBlocks.length).toBe(1);
    expect(freeBlocks[0].durationMin).toBe(180);
  });

  test("should detect conflicts correctly", () => {
    const detectConflicts = (events: any[]) => {
      const conflicts: any[][] = [];
      const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

      for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const event1 = sorted[i];
          const event2 = sorted[j];

          if (event1.end > event2.start && event1.start < event2.end) {
            conflicts.push([event1, event2]);
          }
        }
      }

      return conflicts;
    };

    const conflictingEvents = [
      { title: "Meeting 1", start: new Date("2026-03-28T10:00:00"), end: new Date("2026-03-28T11:30:00") },
      { title: "Meeting 2", start: new Date("2026-03-28T11:00:00"), end: new Date("2026-03-28T12:00:00") },
    ];

    const nonConflictingEvents = [
      { title: "Meeting 1", start: new Date("2026-03-28T10:00:00"), end: new Date("2026-03-28T11:00:00") },
      { title: "Meeting 2", start: new Date("2026-03-28T11:00:00"), end: new Date("2026-03-28T12:00:00") },
    ];

    expect(detectConflicts(conflictingEvents).length).toBe(1);
    expect(detectConflicts(nonConflictingEvents).length).toBe(0);
  });

  test("should format events correctly", () => {
    const events = [
      {
        title: "Standup",
        start: new Date("2026-03-28T10:00:00"),
        end: new Date("2026-03-28T10:30:00"),
        attendees: ["Alice", "Bob"],
      },
    ];

    const formatEvent = (event: any) => {
      const duration = Math.round(
        (event.end.getTime() - event.start.getTime()) / (1000 * 60)
      );
      const time = event.start.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
      const prepStatus = event.attendees.length > 0 ? "prepped" : "no prep";
      const attendeeInfo =
        event.attendees.length > 0 ? `, ${event.attendees.length} attendees` : "";

      return `${time}: ${event.title} (${duration}min${attendeeInfo}) - ${prepStatus}`;
    };

    const formatted = formatEvent(events[0]);
    expect(formatted).toContain("10:00 AM");
    expect(formatted).toContain("Standup");
    expect(formatted).toContain("30min");
    expect(formatted).toContain("2 attendees");
  });
});
