// src/schema/state.ts
/**
 * Represents the possible states of an agent during execution.
 */
export enum AgentState {
  IDLE = "IDLE",
  RUNNING = "RUNNING",
  FINISHED = "FINISHED",
  ERROR = "ERROR"
}