"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImagePlus, Link2 } from "lucide-react";
import { createTaskDraft, getTaskById, TaskItem, upsertTask } from "@/lib/tasks-db";

type TaskEditorPageProps = {
  taskId?: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default function TaskEditorPage({ taskId }: TaskEditorPageProps) {
  const [task, setTask] = useState<TaskItem | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const skipFirstSaveRef = useRef(true);

  useEffect(() => {
    let mounted = true;

    async function loadTask() {
      if (taskId) {
        const existingTask = await getTaskById(taskId);
        if (!mounted) {
          return;
        }

        const nextTask = existingTask ?? createTaskDraft(taskId);
        setTask(nextTask);
        setLastSavedAt(nextTask.updatedAt);
        return;
      }

      const draft = createTaskDraft();
      if (!mounted) {
        return;
      }
      setTask(draft);
      setLastSavedAt(draft.updatedAt);
    }

    void loadTask();
    return () => {
      mounted = false;
    };
  }, [taskId]);

  useEffect(() => {
    if (!task) {
      return;
    }

    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      const saved = await upsertTask(task);
      setLastSavedAt(saved.updatedAt);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [task]);

  const savedText = useMemo(() => {
    if (!lastSavedAt) {
      return "";
    }
    return dateTimeFormatter.format(new Date(lastSavedAt));
  }, [lastSavedAt]);

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

  const previewImageSrc = useMemo(() => {
    if (task?.imageBlob) {
      return URL.createObjectURL(task.imageBlob);
    }
    return task?.imageUrl ?? "";
  }, [task]);

  useEffect(() => {
    return () => {
      if (task?.imageBlob && previewImageSrc) {
        URL.revokeObjectURL(previewImageSrc);
      }
    };
  }, [task, previewImageSrc]);

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setTask((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        imageBlob: file,
        imageUrl: "",
      };
    });
  };

  if (!task) {
    return <main className="mx-auto min-h-screen max-w-3xl p-6">読み込み中...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-white px-5 py-5 text-zinc-900 sm:px-8">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">
          一覧へ戻る
        </Link>
        <button
          type="button"
          onClick={() => updateField("completed", !task.completed)}
          className={`rounded-full border p-2 transition ${task.completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-zinc-300 bg-white text-zinc-500"
            }`}
          aria-label={task.completed ? "未完了にする" : "完了にする"}
          title={task.completed ? "完了" : "未完了"}
        >
          <Check size={20} />
        </button>
      </header>

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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">開始日</label>
            <input
              type="date"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              value={task.startDate}
              onChange={(event) => updateField("startDate", event.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-500">終了日</label>
            <input
              type="date"
              className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-zinc-400"
              value={task.endDate}
              onChange={(event) => updateField("endDate", event.target.value)}
            />
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
            画像を選択
            <input type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
          </label>

          {previewImageSrc && (
            <img
              src={previewImageSrc}
              alt="task"
              className="mt-3 w-full rounded-2xl border border-zinc-200 object-cover"
            />
          )}
        </div>
      </section>

      <footer className="mt-6 text-xs text-zinc-500">
        作成日時: {dateTimeFormatter.format(new Date(task.createdAt))}
        <span className="ml-3">自動保存: {savedText}</span>
      </footer>
    </main>
  );
}
