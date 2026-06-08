type Task<T> = () => Promise<T>;

export class BackgroundTaskQueue {
  private tail = Promise.resolve();

  enqueue<T>(task: Task<T>) {
    const next = this.tail.then(task, task);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }
}

export const aiBackgroundQueue = new BackgroundTaskQueue();
