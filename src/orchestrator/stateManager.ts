import type { OrchestratorState, Task } from "./types";
import * as fs from "fs/promises";
import * as path from "path";

export class StateManager<T = any> {
  private statePath?: string;

  constructor(statePath?: string) {
    this.statePath = statePath;
  }

  async saveState(state: OrchestratorState<T>): Promise<void> {
    if (!this.statePath) return;

    try {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });

      const serializedState = {
        ...state,
        tasks: state.tasks.map((task) => ({
          ...task,
          fn: undefined, // Functions can't be serialized
          condition: undefined,
        })),
      };

      await fs.writeFile(
        this.statePath,
        JSON.stringify(serializedState, null, 2),
        "utf-8",
      );
    } catch (error) {
      console.error("Failed to save orchestrator state:", error);
      throw error;
    }
  }

  async loadState(): Promise<Partial<OrchestratorState<T>> | null> {
    if (!this.statePath) return null;

    try {
      const data = await fs.readFile(this.statePath, "utf-8");
      const state = JSON.parse(data);

      // Convert date strings back to Date objects
      if (state.startTime) state.startTime = new Date(state.startTime);
      if (state.pauseTime) state.pauseTime = new Date(state.pauseTime);
      if (state.resumeTime) state.resumeTime = new Date(state.resumeTime);

      if (state.tasks) {
        state.tasks = state.tasks.map((task: any) => ({
          ...task,
          lastExecutionTime: task.lastExecutionTime
            ? new Date(task.lastExecutionTime)
            : undefined,
          nextExecutionTime: task.nextExecutionTime
            ? new Date(task.nextExecutionTime)
            : undefined,
        }));
      }

      return state;
    } catch (error) {
      if ((error as any).code === "ENOENT") {
        return null;
      }
      console.error("Failed to load orchestrator state:", error);
      throw error;
    }
  }

  async clearState(): Promise<void> {
    if (!this.statePath) return;

    try {
      await fs.unlink(this.statePath);
    } catch (error) {
      if ((error as any).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
