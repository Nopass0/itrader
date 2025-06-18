import { EventEmitter } from "events";
import type {
  Task,
  TaskConfig,
  TaskContext,
  OrchestratorConfig,
  OrchestratorState,
} from "./types";
import { TaskScheduler } from "./scheduler";
import { StateManager } from "./stateManager";
import { createLogger } from "../logger";

const logger = createLogger('Orchestrator');

export class Orchestrator<T = any> extends EventEmitter {
  private name: string;
  public context: T;
  private scheduler: TaskScheduler<T>;
  private stateManager: StateManager<T>;
  private isPaused: boolean = false;
  private startTime?: Date;
  private pauseTime?: Date;
  private resumeTime?: Date;
  private errorHandler?: (error: Error, task: Task<T>) => void;
  private taskConfigs: Map<string, TaskConfig<T>> = new Map();

  constructor(config: OrchestratorConfig<T> = {}) {
    super();
    this.name = config.name || "Orchestrator";
    this.context = config.context || ({} as T);
    this.errorHandler = config.errorHandler;

    this.scheduler = new TaskScheduler<T>(
      config.maxConcurrentTasks,
      config.defaultTimeout,
    );

    this.stateManager = new StateManager<T>(config.statePersistPath);

    this.setupSchedulerListeners();
  }

  async initialize(): Promise<void> {
    const savedState = await this.stateManager.loadState();
    if (savedState) {
      this.restoreFromState(savedState);
    }
  }

  addTask(config: TaskConfig<T>): void {
    const task: Task<T> = {
      ...config,
      status: "idle",
      executionCount: 0,
      enabled: config.enabled !== false,
    };

    // Store original config for state restoration
    this.taskConfigs.set(config.id, config);

    this.scheduler.addTask(task);
    this.emit("taskAdded", task);
    this.saveState();
  }

  removeTask(taskId: string): void {
    this.scheduler.removeTask(taskId);
    this.taskConfigs.delete(taskId);
    this.emit("taskRemoved", taskId);
    this.saveState();
  }

  pauseTask(taskId: string): void {
    this.scheduler.pauseTask(taskId);
    this.saveState();
  }

  resumeTask(taskId: string): void {
    this.scheduler.resumeTask(taskId);
    this.saveState();
  }

  async start(): Promise<void> {
    if (!this.isPaused) {
      this.startTime = new Date();
    } else {
      this.resumeTime = new Date();
    }

    this.isPaused = false;
    this.scheduler.resumeAll();
    this.emit("started");
    await this.saveState();
  }

  async pause(): Promise<void> {
    this.isPaused = true;
    this.pauseTime = new Date();
    this.scheduler.pauseAll();
    this.emit("paused");
    await this.saveState();
  }

  async stop(): Promise<void> {
    this.scheduler.destroy();
    await this.stateManager.clearState();
    this.emit("stopped");
  }

  setContext(context: T): void {
    this.context = context;
    this.saveState();
  }

  updateContext(updates: Partial<T>): void {
    this.context = { ...this.context, ...updates };
    this.saveState();
  }

  getContext(): T {
    return this.context;
  }

  getState(): OrchestratorState<T> {
    return {
      name: this.name,
      context: this.context,
      tasks: this.scheduler.getTasks(),
      isPaused: this.isPaused,
      startTime: this.startTime,
      pauseTime: this.pauseTime,
      resumeTime: this.resumeTime,
    };
  }

  getTasks(): Task<T>[] {
    return this.scheduler.getTasks();
  }

  getTask(taskId: string): Task<T> | undefined {
    return this.scheduler.getTask(taskId);
  }

  async getStatus() {
    return {
      isRunning: !this.isPaused,
      status: this.isPaused ? 'paused' : 'running',
      startedAt: this.startTime,
      pausedAt: this.pauseTime,
      resumedAt: this.resumeTime
    };
  }

