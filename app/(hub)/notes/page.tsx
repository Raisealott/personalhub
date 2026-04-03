"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  Download,
  Eye,
  Highlighter,
  List,
  ListChecks,
  ListOrdered,
  Palette,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type NoteColor = "blue" | "green" | "amber" | "red" | "purple" | "teal";
type Attachment = {
  name: string;
  path: string;
  size: number;
  mime_type: string;
  uploaded_at: string;
};
type Note = {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  folder_id: string | null;
  pinned: boolean;
  deleted_at: string | null;
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
};
type FolderOption = { id: string; name: string };

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "personal-hub-files";
const DEFAULT_COLOR: NoteColor = "blue";
const FONT_SIZE = { small: "2", normal: "3", large: "5" } as const;
const EDITOR_COLORS = [
  { name: "black", value: "#000000", className: "bg-black" },
  { name: "red", value: "#dc2626", className: "bg-red-600" },
  { name: "blue", value: "#2563eb", className: "bg-blue-600" },
  { name: "green", value: "#16a34a", className: "bg-green-600" },
  { name: "yellow", value: "#eab308", className: "bg-yellow-500" },
] as const;
const COLOR_SWATCHES: Array<{ value: NoteColor; className: string }> = [
  { value: "blue", className: "bg-blue-500" },
  { value: "green", className: "bg-green-500" },
  { value: "amber", className: "bg-amber-500" },
  { value: "red", className: "bg-red-500" },
  { value: "purple", className: "bg-purple-500" },
  { value: "teal", className: "bg-teal-500" },
];

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function stripHtml(content: string) {
  const div = document.createElement("div");
  div.innerHTML = content;
  return (div.textContent ?? "").replace(/\u00a0/g, " ");
}

function getPreviewLine(content: string) {
  const [first] = stripHtml(content).split(/\r?\n/);
  return first?.trim() || "No content";
}

function formatRelativeTimestamp(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) {
    const m = Math.floor(diffMs / 60_000);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 86_400_000) {
    const h = Math.floor(diffMs / 3_600_000);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const a = x as Partial<Attachment>;
      if (!a.path || !a.name) return null;
      return {
        name: String(a.name),
        path: String(a.path),
        size: Number(a.size ?? 0),
        mime_type: String(a.mime_type ?? "application/octet-stream"),
        uploaded_at: String(a.uploaded_at ?? new Date().toISOString()),
      };
    })
    .filter((a): a is Attachment => a !== null);
}

function sortActiveNotes(notes: Note[]) {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });
}

