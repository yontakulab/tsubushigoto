export type TaskItem = {
  id: string;
  title: string;
  caption: string;
  memo: string;
  link: string;
  startDate: string;
  endDate: string;
  imageBlob: Blob | null;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
  completed: boolean;
};

const DB_NAME = "tsubushigoto-db";
const DB_VERSION = 1;
const STORE_NAME = "tasks";

let dbPromise: Promise<IDBDatabase> | null = null;
const taskCache = new Map<string, TaskItem>();

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
    });
  }

  return dbPromise;
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  execute: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);

      tx.onerror = () => reject(tx.error);

      execute(store, resolve);
    } catch (error) {
      reject(error);
    }
  });
}

export function createTaskDraft(id?: string): TaskItem {
  const now = new Date().toISOString();
  return {
    id: id ?? crypto.randomUUID(),
    title: "",
    caption: "",
    memo: "",
    link: "",
    startDate: "",
    endDate: "",
    imageBlob: null,
    imageUrl: "",
    createdAt: now,
    updatedAt: now,
    completed: false,
  };
}

export function getAllTasks(): Promise<TaskItem[]> {
  return runTransaction<TaskItem[]>("readonly", (store, done) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const toSortTime = (task: TaskItem) => {
        if (task.startDate) {
          const startTime = new Date(`${task.startDate}T00:00:00`).getTime();
          if (!Number.isNaN(startTime)) {
            return startTime;
          }
        }
        return new Date(task.createdAt).getTime();
      };

      const tasks = (request.result as TaskItem[]).sort(
        (a, b) => toSortTime(a) - toSortTime(b),
      );

      taskCache.clear();
      for (const task of tasks) {
        taskCache.set(task.id, task);
      }

      done(tasks);
    };
  });
}

export function getTaskByIdFromCache(id: string): TaskItem | undefined {
  return taskCache.get(id);
}

export function getTaskById(id: string): Promise<TaskItem | undefined> {
  const cached = taskCache.get(id);
  if (cached) {
    return Promise.resolve(cached);
  }

  return runTransaction<TaskItem | undefined>("readonly", (store, done) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const task = request.result as TaskItem | undefined;
      if (task) {
        taskCache.set(task.id, task);
      }
      done(task);
    };
  });
}

export function upsertTask(task: TaskItem): Promise<TaskItem> {
  const nextTask = {
    ...task,
    updatedAt: new Date().toISOString(),
  };

  return runTransaction<TaskItem>("readwrite", (store, done) => {
    const request = store.put(nextTask);
    request.onsuccess = () => {
      taskCache.set(nextTask.id, nextTask);
      done(nextTask);
    };
  });
}

export function deleteTaskById(id: string): Promise<void> {
  return runTransaction<void>("readwrite", (store, done) => {
    const request = store.delete(id);
    request.onsuccess = () => {
      taskCache.delete(id);
      done(undefined);
    };
  });
}
