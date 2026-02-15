"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type TouchEvent } from "react";
import { Check, EllipsisVertical, Filter, Plus, RotateCw } from "lucide-react";
import { createTaskDraft, deleteTaskById, getAllTasks, TaskItem, upsertTask } from "@/lib/tasks-db";

type FilterType = "all" | "incomplete" | "completed";
const FILTER_STORAGE_KEY = "tsubushigoto-filter-type";

function isFilterType(value: string): value is FilterType {
  return value === "all" || value === "incomplete" || value === "completed";
}

function getInitialFilterType(): FilterType {
  if (typeof window === "undefined") {
    return "incomplete";
  }

  const saved = window.localStorage.getItem(FILTER_STORAGE_KEY);
  if (saved && isFilterType(saved)) {
    return saved;
  }
  return "incomplete";
}

function getTodayJstDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDateForDisplay(dateValue: string) {
  if (!dateValue) {
    return "-";
  }

  const [year, month, day] = dateValue.split("-");
  if (!year || !month || !day) {
    return dateValue;
  }
  return `${year}/${month}/${day}`;
}

type TaskMenuState = {
  task: TaskItem;
  x: number;
  y: number;
};

type ToastState = {
  message: string;
  type: "success" | "error";
};

type ExportTaskItem = Omit<TaskItem, "imageBlob"> & {
  imageBlobDataUrl: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("invalid file data"));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload] = dataUrl.split(",");
  if (!header || !payload) {
    throw new Error("invalid data url");
  }

  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? "application/octet-stream";
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

const createdAtFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function TaskCard({
  task,
  onOpenLongPressMenu,
}: {
  task: TaskItem;
  onOpenLongPressMenu: (task: TaskItem, x: number, y: number) => void;
}) {
  const todayJst = useMemo(() => getTodayJstDateString(), []);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const imageSrc = useMemo(() => {
    if (task.imageBlob) {
      return URL.createObjectURL(task.imageBlob);
    }
    return task.imageUrl ?? "";
  }, [task]);

  const hasImage = Boolean(imageSrc);
  const isFutureStart = Boolean(task.startDate) && task.startDate > todayJst;
  const hasSchedule = Boolean(task.startDate || task.endDate);
  const dateLabel = hasSchedule
    ? `開始: ${formatDateForDisplay(task.startDate)} / 終了: ${formatDateForDisplay(task.endDate)}`
    : `作成: ${createdAtFormatter.format(new Date(task.createdAt))}`;

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openMenuAt = (x: number, y: number) => {
    suppressClickRef.current = true;
    onOpenLongPressMenu(task, x, y);
  };

  const handleTouchStart = (event: TouchEvent<HTMLAnchorElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    longPressTimerRef.current = window.setTimeout(() => {
      openMenuAt(touch.clientX, touch.clientY);
    }, 500);
  };

  const handleContextMenu = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    openMenuAt(event.clientX, event.clientY);
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      if (task.imageBlob && imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [task, imageSrc]);

  return (
    <Link
      href={`/task/${task.id}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPressTimer}
      onTouchMove={clearLongPressTimer}
      onTouchCancel={clearLongPressTimer}
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          suppressClickRef.current = false;
        }
      }}
      className={`block h-[122px] rounded-2xl border px-4 py-3 transition hover:border-zinc-400 ${isFutureStart ? "border-zinc-200 bg-zinc-100" : "border-zinc-200 bg-white"
        }`}
    >
      {hasImage ? (
        <div className="flex h-full items-start gap-3">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
            <img src={imageSrc} alt={task.title || "task image"} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className={`line-clamp-2 text-base font-semibold ${isFutureStart ? "text-zinc-500" : "text-zinc-900"}`}>
                {task.title || "（タイトル未入力）"}
              </h2>
              {task.completed && (
                <span className="mt-0.5 rounded-full bg-emerald-500 p-1 text-white">
                  <Check size={13} />
                </span>
              )}
            </div>
            <div className="mt-1 min-h-10">
              {task.caption && (
                <p className={`line-clamp-2 text-sm ${isFutureStart ? "text-zinc-500" : "text-zinc-600"}`}>
                  {task.caption}
                </p>
              )}
            </div>
            <p className={`text-xs ${isFutureStart ? "text-zinc-400" : "text-zinc-500"}`}>{dateLabel}</p>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-2">
            <h2 className={`line-clamp-2 text-base font-semibold ${isFutureStart ? "text-zinc-500" : "text-zinc-900"}`}>
              {task.title || "（タイトル未入力）"}
            </h2>
            {task.completed && (
              <span className="mt-0.5 rounded-full bg-emerald-500 p-1 text-white">
                <Check size={13} />
              </span>
            )}
          </div>
          <div className="mt-1 min-h-10">
            {task.caption && (
              <p className={`line-clamp-2 text-sm ${isFutureStart ? "text-zinc-500" : "text-zinc-600"}`}>
                {task.caption}
              </p>
            )}
          </div>
          <p className={`text-xs ${isFutureStart ? "text-zinc-400" : "text-zinc-500"}`}>{dateLabel}</p>
        </div>
      )}
    </Link>
  );
}

export default function Home() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filterType, setFilterType] = useState<FilterType>(getInitialFilterType);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [taskMenuState, setTaskMenuState] = useState<TaskMenuState | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const isImportingRef = useRef(false);

  const showToast = useCallback((message: string, type: ToastState["type"]) => {
    setToast({ message, type });
  }, []);

  const refreshTasks = useCallback(async () => {
    const allTasks = await getAllTasks();
    setTasks(allTasks);
    return allTasks;
  }, []);

  const handleReload = () => {
    setIsTopMenuOpen(false);
    window.location.reload();
  };

  const handleExport = async () => {
    setIsTopMenuOpen(false);

    try {
      const allTasks = await getAllTasks();
      const exportTasks = await Promise.all(
        allTasks.map(async (task): Promise<ExportTaskItem> => ({
          ...task,
          imageBlobDataUrl: task.imageBlob ? await blobToDataUrl(task.imageBlob) : null,
        })),
      );

      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        tasks: exportTasks,
      };

      const exportBlob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(exportBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tsubushigoto-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      showToast("エクスポートしました", "success");
    } catch {
      showToast("エクスポートに失敗しました", "error");
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (isImportingRef.current) {
      return;
    }

    isImportingRef.current = true;

    try {
      const fileText = await file.text();
      const parsed = JSON.parse(fileText) as { tasks?: unknown } | unknown[];
      const sourceTasks = Array.isArray(parsed) ? parsed : parsed.tasks;

      if (!Array.isArray(sourceTasks)) {
        throw new Error("invalid import file");
      }

      let importedCount = 0;

      for (const sourceTask of sourceTasks) {
        if (!sourceTask || typeof sourceTask !== "object") {
          continue;
        }

        const record = sourceTask as Partial<ExportTaskItem> & { imageBlobDataUrl?: unknown };
        const hasTaskLikeField = [
          "title",
          "caption",
          "memo",
          "link",
          "startDate",
          "endDate",
          "imageUrl",
          "imageBlobDataUrl",
          "createdAt",
          "updatedAt",
          "completed",
        ].some((key) => key in record);

        if (!hasTaskLikeField) {
          continue;
        }

        const draft = createTaskDraft();
        let imageBlob: Blob | null = null;

        if (typeof record.imageBlobDataUrl === "string" && record.imageBlobDataUrl.startsWith("data:")) {
          try {
            imageBlob = dataUrlToBlob(record.imageBlobDataUrl);
          } catch {
            imageBlob = null;
          }
        }

        const nextTask: TaskItem = {
          ...draft,
          title: asString(record.title),
          caption: asString(record.caption),
          memo: asString(record.memo),
          link: asString(record.link),
          startDate: asString(record.startDate),
          endDate: asString(record.endDate),
          imageBlob,
          imageUrl: asString(record.imageUrl),
          createdAt: asString(record.createdAt) || draft.createdAt,
          updatedAt: asString(record.updatedAt) || draft.updatedAt,
          completed: Boolean(record.completed),
        };

        await upsertTask(nextTask);
        importedCount += 1;
      }

      await refreshTasks();
      showToast(
        importedCount > 0
          ? `インポートしました`
          : "インポート対象がありません",
        "success",
      );
    } catch {
      showToast("インポートに失敗しました", "error");
    } finally {
      isImportingRef.current = false;
    }
  };

  useEffect(() => {
    let mounted = true;

    async function loadTasks() {
      try {
        const allTasks = await getAllTasks();
        if (mounted) {
          setTasks(allTasks);
        }
      } finally {
        if (mounted) {
          setIsInitialLoaded(true);
        }
      }
    }

    void loadTasks();

    const onFocus = () => {
      void loadTasks();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FILTER_STORAGE_KEY, filterType);
  }, [filterType]);

  useEffect(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    if (!toast) {
      return;
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2400);

    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, [toast]);

  const filteredTasks = useMemo(() => {
    if (filterType === "incomplete") {
      return tasks.filter((task) => !task.completed);
    }
    if (filterType === "completed") {
      return tasks.filter((task) => task.completed);
    }
    return tasks;
  }, [filterType, tasks]);

  const selectFilter = (value: FilterType) => {
    setFilterType(value);
    setIsFilterMenuOpen(false);
  };

  const openTaskMenu = (task: TaskItem, x: number, y: number) => {
    const menuWidth = 144;
    const menuHeight = 52;
    const clampedX = Math.min(x, window.innerWidth - menuWidth - 12);
    const clampedY = Math.min(y, window.innerHeight - menuHeight - 12);

    setTaskMenuState({
      task,
      x: Math.max(12, clampedX),
      y: Math.max(12, clampedY),
    });
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) {
      return;
    }

    await deleteTaskById(taskToDelete.id);
    setTasks((prev) => prev.filter((task) => task.id !== taskToDelete.id));
    setTaskToDelete(null);
  };

  if (!isInitialLoaded) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-zinc-50 px-5 py-6 sm:px-8">
      <header className="relative mb-5 flex items-start justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">つぶしごと</h1>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsTopMenuOpen((prev) => !prev)}
            className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-700"
            aria-label="メニュー"
          >
            <EllipsisVertical size={20} />
          </button>

          {isTopMenuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20"
                onClick={() => setIsTopMenuOpen(false)}
                aria-label="メニューを閉じる"
              />
              <div className="absolute top-12 right-0 z-30 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
                <button
                  type="button"
                  onClick={handleReload}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  <RotateCw size={15} />
                  再読み込み
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="block w-full px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  エクスポート
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTopMenuOpen(false);
                    importInputRef.current?.click();
                  }}
                  className="block w-full px-4 py-3 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                >
                  インポート
                </button>
              </div>
            </>
          )}

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </header>

      <section className="space-y-3 pb-24">
        {filteredTasks.length === 0 ? (
          ""
        ) : (
          filteredTasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpenLongPressMenu={openTaskMenu} />
          ))
        )}
      </section>

      {taskMenuState && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-20"
            onClick={() => setTaskMenuState(null)}
            aria-label="メニューを閉じる"
          />
          <div
            className="fixed z-30 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
            style={{ left: taskMenuState.x, top: taskMenuState.y }}
          >
            <button
              type="button"
              className="px-4 py-3 text-sm text-red-600"
              onClick={() => {
                setTaskToDelete(taskMenuState.task);
                setTaskMenuState(null);
              }}
            >
              削除
            </button>
          </div>
        </>
      )}

      {taskToDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h2 className="text-base font-semibold text-zinc-900">タスクを削除しますか？</h2>
            <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{taskToDelete.title || "（タイトル未入力）"}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                onClick={() => setTaskToDelete(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white"
                onClick={confirmDeleteTask}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 left-5 z-10 sm:left-8">
        {isFilterMenuOpen && (
          <div className="mb-3 w-40 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
            <button
              type="button"
              onClick={() => selectFilter("all")}
              className={`block w-full px-4 py-3 text-left text-sm ${filterType === "all" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700"
                }`}
            >
              全て
            </button>
            <button
              type="button"
              onClick={() => selectFilter("incomplete")}
              className={`block w-full px-4 py-3 text-left text-sm ${filterType === "incomplete" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700"
                }`}
            >
              未完了のみ
            </button>
            <button
              type="button"
              onClick={() => selectFilter("completed")}
              className={`block w-full px-4 py-3 text-left text-sm ${filterType === "completed" ? "bg-zinc-100 text-zinc-900" : "text-zinc-700"
                }`}
            >
              完了のみ
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsFilterMenuOpen((prev) => !prev)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg transition hover:scale-105"
          aria-label="フィルタ"
        >
          <Filter size={24} />
        </button>
      </div>

      <Link
        href="/task/new"
        className="fixed right-5 bottom-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition hover:scale-105"
        aria-label="タスクを作成"
      >
        <Plus size={26} />
      </Link>

      {toast && (
        <div
          className={`fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm text-white shadow-lg ${toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
