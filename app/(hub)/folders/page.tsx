"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  Eye,
  File,
  Folder,
  FolderOpen,
  Grid3X3,
  List,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ItemType = "folder" | "file";
type SortBy = "name" | "modified" | "size";
type ViewMode = "grid" | "list";
type Visibility = "private" | "shared" | "public";

type FolderRow = {
  id: string;
  name: string;
  parent_id: string | null;
  modified_at: string;
  visibility: Visibility;
  shared_with: string[];
};

type FileRow = {
  id: string;
  name: string;
  folder_id: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  storage_path: string | null;
  modified_at: string;
  visibility: Visibility;
  shared_with: string[];
};

type DriveItem = {
  id: string;
  name: string;
  type: ItemType;
  parentId: string | null;
  modifiedAt: string;
  sizeBytes: number | null;
  visibility: Visibility;
  sharedWith: string[];
  storagePath: string | null;
  mimeType: string | null;
};

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "personal-hub-files";

function formatModifiedDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSize(bytes: number | null) {
  if (bytes === null) {
    return "--";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function visibilityClass(visibility: Visibility) {
  if (visibility === "public") {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (visibility === "shared") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-gray-50 text-gray-600 border-gray-200";
}

function keyFor(item: { type: ItemType; id: string }) {
  return `${item.type}:${item.id}`;
}

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isPreviewableMime(mimeType: string | null) {
  if (!mimeType) {
    return false;
  }

  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("json")
  );
}

export default function FoldersPage() {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);

      const [{ data: folderData, error: folderError }, { data: fileData, error: fileError }] = await Promise.all([
        supabase
          .from("folders")
          .select("id, name, parent_id, modified_at, visibility, shared_with"),
        supabase
          .from("files")
          .select("id, name, folder_id, size_bytes, mime_type, storage_path, modified_at, visibility, shared_with"),
      ]);

      if (!isMounted) {
        return;
      }

      if (folderError) {
        console.error("Failed loading folders", {
          message: folderError.message,
          details: folderError.details,
          hint: folderError.hint,
          code: folderError.code,
        });
        setFolders([]);
      } else {
        setFolders((folderData ?? []).map((row) => ({
          ...row,
          visibility: (row.visibility ?? "private") as Visibility,
          shared_with: (row.shared_with ?? []) as string[],
        })));
      }

      if (fileError) {
        console.error("Failed loading files", {
          message: fileError.message,
          details: fileError.details,
          hint: fileError.hint,
          code: fileError.code,
        });
        setFiles([]);
      } else {
        setFiles((fileData ?? []).map((row) => ({
          ...row,
          visibility: (row.visibility ?? "private") as Visibility,
          shared_with: (row.shared_with ?? []) as string[],
        })));
      }

      setIsLoading(false);
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const fileMap = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);

  const driveItems = useMemo<DriveItem[]>(() => {
    const folderItems: DriveItem[] = folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      type: "folder",
      parentId: folder.parent_id,
      modifiedAt: folder.modified_at,
      sizeBytes: null,
      visibility: folder.visibility,
      sharedWith: folder.shared_with,
      storagePath: null,
      mimeType: null,
    }));

    const fileItems: DriveItem[] = files.map((file) => ({
      id: file.id,
      name: file.name,
      type: "file",
      parentId: file.folder_id,
      modifiedAt: file.modified_at,
      sizeBytes: file.size_bytes,
      visibility: file.visibility,
      sharedWith: file.shared_with,
      storagePath: file.storage_path,
      mimeType: file.mime_type,
    }));

    return [...folderItems, ...fileItems];
  }, [files, folders]);

  const folderChildren = useMemo(() => {
    return driveItems.filter((item) => item.parentId === currentFolderId);
  }, [driveItems, currentFolderId]);

  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? folderChildren.filter((item) => item.name.toLowerCase().includes(query))
      : folderChildren;

    return [...filtered].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }

      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }

      if (sortBy === "modified") {
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      }

      return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
    });
  }, [folderChildren, searchQuery, sortBy]);

  const breadcrumbs = useMemo(() => {
    if (!currentFolderId) {
      return [] as FolderRow[];
    }

    const trail: FolderRow[] = [];
    let cursor = folderMap.get(currentFolderId);

    while (cursor) {
      trail.unshift(cursor);
      cursor = cursor.parent_id ? folderMap.get(cursor.parent_id) : undefined;
    }

    return trail;
  }, [currentFolderId, folderMap]);

  const currentFolderPath = useMemo(() => {
    if (breadcrumbs.length === 0) {
      return "root";
    }

    const segments = breadcrumbs.map((crumb) => slugifySegment(crumb.name) || "folder");
    return ["root", ...segments].join("/");
  }, [breadcrumbs]);

  const openItem = useCallback((item: DriveItem | FolderRow) => {
    if (!("type" in item)) {
      setCurrentFolderId(item.id);
      setSelectedKeys([]);
      return;
    }

    if (item.type !== "folder") {
      return;
    }

    setCurrentFolderId(item.id);
    setSelectedKeys([]);
  }, []);

  const toggleSelected = useCallback((item: DriveItem) => {
    const key = keyFor(item);

    setSelectedKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((value) => value !== key);
      }

      return [...prev, key];
    });
  }, []);

  const openFileViaSignedUrl = useCallback(
    async (file: FileRow, mode: "preview" | "download") => {
      if (!file.storage_path) {
        return;
      }

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(file.storage_path, 60 * 5, mode === "download" ? { download: file.name } : undefined);

      if (error || !data?.signedUrl) {
        console.error(`Failed to ${mode} file`, {
          message: error?.message,
        });
        return;
      }

      if (mode === "preview") {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const anchor = document.createElement("a");
      anchor.href = data.signedUrl;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    },
    [],
  );

  const createFolder = useCallback(async () => {
    const folderName = newFolderName.trim();

    if (!folderName) {
      return;
    }

    setIsCreatingFolder(true);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("folders")
      .insert({
        name: folderName,
        parent_id: currentFolderId,
        modified_at: now,
        visibility: "private",
        shared_with: [],
      })
      .select("id, name, parent_id, modified_at, visibility, shared_with")
      .single();

    if (error || !data) {
      console.error("Failed creating folder", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      setIsCreatingFolder(false);
      return;
    }

    setFolders((prev) => [
      {
        ...data,
        visibility: (data.visibility ?? "private") as Visibility,
        shared_with: (data.shared_with ?? []) as string[],
      },
      ...prev,
    ]);
    setIsCreatingFolder(false);
    setNewFolderName("");
    setIsCreateFolderOpen(false);
  }, [currentFolderId, newFolderName]);

  const handleUploadClick = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleFileUpload: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (event) => {
      const uploadFiles = event.target.files;

      if (!uploadFiles || uploadFiles.length === 0) {
        return;
      }

      const now = new Date().toISOString();
      const uploadedMetadata: Array<Omit<FileRow, "id"> & { id: string }> = [];
      const uploadedStoragePaths: string[] = [];

      for (const file of Array.from(uploadFiles)) {
        const fileName = file.name || "file";
        const safeName = slugifySegment(fileName) || `file-${Date.now()}`;
        const storagePath = `${currentFolderPath}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

        const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

        if (uploadError) {
          console.error("Failed uploading to storage", {
            message: uploadError.message,
            fileName,
          });
          continue;
        }

        uploadedStoragePaths.push(storagePath);
        uploadedMetadata.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: fileName,
          folder_id: currentFolderId,
          size_bytes: file.size,
          mime_type: file.type || null,
          storage_path: storagePath,
          modified_at: now,
          visibility: "private",
          shared_with: [],
        });
      }

      if (uploadedMetadata.length === 0) {
        event.target.value = "";
        return;
      }

      const payload = uploadedMetadata.map((item) => ({
        name: item.name,
        folder_id: item.folder_id,
        size_bytes: item.size_bytes,
        mime_type: item.mime_type,
        storage_path: item.storage_path,
        modified_at: item.modified_at,
        visibility: item.visibility,
        shared_with: item.shared_with,
      }));

      const { data, error } = await supabase
        .from("files")
        .insert(payload)
        .select("id, name, folder_id, size_bytes, mime_type, storage_path, modified_at, visibility, shared_with");

      if (error) {
        console.error("Failed saving file metadata", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });

        if (uploadedStoragePaths.length > 0) {
          await supabase.storage.from(STORAGE_BUCKET).remove(uploadedStoragePaths);
        }

        event.target.value = "";
        return;
      }

      setFiles((prev) => [
        ...((data ?? []).map((row) => ({
          ...row,
          visibility: (row.visibility ?? "private") as Visibility,
          shared_with: (row.shared_with ?? []) as string[],
        })) as FileRow[]),
        ...prev,
      ]);

      event.target.value = "";
    },
    [currentFolderId, currentFolderPath],
  );

  const deleteSelected = useCallback(async () => {
    if (selectedKeys.length === 0) {
      return;
    }

    const selectedFolders = selectedKeys
      .filter((key) => key.startsWith("folder:"))
      .map((key) => key.replace("folder:", ""));
    const selectedFiles = selectedKeys
      .filter((key) => key.startsWith("file:"))
      .map((key) => key.replace("file:", ""));

    const allFolderIds = new Set(selectedFolders);
    let changed = true;

    while (changed) {
      changed = false;

      for (const folder of folders) {
        if (folder.parent_id && allFolderIds.has(folder.parent_id) && !allFolderIds.has(folder.id)) {
          allFolderIds.add(folder.id);
          changed = true;
        }
      }
    }

    const folderIds = Array.from(allFolderIds);
    let allFileIds = [...selectedFiles];

    if (folderIds.length > 0) {
      const descendantFileIds = files
        .filter((file) => file.folder_id && allFolderIds.has(file.folder_id))
        .map((file) => file.id);
      allFileIds = Array.from(new Set([...selectedFiles, ...descendantFileIds]));
    }

    const storagePaths = files
      .filter((file) => allFileIds.includes(file.id) && file.storage_path)
      .map((file) => file.storage_path as string);

    if (storagePaths.length > 0) {
      const { error: storageDeleteError } = await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);

      if (storageDeleteError) {
        console.error("Failed deleting storage objects", {
          message: storageDeleteError.message,
        });
        return;
      }
    }

    if (allFileIds.length > 0) {
      const { error: fileDeleteError } = await supabase.from("files").delete().in("id", allFileIds);

      if (fileDeleteError) {
        console.error("Failed deleting files", {
          message: fileDeleteError.message,
          details: fileDeleteError.details,
          hint: fileDeleteError.hint,
          code: fileDeleteError.code,
        });
        return;
      }
    }

    if (folderIds.length > 0) {
      const { error: folderDeleteError } = await supabase.from("folders").delete().in("id", folderIds);

      if (folderDeleteError) {
        console.error("Failed deleting folders", {
          message: folderDeleteError.message,
          details: folderDeleteError.details,
          hint: folderDeleteError.hint,
          code: folderDeleteError.code,
        });
        return;
      }
    }

    const folderSet = new Set(folderIds);
    const fileSet = new Set(allFileIds);

    setFolders((prev) => prev.filter((folder) => !folderSet.has(folder.id)));
    setFiles((prev) => {
      return prev.filter((file) => {
        if (fileSet.has(file.id)) {
          return false;
        }

        if (file.folder_id && folderSet.has(file.folder_id)) {
          return false;
        }

        return true;
      });
    });
    setSelectedKeys([]);

    if (currentFolderId && folderSet.has(currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, files, folders, selectedKeys]);

  const renderFileActions = (item: DriveItem) => {
    if (item.type !== "file") {
      return null;
    }

    const file = fileMap.get(item.id);

    if (!file || !file.storage_path) {
      return null;
    }

    const canPreview = isPreviewableMime(file.mime_type);

    return (
      <div className="flex items-center gap-1">
        {canPreview ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void openFileViaSignedUrl(file, "preview");
            }}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Preview file"
          >
            <Eye size={14} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            void openFileViaSignedUrl(file, "download");
          }}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Download file"
        >
          <Download size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-8 py-5 border-b border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Folders</h1>
            <p className="text-xs text-gray-500 mt-0.5">Drive-style file organization</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCreateFolderOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-gray-800"
            >
              <Plus size={16} />
              New Folder
            </button>
            <button
              type="button"
              onClick={handleUploadClick}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white text-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              <Upload size={16} />
              Upload
            </button>
            <input ref={uploadInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b md:border-b-0 md:border-r border-gray-200 min-h-0 overflow-y-auto">
          <div className="p-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 px-2 mb-2">Folders</p>
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentFolderId(null);
                    setSelectedKeys([]);
                  }}
                  className={`w-full rounded-md px-2.5 py-2 text-left text-sm flex items-center gap-2 ${
                    currentFolderId === null ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {currentFolderId === null ? <FolderOpen size={15} /> : <Folder size={15} />}
                  <span className="truncate">My Drive</span>
                </button>
              </li>
              {folders.map((folder) => {
                const isActive = folder.id === currentFolderId;
                return (
                  <li key={folder.id}>
                    <button
                      type="button"
                      onClick={() => openItem(folder)}
                      className={`w-full rounded-md px-2.5 py-2 text-left text-sm flex items-center gap-2 ${
                        isActive ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {isActive ? <FolderOpen size={15} /> : <Folder size={15} />}
                      <span className="truncate">{folder.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentFolderId(null);
                    setSelectedKeys([]);
                  }}
                  className="hover:text-gray-900"
                >
                  My Drive
                </button>
                {breadcrumbs.map((crumb) => (
                  <div key={crumb.id} className="inline-flex items-center gap-1">
                    <ChevronRight size={14} className="text-gray-400" />
                    <button
                      type="button"
                      onClick={() => openItem(crumb)}
                      className="hover:text-gray-900"
                    >
                      {crumb.name}
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-xs text-gray-500">{visibleItems.length} items</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search in this folder"
                  className="w-full rounded-md border border-gray-200 pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortBy)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="name">Sort: Name</option>
                <option value="modified">Sort: Modified</option>
                <option value="size">Sort: Size</option>
              </select>

              <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-2.5 py-2 ${viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}
                  aria-label="Grid view"
                >
                  <Grid3X3 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`px-2.5 py-2 border-l border-gray-200 ${viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-600 hover:bg-gray-50"}`}
                  aria-label="List view"
                >
                  <List size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  void deleteSelected();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={selectedKeys.length === 0}
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>

          <div className="px-6 py-4">
            {isLoading ? (
              <p className="text-sm text-gray-500">Loading folders...</p>
            ) : visibleItems.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center text-sm text-gray-500">
                No files or folders here
              </div>
            ) : viewMode === "grid" ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {visibleItems.map((item) => {
                  const isSelected = selectedKeys.includes(keyFor(item));
                  return (
                    <li key={keyFor(item)}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleSelected(item)}
                        onDoubleClick={() => openItem(item)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            openItem(item);
                          }
                        }}
                        className={`w-full rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "border-gray-400 bg-gray-50"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {item.type === "folder" ? (
                              <Folder size={16} className="text-amber-500 shrink-0" />
                            ) : (
                              <File size={16} className="text-gray-400 shrink-0" />
                            )}
                            <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                          </div>
                          {renderFileActions(item)}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${visibilityClass(item.visibility)}`}>
                            {item.visibility}
                          </span>
                          {item.sharedWith.length > 0 ? (
                            <span className="text-[11px] text-gray-500">{item.sharedWith.length} shared</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">Modified {formatModifiedDate(item.modifiedAt)}</p>
                        <p className="text-xs text-gray-400">{formatSize(item.sizeBytes)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Name</th>
                      <th className="text-left font-medium px-3 py-2">Visibility</th>
                      <th className="text-left font-medium px-3 py-2">Modified</th>
                      <th className="text-left font-medium px-3 py-2">Size</th>
                      <th className="text-left font-medium px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleItems.map((item) => {
                      const isSelected = selectedKeys.includes(keyFor(item));
                      return (
                        <tr
                          key={keyFor(item)}
                          className={`border-t border-gray-100 cursor-pointer ${
                            isSelected ? "bg-gray-50" : "hover:bg-gray-50"
                          }`}
                          onClick={() => toggleSelected(item)}
                          onDoubleClick={() => openItem(item)}
                        >
                          <td className="px-3 py-2">
                            <div className="inline-flex items-center gap-2 min-w-0">
                              {item.type === "folder" ? (
                                <Folder size={15} className="text-amber-500 shrink-0" />
                              ) : (
                                <File size={15} className="text-gray-400 shrink-0" />
                              )}
                              <span className="truncate text-gray-900">{item.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${visibilityClass(item.visibility)}`}>
                              {item.visibility}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-500">{formatModifiedDate(item.modifiedAt)}</td>
                          <td className="px-3 py-2 text-gray-500">{formatSize(item.sizeBytes)}</td>
                          <td className="px-3 py-2">{renderFileActions(item)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                onChange={(event) => setNewFolderName(event.target.value)}
                placeholder="Folder name"
                autoFocus
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  if (isCreatingFolder) {
                    return;
                  }
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
                  void createFolder();
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
