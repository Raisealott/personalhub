"use client";

import { useEffect, useRef } from "react";
import { EventInstance } from "./types";
import {
  getWeekDays,
  isSameDay,
  formatHourLabel,
  formatTime,
  getColorHex,
} from "./utils";

const HOUR_HEIGHT = 64; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface WeekViewProps {
  weekStart: Date;
  instances: EventInstance[];
  today: Date;
  onEventClick: (instance: EventInstance) => void;
  onSlotClick: (date: Date) => void;
}

export default function WeekView({
  weekStart,
  instances,
  today,
  onEventClick,
  onSlotClick,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = getWeekDays(weekStart);

  // Scroll to current hour on mount / week change
  useEffect(() => {
    if (scrollRef.current) {
      const hour = new Date().getHours();
      scrollRef.current.scrollTop = Math.max(0, hour * HOUR_HEIGHT - 120);
    }
  }, [weekStart]);

  const handleColumnClick = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    // Calculate the absolute position within the column (accounts for scroll)
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hour = Math.max(0, Math.min(23, Math.floor(y / HOUR_HEIGHT)));
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    onSlotClick(d);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day headers (sticky) */}
      <div className="flex border-b border-gray-200 bg-white shrink-0">
        <div className="w-14 shrink-0" />
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className="flex-1 py-2.5 text-center border-l border-gray-100 first:border-l-0"
            >
              <p className="text-xs text-gray-500 select-none">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <div
                className={`text-sm font-semibold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full select-none ${
                  isToday
                    ? "bg-indigo-500 text-white"
                    : "text-gray-900"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: HOUR_HEIGHT * 24 }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 relative select-none">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-xs text-gray-400"
                style={{ top: hour * HOUR_HEIGHT - 8 }}
              >
                {hour !== 0 ? formatHourLabel(hour) : ""}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayInstances = instances.filter((e) =>
              isSameDay(new Date(e.start_time), day),
            );

            return (
              <div
                key={day.toISOString()}
                className="flex-1 relative border-l border-gray-100 cursor-pointer"
                style={{ height: HOUR_HEIGHT * 24 }}
                onClick={(e) => handleColumnClick(day, e)}
              >
                {/* Hour separator lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full pointer-events-none"
                    style={{
                      top: hour * HOUR_HEIGHT,
                      height: HOUR_HEIGHT,
                      borderTop: hour === 0 ? "none" : "1px solid #f3f4f6",
                    }}
                  />
                ))}

                {/* Current time indicator */}
                {isSameDay(day, today) && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{
                      top:
                        ((new Date().getHours() * 60 +
                          new Date().getMinutes()) /
                          60) *
                        HOUR_HEIGHT,
                    }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 -ml-1 shrink-0" />
                      <div className="flex-1 h-px bg-indigo-500" />
                    </div>
                  </div>
                )}

                {/* Event blocks */}
                {dayInstances.map((event) => {
                  const start = new Date(event.start_time);
                  const end = new Date(event.end_time);
                  const startMins = start.getHours() * 60 + start.getMinutes();
                  const endMins = Math.min(
                    end.getHours() * 60 + end.getMinutes(),
                    24 * 60,
                  );
                  const top = (startMins / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    ((endMins - startMins) / 60) * HOUR_HEIGHT,
                    22,
                  );

                  return (
                    <div
                      key={event.id + event.instanceDate}
                      className="absolute left-0.5 right-0.5 rounded px-1.5 py-1 overflow-hidden z-10 cursor-pointer hover:brightness-90 transition-all"
                      style={{
                        top,
                        height,
                        backgroundColor: getColorHex(event.color),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      <p className="text-xs text-white font-medium leading-tight truncate">
                        {event.title}
                      </p>
                      {height > 32 && (
                        <p className="text-xs text-white/75 leading-tight truncate">
                          {formatTime(start)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