function sortDeletedNotes(notes: Note[]) {
  return [...notes].sort((a, b) => {
    const aTime = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
    const bTime = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
    return bTime - aTime;
  });
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<"all" | string>("all");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [contentDraft, setContentDraft] = useState("<p></p>");
  const [colorDraft, setColorDraft] = useState<NoteColor>(DEFAULT_COLOR);
  const [folderDraft, setFolderDraft] = useState<string>("");
  const [pinnedDraft, setPinnedDraft] = useState(false);
  const [attachmentsDraft, setAttachmentsDraft] = useState<Attachment[]>([]);
  const [openColorMenu, setOpenColorMenu] = useState<null | "text" | "highlight">(null);
  const [selectedTextColor, setSelectedTextColor] = useState("#000000");
  const [selectedHighlightColor, setSelectedHighlightColor] = useState("#eab308");

  const editorRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const hydrateEditor = useCallback((note: Note | null) => {
    if (!note) {
      setTitleDraft("");
      setContentDraft("<p></p>");
      setColorDraft(DEFAULT_COLOR);
      setFolderDraft("");
      setPinnedDraft(false);
      setAttachmentsDraft([]);
      setIsDirty(false);
      setIsSaving(false);
      return;
    }

    setTitleDraft(note.title);
    setContentDraft(note.content || "<p></p>");
    setColorDraft(note.color);
    setFolderDraft(note.folder_id ?? "");
    setPinnedDraft(note.pinned);
    setAttachmentsDraft(note.attachments);
    setIsDirty(false);
    setIsSaving(false);
  }, []);

  const permanentlyDeleteNotes = useCallback(async (target: Note[]) => {
    if (target.length === 0) return;
    const ids = target.map((n) => n.id);
    const paths = target.flatMap((n) => n.attachments.map((a) => a.path));

    if (paths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    }

    const { error } = await supabase.from("notes").delete().in("id", ids);
    if (error) {
      console.error("Failed permanently deleting notes", error);
      return;
    }

    setNotes((prev) => prev.filter((n) => !ids.includes(n.id)));
    if (selectedNoteId && ids.includes(selectedNoteId)) {
      setSelectedNoteId(null);
      hydrateEditor(null);
    }
  }, [hydrateEditor, selectedNoteId]);

  useEffect(() => {
    let mounted = true;
    const loadNotes = async () => {
      setIsLoading(true);
      const [{ data, error }, { data: folderData, error: folderError }] = await Promise.all([
        supabase
          .from("notes")
          .select("id, title, content, color, folder_id, pinned, deleted_at, attachments, created_at, updated_at")
          .order("updated_at", { ascending: false }),
        supabase.from("folders").select("id, name").order("name", { ascending: true }),
      ]);

      if (!mounted) return;
      if (error) {
        console.error("Failed to load notes", error);
        setNotes([]);
        setIsLoading(false);
        return;
      }
      if (folderError) {
        console.error("Failed to load folders", folderError);
        setFolders([]);
      } else {
        setFolders((folderData ?? []).map((f) => ({ id: f.id, name: f.name })));
      }

      const loaded: Note[] = (data ?? []).map((row) => ({
        id: row.id,
        title: row.title ?? "",
        content: row.content ?? "<p></p>",
        color: (row.color ?? DEFAULT_COLOR) as NoteColor,
        folder_id: row.folder_id ?? null,
        pinned: Boolean(row.pinned ?? false),
        deleted_at: row.deleted_at ?? null,
        attachments: normalizeAttachments(row.attachments),
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const expired = loaded.filter((n) => n.deleted_at && new Date(n.deleted_at).getTime() <= cutoff);
      setNotes(loaded.filter((n) => !expired.some((x) => x.id === n.id)));
      setIsLoading(false);
      if (expired.length > 0) void permanentlyDeleteNotes(expired);
    };
    void loadNotes();
    return () => {
      mounted = false;
    };
  }, [permanentlyDeleteNotes]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== contentDraft) editor.innerHTML = contentDraft;
  }, [contentDraft, selectedNoteId]);

  const selectedNote = useMemo(() => notes.find((n) => n.id === selectedNoteId) ?? null, [notes, selectedNoteId]);
  const isSelectedDeleted = Boolean(selectedNote?.deleted_at);

  const persistNote = useCallback(async () => {
    if (!selectedNoteId || !selectedNote || selectedNote.deleted_at) {
      setIsSaving(false);
      return;
    }

    const updatedAt = new Date().toISOString();
    const payload = {
      title: titleDraft,
      content: contentDraft,
      color: colorDraft,
      folder_id: folderDraft || null,
      pinned: pinnedDraft,
      attachments: attachmentsDraft,
      updated_at: updatedAt,
    };

    const { error } = await supabase.from("notes").update(payload).eq("id", selectedNoteId);
    if (error) {
      console.error("Failed to save note", error);
      setIsSaving(false);
      return;
    }

    setNotes((prev) => prev.map((n) => (n.id === selectedNoteId ? { ...n, ...payload } : n)));
    setIsDirty(false);
    setIsSaving(false);
  }, [attachmentsDraft, colorDraft, contentDraft, folderDraft, pinnedDraft, selectedNote, selectedNoteId, titleDraft]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (selectedNoteId && isDirty && !isSelectedDeleted) await persistNote();
  }, [isDirty, isSelectedDeleted, persistNote, selectedNoteId]);

  useEffect(() => {
    if (!selectedNoteId || !isDirty || isSelectedDeleted) return;
    saveTimerRef.current = setTimeout(() => {
      void persistNote();
      saveTimerRef.current = null;
    }, 1000);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [attachmentsDraft, colorDraft, contentDraft, folderDraft, isDirty, isSelectedDeleted, persistNote, pinnedDraft, selectedNoteId, titleDraft]);

  const updateDraft = useCallback((updates: Partial<Pick<Note, "title" | "content" | "color" | "folder_id" | "pinned" | "attachments">>) => {
    if (!selectedNoteId || isSelectedDeleted) return;
    if (updates.title !== undefined) setTitleDraft(updates.title);
    if (updates.content !== undefined) setContentDraft(updates.content);
    if (updates.color !== undefined) setColorDraft(updates.color);
    if (updates.folder_id !== undefined) setFolderDraft(updates.folder_id ?? "");
    if (updates.pinned !== undefined) setPinnedDraft(updates.pinned);
    if (updates.attachments !== undefined) setAttachmentsDraft(updates.attachments);
    setNotes((prev) => prev.map((n) => (n.id === selectedNoteId ? { ...n, ...updates } : n)));
    setIsSaving(true);
    setIsDirty(true);
  }, [isSelectedDeleted, selectedNoteId]);

  const handleEditorInput = useCallback(() => {
    const content = editorRef.current?.innerHTML ?? "";
    updateDraft({ content });
  }, [updateDraft]);

  const handleSelectNote = useCallback(async (note: Note) => {
    await flushPendingSave();
    setSelectedNoteId(note.id);
    hydrateEditor(note);
  }, [flushPendingSave, hydrateEditor]);

  const handleCreateNote = useCallback(async () => {
    if (isCreating) return;
    setIsCreating(true);
    await flushPendingSave();

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        title: "",
        content: "<p></p>",
        color: DEFAULT_COLOR,
        folder_id: selectedFolderFilter !== "all" ? selectedFolderFilter : null,
        pinned: false,
        deleted_at: null,
        attachments: [],
        created_at: now,
        updated_at: now,
      })
      .select("id, title, content, color, folder_id, pinned, deleted_at, attachments, created_at, updated_at")
      .single();

    if (error || !data) {
      console.error("Failed to create note", error);
      setIsCreating(false);
      return;
    }

    const created: Note = {
      id: data.id,
      title: data.title ?? "",
      content: data.content ?? "<p></p>",
      color: (data.color ?? DEFAULT_COLOR) as NoteColor,
      folder_id: data.folder_id ?? null,
      pinned: Boolean(data.pinned ?? false),
      deleted_at: data.deleted_at ?? null,
      attachments: normalizeAttachments(data.attachments),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
    setNotes((prev) => [created, ...prev]);
    setSelectedNoteId(created.id);
    hydrateEditor(created);
    setIsCreating(false);
  }, [flushPendingSave, hydrateEditor, isCreating, selectedFolderFilter]);

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || isCreatingFolder) return;
    setIsCreatingFolder(true);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("folders")
      .insert({
        name,
        parent_id: null,
        visibility: "private",
        shared_with: [],
        modified_at: now,
      })
      .select("id, name")
      .single();

    if (error || !data) {
      console.error("Failed to create folder from notes", error);
      setIsCreatingFolder(false);
      return;
    }

    setFolders((prev) => [...prev, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedFolderFilter(data.id);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
    setIsCreatingFolder(false);
  }, [isCreatingFolder, newFolderName]);

  const handleSoftDelete = useCallback(async () => {
    if (!selectedNoteId || isSelectedDeleted) return;
    if (!window.confirm("Move this note to Recently Deleted?")) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const deletedAt = new Date().toISOString();
    const { error } = await supabase.from("notes").update({ deleted_at: deletedAt, updated_at: deletedAt }).eq("id", selectedNoteId);
    if (error) {
      console.error("Failed to delete note", error);
      return;
    }

    setNotes((prev) => prev.map((n) => (n.id === selectedNoteId ? { ...n, deleted_at: deletedAt, updated_at: deletedAt } : n)));
    setShowDeleted(true);
    setIsDirty(false);
    setIsSaving(false);
  }, [isSelectedDeleted, selectedNoteId]);

  const handleRestore = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("notes").update({ deleted_at: null, updated_at: now }).eq("id", id);
    if (error) {
      console.error("Failed to restore note", error);
      return;
    }

    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, deleted_at: null, updated_at: now } : n)));
    if (selectedNoteId === id) {
      const restored = notes.find((n) => n.id === id);
      if (restored) hydrateEditor({ ...restored, deleted_at: null, updated_at: now });
    }
  }, [hydrateEditor, notes, selectedNoteId]);

  const handlePermanentDeleteSingle = useCallback(async (id: string) => {
    const target = notes.find((n) => n.id === id);
    if (!target) return;
    if (!window.confirm("Permanently delete this note?")) return;
    await permanentlyDeleteNotes([target]);
  }, [notes, permanentlyDeleteNotes]);

  const handleImportAttachments = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);

  const handleAttachmentFiles = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!selectedNoteId || !files || files.length === 0 || isSelectedDeleted) return;

    const uploaded: Attachment[] = [];
    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `notes/${selectedNoteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) {
        console.error("Failed uploading attachment", error);
        continue;
      }
      uploaded.push({
        name: file.name,
        path,
        size: file.size,
        mime_type: file.type || "application/octet-stream",
        uploaded_at: new Date().toISOString(),
      });
    }

    if (uploaded.length > 0) updateDraft({ attachments: [...attachmentsDraft, ...uploaded] });
    event.target.value = "";
  }, [attachmentsDraft, isSelectedDeleted, selectedNoteId, updateDraft]);

  const openAttachment = useCallback(async (attachment: Attachment, download = false) => {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(attachment.path, 60 * 5, download ? { download: attachment.name } : undefined);
    if (error || !data?.signedUrl) {
      console.error("Failed opening attachment", error);
      return;
    }
    if (download) {
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, []);

  const removeAttachment = useCallback(async (path: string) => {
    if (isSelectedDeleted) return;
    updateDraft({ attachments: attachmentsDraft.filter((a) => a.path !== path) });
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  }, [attachmentsDraft, isSelectedDeleted, updateDraft]);

  const insertChecklist = useCallback(() => {
    exec(
      "insertHTML",
      '<ul data-checklist=\"true\" style=\"list-style:none;padding-left:0.2rem;\"><li style=\"margin:0.2rem 0;\"><label style=\"display:inline-flex;align-items:center;gap:0.4rem;\"><input type=\"checkbox\" /> <span>Checklist item</span></label></li></ul><p style=\"margin:0.35rem 0;\"></p>',
    );
    handleEditorInput();
  }, [handleEditorInput]);

  const onChecklistClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    const checkbox = target as HTMLInputElement;
    const span = checkbox.parentElement?.querySelector("span");
    if (!span) return;
    span.style.textDecoration = checkbox.checked ? "line-through" : "none";
    handleEditorInput();
  }, [handleEditorInput]);

  const activeNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortActiveNotes(
      notes.filter((n) => {
        const inFolder = selectedFolderFilter === "all" || n.folder_id === selectedFolderFilter;
        return (
          !n.deleted_at &&
          inFolder &&
          (!q || n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q))
        );
      }),
    );
  }, [notes, searchQuery, selectedFolderFilter]);

  const deletedNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortDeletedNotes(
      notes.filter((n) => {
        const inFolder = selectedFolderFilter === "all" || n.folder_id === selectedFolderFilter;
        return (
          n.deleted_at &&
          inFolder &&
          (!q || n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q))
        );
      }),
    );
  }, [notes, searchQuery, selectedFolderFilter]);

  const folderNameById = useMemo(() => {
    return new Map(folders.map((f) => [f.id, f.name]));
  }, [folders]);

  const toolBtn = "rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-50";

  return (
    <div className="h-full flex flex-col">
      <div className="px-8 py-5 border-b border-gray-200 bg-white">
        <h1 className="text-base font-semibold text-gray-900">Notes</h1>
        <p className="text-xs text-gray-500 mt-0.5">Write and manage your notes</p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[300px_minmax(0,1fr)] bg-white">
        <aside className="min-h-0 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col">
          <div className="p-4 space-y-3 border-b border-gray-100">
            <button type="button" onClick={handleCreateNote} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 text-white text-sm font-medium px-3 py-2 hover:bg-gray-800 disabled:opacity-50" disabled={isCreating}>
              <Plus size={16} />
              New Note
            </button>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search notes" className="w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedFolderFilter}
                onChange={(e) => setSelectedFolderFilter(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="all">All Notes</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen(true)}
                className="shrink-0 inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Plus size={12} />
                Folder
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-gray-500">Loading notes...</p>
            ) : (
              <>
                <div className="px-3 pt-2 pb-1"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">All Notes</p></div>
                {activeNotes.length === 0 ? (
                  <p className="px-4 py-2 text-sm text-gray-500">No notes found</p>
                ) : (
                  <ul className="px-2 space-y-1 pb-2">
                    {activeNotes.map((note) => {
                      const isActive = note.id === selectedNoteId;
                      const swatch = COLOR_SWATCHES.find((c) => c.value === note.color) ?? COLOR_SWATCHES[0];
                      return (
                        <li key={note.id}>
                          <button type="button" onClick={() => { void handleSelectNote(note); }} className={`w-full text-left px-3 py-2 rounded-md border ${isActive ? "bg-gray-100 border-gray-200" : "bg-white border-transparent hover:bg-gray-50"}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${swatch.className}`} />
                                <p className="text-sm font-semibold text-gray-900 truncate">{note.title.trim() || "Untitled note"}</p>
                                {note.pinned ? <Pin size={12} className="text-amber-600 shrink-0" /> : null}
                              </div>
                              <p className="text-[11px] text-gray-400 shrink-0">{formatRelativeTimestamp(note.updated_at)}</p>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 truncate">{getPreviewLine(note.content)}</p>
                            {note.folder_id ? (
                              <p className="mt-1 text-[11px] text-gray-400 truncate">
                                {folderNameById.get(note.folder_id) ?? "Folder"}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-1 border-t border-gray-100">
                  <button type="button" onClick={() => setShowDeleted((p) => !p)} className="w-full px-4 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50">
                    Recently Deleted ({deletedNotes.length})
                  </button>
                  {showDeleted ? (
                    deletedNotes.length === 0 ? (
                      <p className="px-4 pb-3 text-xs text-gray-500">No deleted notes</p>
                    ) : (
                      <ul className="px-2 pb-2 space-y-1">
                        {deletedNotes.map((note) => (
                          <li key={note.id}>
                            <div className={`rounded-md border px-3 py-2 ${note.id === selectedNoteId ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-100"}`}>
                              <button type="button" onClick={() => { void handleSelectNote(note); }} className="w-full text-left">
                                <p className="text-sm font-medium text-gray-700 truncate">{note.title.trim() || "Untitled note"}</p>
                                <p className="mt-1 text-[11px] text-gray-500">Deleted {note.deleted_at ? new Date(note.deleted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</p>
                              </button>
                              <div className="mt-2 flex items-center gap-3">
                                <button type="button" onClick={() => { void handleRestore(note.id); }} className="text-[11px] font-medium text-blue-600 hover:text-blue-700">Restore</button>
                                <button type="button" onClick={() => { void handlePermanentDeleteSingle(note.id); }} className="text-[11px] font-medium text-red-600 hover:text-red-700">Delete forever</button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </div>
              </>
            )}
          </div>
        </aside>

        <section className="min-h-0 flex flex-col">
          {!selectedNoteId ? (
            <div className="h-full flex items-center justify-center px-6"><p className="text-sm text-gray-500">Select a note or create a new one</p></div>
          ) : (
            <div className="h-full flex flex-col px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <input type="text" value={titleDraft} onChange={(e) => updateDraft({ title: e.target.value })} placeholder="Untitled note" disabled={isSelectedDeleted} className="w-full text-2xl font-semibold text-gray-900 placeholder:text-gray-300 bg-transparent border-none focus:outline-none disabled:text-gray-500" />
                  <div className="mt-3 flex items-center gap-2">
                    {COLOR_SWATCHES.map((color) => {
                      const isSelected = colorDraft === color.value;
                      return (
                        <button key={color.value} type="button" onClick={() => updateDraft({ color: color.value })} disabled={isSelectedDeleted} className={`h-5 w-5 rounded-full ${color.className} transition ring-offset-2 disabled:opacity-50 ${isSelected ? "ring-2 ring-gray-500" : "ring-1 ring-transparent hover:ring-gray-300"}`} aria-label={`Set note color to ${color.value}`} />
                      );
                    })}
                  </div>
                  {!isSelectedDeleted ? (
                    <div className="mt-3">
                      <select
                        value={folderDraft}
                        onChange={(e) => updateDraft({ folder_id: e.target.value || null })}
                        className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
                      >
                        <option value="">No folder</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <p className="text-xs text-gray-500">{isSaving ? "Saving..." : "Saved"}</p>
                  {!isSelectedDeleted ? (
                    <>
                      <button type="button" onClick={() => updateDraft({ pinned: !pinnedDraft })} className="p-1.5 rounded-md text-gray-500 hover:text-amber-600 hover:bg-amber-50">{pinnedDraft ? <PinOff size={16} /> : <Pin size={16} />}</button>
                      <button type="button" onClick={handleSoftDelete} className="p-1.5 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50"><Trash2 size={16} /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => { if (selectedNoteId) void handleRestore(selectedNoteId); }} className="text-xs font-medium text-blue-600 hover:text-blue-700">Restore</button>
                      <button type="button" onClick={() => { if (selectedNoteId) void handlePermanentDeleteSingle(selectedNoteId); }} className="text-xs font-medium text-red-600 hover:text-red-700">Delete forever</button>
                    </>
                  )}
                </div>
              </div>

              {!isSelectedDeleted ? (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border border-gray-200 rounded-md p-2">
                    <button type="button" className={toolBtn} onClick={() => exec("bold")}><Bold size={14} /></button>
                    <button type="button" className={toolBtn} onClick={() => exec("underline")}><Underline size={14} /></button>
                    <button type="button" className={toolBtn} onClick={() => exec("strikeThrough")}><X size={14} /></button>
                    <select className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700" onChange={(e) => exec("fontSize", FONT_SIZE[e.target.value as keyof typeof FONT_SIZE])} defaultValue="normal">
                      <option value="small">Small</option>
                      <option value="normal">Normal</option>
                      <option value="large">Large</option>
                    </select>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenColorMenu((prev) => (prev === "text" ? null : "text"))}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-gray-700 ${openColorMenu === "text" ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                      >
                        <Palette size={12} />
                        <span>Text</span>
                        <span className="h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: selectedTextColor }} />
                      </button>
                      {openColorMenu === "text" ? (
                        <div className="absolute z-20 mt-1 w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                          {EDITOR_COLORS.map((color) => (
                            <button
                              key={`text-option-${color.name}`}
                              type="button"
                              onClick={() => {
                                exec("foreColor", color.value);
                                setSelectedTextColor(color.value);
                                setOpenColorMenu(null);
                              }}
                              className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 ${selectedTextColor === color.value ? "bg-gray-100" : ""}`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className={`h-3 w-3 rounded-full ${color.className}`} />
                                {color.name}
                              </span>
                              {selectedTextColor === color.value ? <Check size={12} className="text-blue-600" /> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenColorMenu((prev) => (prev === "highlight" ? null : "highlight"))}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-gray-700 ${openColorMenu === "highlight" ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}
                      >
                        <Highlighter size={12} />
                        <span>Highlight</span>
                        <span className="h-3 w-3 rounded-full border border-gray-200" style={{ backgroundColor: selectedHighlightColor }} />
                      </button>
                      {openColorMenu === "highlight" ? (
                        <div className="absolute z-20 mt-1 w-36 rounded-md border border-gray-200 bg-white p-1 shadow-lg">
                          {EDITOR_COLORS.map((color) => (
                            <button
                              key={`highlight-option-${color.name}`}
                              type="button"
                              onClick={() => {
                                exec("hiliteColor", color.value);
                                setSelectedHighlightColor(color.value);
                                setOpenColorMenu(null);
                              }}
                              className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 ${selectedHighlightColor === color.value ? "bg-gray-100" : ""}`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className={`h-3 w-3 rounded-full ${color.className}`} />
                                {color.name}
                              </span>
                              {selectedHighlightColor === color.value ? <Check size={12} className="text-blue-600" /> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <button type="button" className={toolBtn} onClick={() => exec("insertUnorderedList")}><List size={14} /></button>
                    <button type="button" className={toolBtn} onClick={() => exec("insertOrderedList")}><ListOrdered size={14} /></button>
                    <button type="button" className={toolBtn} onClick={insertChecklist}><ListChecks size={14} /></button>
                    <button type="button" className={toolBtn} onClick={() => exec("justifyLeft")}><AlignLeft size={14} /></button>
                    <button type="button" className={toolBtn} onClick={() => exec("justifyCenter")}><AlignCenter size={14} /></button>
                    <button type="button" className={toolBtn} onClick={() => exec("justifyRight")}><AlignRight size={14} /></button>
                  </div>

                  <div className="mt-3">
                    <button type="button" onClick={handleImportAttachments} className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      <Paperclip size={14} />
                      Import Attachments
                    </button>
                    <input ref={attachmentInputRef} type="file" multiple className="hidden" onChange={handleAttachmentFiles} />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-xs text-gray-500">This note is in Recently Deleted and is read-only.</p>
              )}

              {attachmentsDraft.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachmentsDraft.map((a) => (
                    <div key={a.path} className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 bg-gray-50">
                      <span className="max-w-[180px] truncate">{a.name}</span>
                      <span className="text-gray-400">{formatSize(a.size)}</span>
                      <button type="button" onClick={() => { void openAttachment(a, false); }} className="p-0.5 text-gray-500 hover:text-gray-700"><Eye size={12} /></button>
                      <button type="button" onClick={() => { void openAttachment(a, true); }} className="p-0.5 text-gray-500 hover:text-gray-700"><Download size={12} /></button>
                      {!isSelectedDeleted ? <button type="button" onClick={() => { void removeAttachment(a.path); }} className="p-0.5 text-gray-500 hover:text-red-600"><Trash2 size={12} /></button> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex-1 overflow-y-auto border border-gray-200 rounded-md p-3">
                <div
                  ref={editorRef}
                  contentEditable={!isSelectedDeleted}
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onClick={onChecklistClick}
                  className="min-h-[260px] text-sm leading-6 text-gray-800 focus:outline-none"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {isCreateFolderOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900">New Folder</h3>
            </div>
            <div className="px-5 py-4">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                autoFocus
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  if (isCreatingFolder) return;
                  setIsCreateFolderOpen(false);
                  setNewFolderName("");
                }}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCreateFolder();
                }}
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {isCreatingFolder ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
