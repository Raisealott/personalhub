import { CalendarEvent, EventInstance } from "./types";

// ─── Colors ──────────────────────────────────────────────────────────────────

export const COLOR_OPTIONS = [
  { label: "Blue", value: "blue", hex: "#3B82F6" },
  { label: "Green", value: "green", hex: "#22C55E" },
  { label: "Amber", value: "amber", hex: "#F59E0B" },
  { label: "Red", value: "red", hex: "#EF4444" },
  { label: "Purple", value: "purple", hex: "#A855F7" },
  { label: "Teal", value: "teal", hex: "#14B8A6" },
] as const;

const COLOR_MAP: Record<string, string> = Object.fromEntries(
  COLOR_OPTIONS.map(({ value, hex }) => [value, hex]),
);

export function getColorHex(color: string): string {
  return COLOR_MAP[color] ?? "#3B82F6";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function dateToDateInput(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function dateToTimeInput(date: Date): string {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ].join(":");
}

export function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(date.getDate() - date.getDay()); // back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ─── Month helpers ────────────────────────────────────────────────────────────

export function getMonthRange(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  start.setHours(0, 0, 0, 0);

  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/** Returns exactly 42 Date objects covering 6 weeks for the month grid */
export function getMonthGridDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];

  // Padding from previous month (0 if month starts on Sunday)
  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i)); // new Date(y, m, 0) = last day of prev month
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }

  // Pad to 42 cells (6 rows × 7 cols)
  let nextDay = 1;
  while (days.length < 42) {
    days.push(new Date(year, month + 1, nextDay++));
  }

  return days;
}

// ─── Recurring expansion ──────────────────────────────────────────────────────

export function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventInstance[] {
  const instances: EventInstance[] = [];

  for (const event of events) {
    const eventStart = new Date(event.start_time);
    const eventEnd = new Date(event.end_time);
    const duration = eventEnd.getTime() - eventStart.getTime();

    const pushInstance = (dayDate: Date) => {
      const instStart = new Date(dayDate);
      instStart.setHours(
        eventStart.getHours(),
        eventStart.getMinutes(),
        0,
        0,
      );
      const instEnd = new Date(instStart.getTime() + duration);
      instances.push({
        ...event,
        sourceId: event.id,
        instanceDate: instStart.toISOString(),
        start_time: instStart.toISOString(),
        end_time: instEnd.toISOString(),
      });
    };

    if (event.recurrence === "none") {
      // Only include if it falls within range
      if (eventStart >= rangeStart && eventStart <= rangeEnd) {
        instances.push({
          ...event,
          sourceId: event.id,
          instanceDate: event.start_time,
        });
      }
    } else if (event.recurrence === "daily") {
      const cursor = new Date(
        Math.max(eventStart.getTime(), rangeStart.getTime()),
      );
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= rangeEnd) {
        pushInstance(cursor);
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (event.recurrence === "weekly") {
      const cursor = new Date(rangeStart);
      cursor.setHours(0, 0, 0, 0);
      const eventStartDay = new Date(eventStart);
      eventStartDay.setHours(0, 0, 0, 0);
      while (cursor <= rangeEnd) {
        if (
          cursor.getDay() === eventStart.getDay() &&
          cursor >= eventStartDay
        ) {
          pushInstance(cursor);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (event.recurrence === "monthly") {
      const cursor = new Date(rangeStart);
      cursor.setHours(0, 0, 0, 0);
      const eventStartDay = new Date(eventStart);
      eventStartDay.setHours(0, 0, 0, 0);
      while (cursor <= rangeEnd) {
        if (
          cursor.getDate() === eventStart.getDate() &&
          cursor >= eventStartDay
        ) {
          pushInstance(cursor);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return instances;
}
