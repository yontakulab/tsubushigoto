"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImagePlus, Link2 } from "lucide-react";
import {
  createTaskDraft,
  getTaskById,
  getTaskByIdFromCache,
  TaskItem,
  upsertTask,
} from "@/lib/tasks-db";

type TaskEditorPageProps = {
  taskId?: string;
};

function formatJapaneseDate(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export default function TaskEditorPage({ taskId }: TaskEditorPageProps) {
  const [task, setTask] = useState<TaskItem | null>(() => {
    if (!taskId) {
      return createTaskDraft();
    }
    return getTaskByIdFromCache(taskId) ?? null;
  });
  const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
  const skipFirstSaveRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    async function loadTask() {
      if (!taskId) {
        return;
      }

      if (task) {
        return;
      }

      const existingTask = await getTaskById(taskId);
      if (!mounted) {
        return;
      }

      const nextTask = existingTask ?? createTaskDraft(taskId);
      setTask(nextTask);
    }

    void loadTask();
    return () => {
      mounted = false;
    };
  }, [taskId, task]);

  useEffect(() => {
    if (!task) {
      return;
    }

    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      await upsertTask(task);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [task]);

  const createdText = useMemo(() => {
    return formatJapaneseDate(task?.createdAt ?? "");
  }, [task?.createdAt]);

  const completedText = useMemo(() => {
    if (!task?.completedAt) {
      return "";
    }

    return formatJapaneseDate(task.completedAt);
  }, [task?.completedAt]);

  const updateField = (field: keyof TaskItem, value: string | boolean | Blob | null) => {
    setTask((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const previewImageBlobUrls = useMemo(() => {
    if (!task) {
      return [] as string[];
    }

    const imageBlobs = task.imageBlobs?.length
      ? task.imageBlobs
      : task.imageBlob
        ? [task.imageBlob]
        : [];
    return imageBlobs.map((blob) => URL.createObjectURL(blob));
  }, [task]);

  const previewImageSrcList = useMemo(() => {
    if (previewImageBlobUrls.length > 0) {
      return previewImageBlobUrls;
    }
    return task?.imageUrl ? [task.imageUrl] : [];
  }, [previewImageBlobUrls, task]);

  useEffect(() => {
    return () => {
      previewImageBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewImageBlobUrls]);

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const addedImageBlobs = Array.from(files);
    event.target.value = "";

    setTask((prev) => {
      if (!prev) {
        return prev;
      }

      const existingImageBlobs = prev.imageBlobs?.length
        ? prev.imageBlobs
        : prev.imageBlob
          ? [prev.imageBlob]
          : [];
      const imageBlobs = [...existingImageBlobs, ...addedImageBlobs];

      return {
        ...prev,
        imageBlobs,
        imageBlob: imageBlobs[0] ?? null,
        imageUrl: "",
      };
    });
  };

  const handleCompleteButtonClick = () => {
    if (!task) {
      return;
    }

    if (task.completed) {
      setTask((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          completed: false,
          completedAt: "",
        };
      });
      return;
    }

    setIsCompleteConfirmOpen(true);
  };

  const handleConfirmComplete = () => {
    setTask((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        completed: true,
        completedAt: new Date().toISOString(),
      };
    });
    setIsCompleteConfirmOpen(false);
  };

  if (!task) {
    return <main className="mx-auto min-h-screen max-w-3xl p-6">読み込み中...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl overflow-x-hidden bg-white px-5 py-5 text-zinc-900 sm:px-8">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">
          一覧へ戻る
        </Link>
        {taskId && (
          <button
            type="button"
            onClick={handleCompleteButtonClick}
            className={`rounded-full border p-2 transition ${task.completed
              ? "border-indigo-700 bg-indigo-700 text-white"
              : "border-zinc-300 bg-white text-zinc-500"
              }`}
            aria-label={task.completed ? "未完了にする" : "完了にする"}
            title={task.completed ? "完了" : "未完了"}
          >
            <Check size={20} />
          </button>
        )}
      </header>

      <div className="mb-4 text-xs text-zinc-500">
        <span>作成日: {createdText}</span>
        {task.completed && completedText && <span className="ml-3">完了日: {completedText}</span>}
      </div>

      <section className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">タイトル</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-lg font-semibold outline-none focus:border-zinc-400"
            value={task.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="タスクタイトル"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">キャプション</label>
          <input
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
            value={task.caption}
            onChange={(event) => updateField("caption", event.target.value)}
            placeholder="短い補足"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">説明メモ</label>
          <textarea
            className="min-h-36 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
            value={task.memo}
            onChange={(event) => updateField("memo", event.target.value)}
            placeholder="詳細メモ"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="mb-1 block text-xs text-zinc-500">開始日</label>
            <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 px-3 py-2 focus-within:border-zinc-400">
              <input
                type="date"
                className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none"
                value={task.startDate}
                onChange={(event) => updateField("startDate", event.target.value)}
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-1 block text-xs text-zinc-500">終了日</label>
            <div className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 px-3 py-2 focus-within:border-zinc-400">
              <input
                type="date"
                className="block w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none"
                value={task.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">リンク</label>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2">
            <Link2 size={16} className="text-zinc-400" />
            <input
              className="w-full outline-none"
              value={task.link}
              onChange={(event) => updateField("link", event.target.value)}
              placeholder="https://example.com"
            />
          </div>
          {task.link && (
            <a
              href={task.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm text-blue-600 underline"
            >
              リンクを開く
            </a>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-zinc-500">画像</label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            <ImagePlus size={16} />
            画像を追加
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageFileChange} />
          </label>

          {previewImageSrcList.length > 0 && (
            <div className="mt-3 space-y-3">
              {previewImageSrcList.map((previewImageSrc, index) => (
                <img
                  key={`${previewImageSrc}-${index}`}
                  src={previewImageSrc}
                  alt={`task ${index + 1}`}
                  className="w-full rounded-2xl border border-zinc-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {isCompleteConfirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h2 className="text-base font-semibold text-zinc-900">完了にしますか？</h2>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700"
                onClick={() => setIsCompleteConfirmOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white"
                onClick={handleConfirmComplete}
              >
                完了にする
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
