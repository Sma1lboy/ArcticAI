// src/agent/react.ts
import { AgentState, Memory } from "../schema";
import { LLM } from "../llm";
import { LLMConfig } from "../llm/types";
import { BaseAgent } from "./base";

/**
 * Base agent class implementing the ReAct (Reasoning and Acting) paradigm
 */
export abstract class ReActAgent extends BaseAgent {
  /**
   * Create a new ReAct agent
   */
  constructor(
    name: string,
    config: {
      description?: string;
      systemPrompt?: string;
      nextStepPrompt?: string;
      llmConfig?: LLMConfig;
      memory?: Memory;
      maxSteps?: number;
      duplicateThreshold?: number;
    } = {}
  ) {
    super(name, {
      description: config.description,
      systemPrompt: config.systemPrompt,
      nextStepPrompt: config.nextStepPrompt,
      llmConfig: config.llmConfig,
      memory: config.memory || new Memory(),
      maxSteps: config.maxSteps || 10,
      duplicateThreshold: config.duplicateThreshold || 2,
    });
  }

  /**
   * Process current state and decide next action
   * @returns boolean indicating whether the agent should act
   */
  abstract think(): Promise<boolean>;

  /**
   * Execute decided actions
   * @returns string result of the action
   */
  abstract act(): Promise<string>;

  /**
   * Execute a single step: think and act
   */
  async step(): Promise<string> {
    const shouldAct = await this.think();
    if (!shouldAct) {
      return "Thinking complete - no action needed";
    }
    return await this.act();
  }
}