  async getRunningTasks() {
    return this.scheduler.getTasks().filter(task => task.status === 'running');
  }

  async getScheduledTasks() {
    return this.scheduler.getTasks().filter(task => task.status === 'scheduled' || task.status === 'idle');
  }

  async reload() {
    // Reload configuration or restart tasks as needed
    // For now, just emit a reload event
    this.emit('reloaded');
  }

  // Convenience methods for creating tasks
  addInterval(
    id: string,
    fn: (context: TaskContext<T>) => any,
    interval: number,
    options?: Partial<TaskConfig<T>>,
  ): void {
    this.addTask({
      id,
      fn,
      interval,
      ...options,
    });
  }

  addCron(
    id: string,
    fn: (context: TaskContext<T>) => any,
    cronExpression: string,
    options?: Partial<TaskConfig<T>>,
  ): void {
    this.addTask({
      id,
      fn,
      cron: cronExpression,
      ...options,
    });
  }

  addOneTime(
    id: string,
    fn: (context: TaskContext<T>) => any,
    options?: Partial<TaskConfig<T>>,
  ): void {
    this.addTask({
      id,
      fn: async (context) => {
        const result = await fn(context);
        this.removeTask(id); // Remove after execution
        return result;
      },
      runOnStart: true,
      ...options,
    });
  }

  addConditional(
    id: string,
    fn: (context: TaskContext<T>) => any,
    condition: (context: TaskContext<T>) => boolean,
    checkInterval: number,
    options?: Partial<TaskConfig<T>>,
  ): void {
    this.addTask({
      id,
      fn,
      condition,
      interval: checkInterval,
      ...options,
    });
  }

  private setupSchedulerListeners(): void {
    this.scheduler.on("taskScheduled", (task: Task<T>) => {
      const context: TaskContext<T> = {
        shared: this.context,
        taskId: task.id,
        executionCount: task.executionCount,
        lastExecutionTime: task.lastExecutionTime,
        nextExecutionTime: task.nextExecutionTime,
      };

      this.scheduler.executeTask(task.id, context).catch((error) => {
        if (this.errorHandler) {
          this.errorHandler(error, task);
        }
      });
    });

    this.scheduler.on("taskStarted", (task: Task<T>) => {
      this.emit("taskStarted", task);
    });

    this.scheduler.on("taskCompleted", (task: Task<T>, result: any) => {
      this.emit("taskCompleted", task, result);
      this.saveState();
    });

    this.scheduler.on("taskError", (task: Task<T>, error: Error) => {
      this.emit("taskError", task, error);
      this.saveState();
    });

    this.scheduler.on("taskQueued", (task: Task<T>) => {
      this.emit("taskQueued", task);
    });

    this.scheduler.on("taskSkipped", (task: Task<T>, reason: string) => {
      this.emit("taskSkipped", task, reason);
    });
  }

  private async saveState(): Promise<void> {
    try {
      await this.stateManager.saveState(this.getState());
    } catch (error) {
      this.emit("error", error);
    }
  }

  private restoreFromState(state: Partial<OrchestratorState<T>>): void {
    if (state.context) {
      this.context = state.context;
    }

    if (state.isPaused !== undefined) {
      this.isPaused = state.isPaused;
    }

    if (state.startTime) {
      this.startTime = state.startTime;
    }

    if (state.pauseTime) {
      this.pauseTime = state.pauseTime;
    }

    if (state.resumeTime) {
      this.resumeTime = state.resumeTime;
    }

    // Restore tasks with their original functions
    if (state.tasks) {
      for (const taskState of state.tasks) {
        const originalConfig = this.taskConfigs.get(taskState.id);
        if (originalConfig) {
          const task: Task<T> = {
            ...originalConfig,
            ...taskState,
            fn: originalConfig.fn,
            condition: originalConfig.condition,
          };
          this.scheduler.addTask(task);
        }
      }
    }

    this.emit("stateRestored", state);
  }
}
