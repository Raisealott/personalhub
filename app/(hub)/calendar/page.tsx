"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CalendarEvent,
  EventInstance,
  CalendarView,
  EventFormData,
} from "@/app/components/calendar/types";
import {
  expandRecurringEvents,
  getWeekRange,
  getMonthRange,
  getWeekStart,
  dateToDateInput,
  dateToTimeInput,
} from "@/app/components/calendar/utils";
import MonthView from "@/app/components/calendar/MonthView";
import WeekView from "@/app/components/calendar/WeekView";
import EventModal from "@/app/components/calendar/EventModal";
import RecurringDialog from "@/app/components/calendar/RecurringDialog";

export default function CalendarPage() {
  const today = new Date();

  // ─── View & navigation ────────────────────────────────────────────────────
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

  // ─── Events ───────────────────────────────────────────────────────────────
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventInstance | null>(null);
  const [recurringEditMode, setRecurringEditMode] = useState<
    "this" | "all" | null
  >(null);
  const [modalInitialDate, setModalInitialDate] = useState("");
  const [modalInitialTime, setModalInitialTime] = useState("09:00");

  // ─── Recurring dialog state ───────────────────────────────────────────────
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [pendingInstance, setPendingInstance] =
    useState<EventInstance | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from("calendar_events")
      .select("*")
      .order("start_time", { ascending: true });

    if (!error && data) {
      setEvents(data as CalendarEvent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  // ─── Visible instances ────────────────────────────────────────────────────
  const visibleRange =
    view === "month"
      ? getMonthRange(currentDate)
      : getWeekRange(currentDate);

  const instances = expandRecurringEvents(
    events,
    visibleRange.start,
    visibleRange.end,
  );

  // ─── Navigation ───────────────────────────────────────────────────────────
  const navigate = (dir: 1 | -1) => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month") {
        next.setMonth(next.getMonth() + dir);
      } else {
        next.setDate(next.getDate() + dir * 7);
      }
      return next;
    });
  };

  // ─── Header title ─────────────────────────────────────────────────────────
  const headerTitle = (() => {
    if (view === "month") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    const { start, end } = getWeekRange(currentDate);
    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString("en-US", { month: "long" })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  })();

  // ─── Create modal ─────────────────────────────────────────────────────────
  const openCreateModal = (date: Date) => {
    setEditingEvent(null);
    setRecurringEditMode(null);
    setModalInitialDate(dateToDateInput(date));
    setModalInitialTime(dateToTimeInput(date));
    setModalOpen(true);
  };

  // ─── Edit modal ───────────────────────────────────────────────────────────
  const handleEventClick = (instance: EventInstance) => {
    if (instance.recurrence !== "none") {
      setPendingInstance(instance);
      setRecurringDialogOpen(true);
    } else {
      setEditingEvent(instance);
      setRecurringEditMode(null);
      setModalOpen(true);
    }
  };

  const handleRecurringChoice = (choice: "this" | "all") => {
    setRecurringDialogOpen(false);
    if (pendingInstance) {
      setEditingEvent(pendingInstance);
      setRecurringEditMode(choice);
      setModalOpen(true);
    }
    setPendingInstance(null);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (formData: EventFormData) => {
    const start = new Date(`${formData.date}T${formData.startTime}`);
    const end = new Date(`${formData.date}T${formData.endTime}`);

    const record = {
      title: formData.title,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      color: formData.color,
      category: formData.category,
      recurrence: formData.recurrence,
    };

    if (editingEvent) {
      if (recurringEditMode === "this") {
        // Create a new one-time copy for this specific occurrence
        await supabase
          .from("calendar_events")
          .insert({ ...record, recurrence: "none" });
      } else {
        // Update the master record (affects whole series)
        await supabase
          .from("calendar_events")
          .update(record)
          .eq("id", editingEvent.sourceId);
      }
    } else {
      await supabase.from("calendar_events").insert(record);
    }

    closeModal();
    void fetchEvents();
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!editingEvent) return;
    await supabase
      .from("calendar_events")
      .delete()
      .eq("id", editingEvent.sourceId);
    closeModal();
    void fetchEvents();
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
    setRecurringEditMode(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={16} />
          </button>

          <h1 className="text-sm font-semibold text-gray-900 min-w-[200px] ml-1">
            {headerTitle}
          </h1>

          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-2.5 py-1 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
        </div>

        {/* Month / Week pill toggle */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                view === v
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar body */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-400">Loading…</p>
          </div>
        ) : view === "month" ? (
          <MonthView
            currentDate={currentDate}
            instances={instances}
            today={today}
            onDayClick={openCreateModal}
            onEventClick={handleEventClick}
          />
        ) : (
          <WeekView
            weekStart={getWeekStart(currentDate)}
            instances={instances}
            today={today}
            onEventClick={handleEventClick}
            onSlotClick={openCreateModal}
          />
        )}
      </div>

      {/* Create / Edit modal */}
      <EventModal
        isOpen={modalOpen}
        event={editingEvent}
        recurringEditMode={recurringEditMode}
        initialDate={modalInitialDate}
        initialTime={modalInitialTime}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={editingEvent ? handleDelete : undefined}
      />

      {/* Recurring choice dialog */}
      <RecurringDialog
        isOpen={recurringDialogOpen}
        onClose={() => {
          setRecurringDialogOpen(false);
          setPendingInstance(null);
        }}
        onChoice={handleRecurringChoice}
      />
    </div>
  );
}
