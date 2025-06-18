export interface TaskContext<T = any> {
  shared: T;
  taskId: string;
  executionCount: number;
  lastExecutionTime?: Date;
  nextExecutionTime?: Date;
}

export interface TaskConfig<T = any> {
  id: string;
  name?: string;
  fn: (context: TaskContext<T>) => Promise<any> | any;
  interval?: number; // milliseconds
  cron?: string; // cron expression
  runOnStart?: boolean;
  condition?: (context: TaskContext<T>) => boolean | Promise<boolean>;
  priority?: number; // higher number = higher priority
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  enabled?: boolean;
}

export interface Task<T = any> extends TaskConfig<T> {
  status: 'idle' | 'running' | 'paused' | 'error' | 'completed';
  executionCount: number;
  lastExecutionTime?: Date;
  nextExecutionTime?: Date;
  lastError?: Error;
  lastResult?: any;
}

export interface OrchestratorConfig<T = any> {
  name?: string;
  context?: T;
  statePersistPath?: string;
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
  errorHandler?: (error: Error, task: Task<T>) => void;
}

export interface OrchestratorState<T = any> {
  name: string;
  context: T;
  tasks: Task<T>[];
  isPaused: boolean;
  startTime?: Date;
  pauseTime?: Date;
  resumeTime?: Date;
}