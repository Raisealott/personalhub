"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type TaskPriority = "low" | "medium" | "high";
type TaskColor = "blue" | "green" | "amber" | "red" | "purple" | "teal";
type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";

type Task = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  priority: TaskPriority;
  category: string;
  color: TaskColor;
  completed: boolean;
  recurrence: TaskRecurrence;
  completed_at: string | null;
  created_at: string;
};

type TaskFormState = {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  category: string;
  color: TaskColor;
  recurrence: TaskRecurrence;
};

const DEFAULT_FORM: TaskFormState = {
  title: "",
  description: "",
  dueDate: "",
  priority: "medium",
  category: "",
  color: "blue",
  recurrence: "none",
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
};

const COLOR_DOT: Record<TaskColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  teal: "bg-teal-500",
};

const COLOR_SWATCHES: TaskColor[] = ["blue", "green", "amber", "red", "purple", "teal"];
const RECURRENCE_OPTIONS: TaskRecurrence[] = ["none", "daily", "weekly", "monthly"];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dueDateSortValue(value: string | null) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(`${value}T00:00:00`).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function sortTasks(tasks: Task[]) {
  return [...tasks].sort((a, b) => {
    const dueDiff = dueDateSortValue(a.due_date) - dueDateSortValue(b.due_date);

    if (dueDiff !== 0) {
      return dueDiff;
    }

    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function isOverdue(task: Task) {
  if (task.completed || !task.due_date) {
    return false;
  }

  const due = new Date(`${task.due_date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function formatDueDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toTask(row: Partial<Task> & { id: string; created_at: string }): Task {
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    due_date: row.due_date ?? null,
    priority: (row.priority ?? "medium") as TaskPriority,
    category: row.category ?? "",
    color: (row.color ?? "blue") as TaskColor,
    completed: row.completed ?? false,
    recurrence: (row.recurrence ?? "none") as TaskRecurrence,
    completed_at: row.completed_at ?? null,
    created_at: row.created_at,
  };
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TaskFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [deletePromptTaskId, setDeletePromptTaskId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadTasks = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("tasks")
        .select(
          "id, title, description, due_date, priority, category, color, completed, recurrence, completed_at, created_at",
        );

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("Failed to load tasks", error);
        setTasks([]);
        setIsLoading(false);
        return;
      }

      const loaded = (data ?? []).map((row) =>
        toTask(row as Partial<Task> & { id: string; created_at: string }),
      );

      setTasks(loaded);
      setIsLoading(false);
    };

    void loadTasks();

    return () => {
      isMounted = false;
    };
  }, []);

  const todoTasks = useMemo(() => sortTasks(tasks.filter((task) => !task.completed)), [tasks]);
  const completedTasks = useMemo(() => sortTasks(tasks.filter((task) => task.completed)), [tasks]);

  const openCreateModal = useCallback(() => {
    setEditingTaskId(null);
    setFormState(DEFAULT_FORM);
    setFormError(null);
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((task: Task) => {
    setEditingTaskId(task.id);
    setFormState({
      title: task.title,
      description: task.description,
      dueDate: task.due_date ?? "",
      priority: task.priority,
      category: task.category,
      color: task.color,
      recurrence: task.recurrence,
    });
    setFormError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (isSavingTask) {
      return;
    }

    setIsModalOpen(false);
    setFormError(null);
  }, [isSavingTask]);

  const handleFormChange = useCallback(
    <K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSaveTask = useCallback(async () => {
    const title = formState.title.trim();

    if (!title) {
      setFormError("Title is required.");
      return;
    }

    setFormError(null);
    setIsSavingTask(true);

    const payload = {
      title,
      description: formState.description.trim(),
      due_date: formState.dueDate || null,
      priority: formState.priority,
      category: formState.category.trim(),
      color: formState.color,
      recurrence: formState.recurrence,
    };

    if (editingTaskId) {
      const { error } = await supabase.from("tasks").update(payload).eq("id", editingTaskId);

      if (error) {
        console.error("Failed to update task", error);
        setFormError("Could not save changes. Try again.");
        setIsSavingTask(false);
        return;
      }

      setTasks((prev) =>
        prev.map((task) => {
          if (task.id !== editingTaskId) {
            return task;
          }

          return {
            ...task,
            ...payload,
          };
        }),
      );
    } else {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          ...payload,
          completed: false,
          completed_at: null,
          created_at: new Date().toISOString(),
        })
        .select(
          "id, title, description, due_date, priority, category, color, completed, recurrence, completed_at, created_at",
        )
        .single();

      if (error || !data) {
        console.error("Failed to create task", error);
        setFormError("Could not create task. Try again.");
        setIsSavingTask(false);
        return;
      }

      setTasks((prev) => [toTask(data as Partial<Task> & { id: string; created_at: string }), ...prev]);
    }

    setIsSavingTask(false);
    setIsModalOpen(false);
  }, [editingTaskId, formState]);

  const handleToggleCompleted = useCallback(async (task: Task, completed: boolean) => {
    const completedAt = completed ? new Date().toISOString() : null;

    setTasks((prev) =>
      prev.map((row) => {
        if (row.id !== task.id) {
          return row;
        }

        return {
          ...row,
          completed,
          completed_at: completedAt,
        };
      }),
    );

    const { error } = await supabase
      .from("tasks")
      .update({ completed, completed_at: completedAt })
      .eq("id", task.id);

    if (error) {
      console.error("Failed to toggle completion", error);
      setTasks((prev) =>
        prev.map((row) => {
          if (row.id !== task.id) {
            return row;
          }

          return task;
        }),
      );
    }
  }, []);

  const handleDeleteTask = useCallback(
    async (task: Task, mode: "single" | "future") => {
      if (mode === "single") {
        const { error } = await supabase.from("tasks").delete().eq("id", task.id);

        if (error) {
          console.error("Failed to delete task", error);
          return;
        }

        setTasks((prev) => prev.filter((row) => row.id !== task.id));
        setDeletePromptTaskId(null);
        return;
      }

      let query = supabase
        .from("tasks")
        .delete()
        .eq("recurrence", task.recurrence)
        .eq("title", task.title)
        .eq("category", task.category);

      if (task.due_date) {
        query = query.gte("due_date", task.due_date);
      } else {
        query = query.gte("created_at", task.created_at);
      }

      const { error } = await query;

      if (error) {
        console.error("Failed to delete recurring tasks", error);
        return;
      }

      setTasks((prev) =>
        prev.filter((row) => {
          const sameSeries =
            row.recurrence === task.recurrence &&
            row.title === task.title &&
            row.category === task.category;

          if (!sameSeries) {
            return true;
          }

          if (task.due_date) {
            if (!row.due_date) {
              return true;
            }

            return row.due_date < task.due_date;
          }

          return new Date(row.created_at).getTime() < new Date(task.created_at).getTime();
        }),
      );

      setDeletePromptTaskId(null);
    },
    [],
  );

  const renderTaskRow = (task: Task, muted = false) => {
    return (
      <li
        key={task.id}
        className={`group rounded-md border border-gray-200 bg-white px-4 py-3 ${
          muted ? "opacity-80" : ""
        }`}
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={task.completed}
            onChange={(event) => {
              void handleToggleCompleted(task, event.target.checked);
            }}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={`text-sm font-medium text-gray-900 ${
                  task.completed ? "line-through text-gray-500" : ""
                }`}
              >
                {task.title}
              </p>

              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${PRIORITY_BADGE[task.priority]}`}
              >
                {titleCase(task.priority)}
              </span>

              {task.due_date ? (
                <span
                  className={`text-xs ${
                    isOverdue(task) ? "text-red-600" : "text-gray-500"
                  }`}
                >
                  {formatDueDate(task.due_date)}
                </span>
              ) : null}

              {task.category.trim() ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                  <span className={`h-2 w-2 rounded-full ${COLOR_DOT[task.color]}`} />
                  {task.category}
                </span>
              ) : null}
            </div>

            {task.description ? <p className="mt-1 text-xs text-gray-500 line-clamp-2">{task.description}</p> : null}

            {deletePromptTaskId === task.id ? (
              <div className="mt-2 text-xs text-gray-600">
                {task.recurrence === "none" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Delete this task?</span>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteTask(task, "single");
                      }}
                      className="font-medium text-red-600 hover:text-red-700"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePromptTaskId(null)}
                      className="font-medium text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Delete recurring task?</span>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteTask(task, "single");
                      }}
                      className="font-medium text-red-600 hover:text-red-700"
                    >
                      Delete this task only
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteTask(task, "future");
                      }}
                      className="font-medium text-red-600 hover:text-red-700"
                    >
                      Delete all future tasks
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePromptTaskId(null)}
                      className="font-medium text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => openEditModal(task)}
              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Edit task"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => setDeletePromptTaskId(task.id)}
              className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600"
              aria-label="Delete task"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Tasks</h1>
            <p className="text-xs text-gray-500 mt-0.5">Track what needs to get done</p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus size={16} />
            Add Task
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 bg-white">
        {isLoading ? <p className="text-sm text-gray-500">Loading tasks...</p> : null}

        {!isLoading ? (
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">To Do</h2>
                <span className="text-xs text-gray-500">{todoTasks.length}</span>
              </div>

              {todoTasks.length === 0 ? (
                <p className="text-sm text-gray-500">No pending tasks.</p>
              ) : (
                <ul className="space-y-2">{todoTasks.map((task) => renderTaskRow(task))}</ul>
              )}
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
              <button
                type="button"
                onClick={() => setIsCompletedExpanded((prev) => !prev)}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-sm font-semibold text-gray-700">Completed</span>
                <span className="inline-flex items-center gap-2 text-xs text-gray-500">
                  {completedTasks.length}
                  {isCompletedExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              </button>

              {isCompletedExpanded ? (
                <div className="mt-3">
                  {completedTasks.length === 0 ? (
                    <p className="text-sm text-gray-500">No completed tasks yet.</p>
                  ) : (
                    <ul className="space-y-2">{completedTasks.map((task) => renderTaskRow(task, true))}</ul>
                  )}
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">
                {editingTaskId ? "Edit Task" : "Add Task"}
              </h3>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) => handleFormChange("title", event.target.value)}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  placeholder="Task title"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Description</label>
                <textarea
                  value={formState.description}
                  onChange={(event) => handleFormChange("description", event.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  placeholder="Optional details"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Due date</label>
                  <input
                    type="date"
                    value={formState.dueDate}
                    onChange={(event) => handleFormChange("dueDate", event.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Category</label>
                  <input
                    type="text"
                    value={formState.category}
                    onChange={(event) => handleFormChange("category", event.target.value)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    placeholder="Work, Personal..."
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Priority</label>
                <div className="flex flex-wrap gap-2">
                  {(["low", "medium", "high"] as TaskPriority[]).map((priority) => {
                    const selected = formState.priority === priority;
                    return (
                      <button
                        key={priority}
                        type="button"
                        onClick={() => handleFormChange("priority", priority)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? PRIORITY_BADGE[priority]
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {titleCase(priority)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Color tag</label>
                <div className="flex items-center gap-2">
                  {COLOR_SWATCHES.map((color) => {
                    const selected = formState.color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleFormChange("color", color)}
                        className={`h-5 w-5 rounded-full ${COLOR_DOT[color]} transition ring-offset-2 ${
                          selected ? "ring-2 ring-gray-500" : "ring-1 ring-transparent hover:ring-gray-300"
                        }`}
                        aria-label={`Set color ${color}`}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Recurrence</label>
                <div className="flex flex-wrap gap-2">
                  {RECURRENCE_OPTIONS.map((recurrence) => {
                    const selected = formState.recurrence === recurrence;
                    return (
                      <button
                        key={recurrence}
                        type="button"
                        onClick={() => handleFormChange("recurrence", recurrence)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? "border-gray-300 bg-gray-900 text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {titleCase(recurrence)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {formError ? <p className="text-xs text-red-600">{formError}</p> : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSaveTask();
                }}
                disabled={isSavingTask}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {isSavingTask ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}