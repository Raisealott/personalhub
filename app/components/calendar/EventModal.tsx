"use client";

import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { EventInstance, EventFormData, Recurrence } from "./types";
import { COLOR_OPTIONS, dateToDateInput, dateToTimeInput, addOneHour } from "./utils";

interface EventModalProps {
  isOpen: boolean;
  event?: EventInstance | null;
  /** Label shown above the form when editing a recurring event */
  recurringEditMode?: "this" | "all" | null;
  initialDate?: string; // YYYY-MM-DD
  initialTime?: string; // HH:MM
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function EventModal({
  isOpen,
  event,
  recurringEditMode,
  initialDate,
  initialTime,
  onClose,
  onSave,
  onDelete,
}: EventModalProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("blue");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Populate form whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (event) {
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      setTitle(event.title);
      setDate(dateToDateInput(start));
      setStartTime(dateToTimeInput(start));
      setEndTime(dateToTimeInput(end));
      setColor(event.color || "blue");
      setCategory(event.category || "");
      setRecurrence(event.recurrence || "none");
    } else {
      const now = new Date();
      const base = initialTime ?? "09:00";
      setTitle("");
      setDate(initialDate ?? dateToDateInput(now));
      setStartTime(base);
      setEndTime(addOneHour(base));
      setColor("blue");
      setCategory("");
      setRecurrence("none");
    }
  }, [isOpen, event, initialDate, initialTime]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), date, startTime, endTime, color, category, recurrence });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const isEdit = !!event;
  const scopeLabel =
    recurringEditMode === "this"
      ? "Editing this occurrence only"
      : recurringEditMode === "all"
        ? "Editing all future events"
        : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {isEdit ? "Edit Event" : "New Event"}
            </h2>
            {scopeLabel && (
              <p className="text-xs text-indigo-500 mt-0.5">{scopeLabel}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Date + Start + End */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Work, Personal, Health…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Color swatches */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Color
            </label>
            <div className="flex gap-2.5">
              {COLOR_OPTIONS.map(({ value, hex, label }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => setColor(value)}
                  className="w-6 h-6 rounded-full transition-transform focus:outline-none"
                  style={{
                    backgroundColor: hex,
                    outline: color === value ? `2px solid ${hex}` : "none",
                    outlineOffset: "2px",
                    transform: color === value ? "scale(1.25)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Repeat
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
          <div>
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 size={13} />
                {deleting ? "Deleting…" : isEdit && event?.recurrence !== "none" ? "Delete all" : "Delete"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="px-4 py-1.5 text-xs font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
