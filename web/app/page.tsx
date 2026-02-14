"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { Check, Filter, Plus } from "lucide-react";
import { deleteTaskById, getAllTasks, TaskItem } from "@/lib/tasks-db";

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
  const [taskMenuState, setTaskMenuState] = useState<TaskMenuState | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);

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
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">つぶしごと</h1>
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
    </main>
  );
}
