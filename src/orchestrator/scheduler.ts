import type { Task, TaskContext } from "./types";
import { EventEmitter } from "events";
import * as cron from "node-cron";

export class TaskScheduler<T = any> extends EventEmitter {
  private tasks: Map<string, Task<T>> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private cronJobs: Map<string, cron.ScheduledTask> = new Map();
  private runningTasks: Set<string> = new Set();
  private maxConcurrent: number;
  private defaultTimeout: number;

  constructor(maxConcurrent = 5, defaultTimeout = 60000) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.defaultTimeout = defaultTimeout;
  }

  addTask(task: Task<T>): void {
    this.tasks.set(task.id, task);
    this.scheduleTask(task);
  }

  removeTask(taskId: string): void {
    this.clearSchedule(taskId);
    this.tasks.delete(taskId);
  }

  pauseTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "paused";
      this.clearSchedule(taskId);
    }
  }

  resumeTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task && task.status === "paused") {
      task.status = "idle";
      this.scheduleTask(task);
    }
  }

  pauseAll(): void {
    for (const task of this.tasks.values()) {
      this.pauseTask(task.id);
    }
  }

  resumeAll(): void {
    for (const task of this.tasks.values()) {
      if (task.status === "paused") {
        this.resumeTask(task.id);
      }
    }
  }

  async executeTask(taskId: string, context: TaskContext<T>): Promise<any> {
    const task = this.tasks.get(taskId);
    if (!task || !task.enabled) return;

    if (this.runningTasks.size >= this.maxConcurrent) {
      this.emit("taskQueued", task);
      return;
    }

    // Check condition
    if (task.condition) {
      const shouldRun = await Promise.resolve(task.condition(context));
      if (!shouldRun) {
        this.emit("taskSkipped", task, "condition not met");
        return;
      }
    }

    this.runningTasks.add(taskId);
    task.status = "running";
    task.executionCount++;
    task.lastExecutionTime = new Date();

    const timeout = task.timeout || this.defaultTimeout;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Task timeout")), timeout),
    );

    try {
      this.emit("taskStarted", task);

      const result = await Promise.race([
        Promise.resolve(task.fn(context)),
        timeoutPromise,
      ]);

      task.lastResult = result;
      task.status = "completed";
      this.emit("taskCompleted", task, result);

      return result;
    } catch (error) {
      task.lastError = error as Error;
      task.status = "error";
      this.emit("taskError", task, error);

      // Retry logic
      if (task.maxRetries && task.executionCount < task.maxRetries) {
        setTimeout(() => {
          this.executeTask(taskId, context);
        }, task.retryDelay || 5000);
      }

      throw error;
    } finally {
      this.runningTasks.delete(taskId);
      this.updateNextExecutionTime(task);
    }
  }

  private scheduleTask(task: Task<T>): void {
    if (!task.enabled || task.status === "paused") return;

    // Clear existing schedule
    this.clearSchedule(task.id);

    // Schedule based on interval or cron
    if (task.interval) {
      const intervalId = setInterval(() => {
        this.emit("taskScheduled", task);
      }, task.interval);
      this.intervals.set(task.id, intervalId);
    } else if (task.cron) {
      const cronJob = cron.schedule(task.cron, () => {
        this.emit("taskScheduled", task);
      });
      cronJob.start();
      this.cronJobs.set(task.id, cronJob);
    }

    // Run on start if specified
    if (task.runOnStart) {
      setImmediate(() => {
        this.emit("taskScheduled", task);
      });
    }
  }

  private clearSchedule(taskId: string): void {
    const interval = this.intervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskId);
    }

    const cronJob = this.cronJobs.get(taskId);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(taskId);
    }
  }

  private updateNextExecutionTime(task: Task<T>): void {
    if (task.interval) {
      task.nextExecutionTime = new Date(Date.now() + task.interval);
    } else if (task.cron) {
      // Calculate next cron execution time
      const cronExpression = cron.validate(task.cron);
      if (cronExpression) {
        // This is a simplified approach - in production you'd want a proper cron parser
        task.nextExecutionTime = new Date(Date.now() + 60000); // 1 minute placeholder
      }
    }
  }

  getTasks(): Task<T>[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): Task<T> | undefined {
    return this.tasks.get(taskId);
  }

  destroy(): void {
    for (const taskId of this.tasks.keys()) {
      this.clearSchedule(taskId);
    }
    this.tasks.clear();
    this.runningTasks.clear();
    this.removeAllListeners();
  }
}
