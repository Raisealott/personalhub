export type CalendarView = "month" | "week";

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export interface CalendarEvent {
  id: string;
  title: string;
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  color: string;
  category: string;
  recurrence: Recurrence;
  created_at: string;
}

/** A single rendered occurrence — may be one of many for recurring events */
export interface EventInstance extends CalendarEvent {
  sourceId: string; // original DB row id
  instanceDate: string; // ISO string of this specific occurrence's start
}

export interface EventFormData {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  color: string;
  category: string;
  recurrence: Recurrence;
}
