"use client";

import { EventInstance } from "./types";
import { getMonthGridDays, isSameDay, getColorHex } from "./utils";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_EVENTS = 3;

interface MonthViewProps {
  currentDate: Date;
  instances: EventInstance[];
  today: Date;
  onDayClick: (date: Date) => void;
  onEventClick: (instance: EventInstance) => void;
}

export default function MonthView({
  currentDate,
  instances,
  today,
  onDayClick,
  onEventClick,
}: MonthViewProps) {
  const days = getMonthGridDays(currentDate);
  const currentMonth = currentDate.getMonth();

  return (
    <div className="flex flex-col h-full">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-gray-200 bg-white shrink-0">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-xs font-medium text-gray-500 select-none"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 6-row × 7-col grid */}
      <div
        className="grid grid-cols-7 flex-1"
        style={{ gridTemplateRows: "repeat(6, 1fr)" }}
      >
        {days.map((day, idx) => {
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);
          const dayInstances = instances.filter((e) =>
            isSameDay(new Date(e.start_time), day),
          );
          const overflow = Math.max(dayInstances.length - MAX_VISIBLE_EVENTS, 0);

          return (
            <div
              key={idx}
              className={`border-b border-r border-gray-100 p-1.5 cursor-pointer hover:bg-gray-50/70 transition-colors overflow-hidden ${
                !isCurrentMonth ? "bg-gray-50/60" : "bg-white"
              }`}
              onClick={() => onDayClick(day)}
            >
              {/* Date number */}
              <div
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 select-none ${
                  isToday
                    ? "bg-indigo-500 text-white"
                    : isCurrentMonth
                      ? "text-gray-900"
                      : "text-gray-400"
                }`}
              >
                {day.getDate()}
              </div>

              {/* Event chips */}
              <div className="space-y-0.5">
                {dayInstances.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                  <div
                    key={event.id + event.instanceDate}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-white truncate cursor-pointer hover:brightness-95 transition-all"
                    style={{ backgroundColor: getColorHex(event.color) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <span className="truncate leading-tight">{event.title}</span>
                  </div>
                ))}
                {overflow > 0 && (
                  <p className="text-xs text-gray-400 px-1 select-none">
                    +{overflow} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
