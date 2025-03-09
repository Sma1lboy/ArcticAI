// src/flow/base.ts
import { BaseAgent } from "../agent/base";

/**
 * Enumeration of supported flow types
 */
export enum FlowType {
  PLANNING = "planning",
}

/**
 * Base class for execution flows supporting multiple agents
 */
export abstract class BaseFlow {
  agents: Map<string, BaseAgent>;
  primaryAgentKey: string | null;
  tools?: any[];

  /**
   * Create a new flow with agents
   */
  constructor(
    agents: BaseAgent | BaseAgent[] | Map<string, BaseAgent>,
    config: {
      primaryAgentKey?: string;
      tools?: any[];
    } = {}
  ) {
    // Handle different ways of providing agents
    if (agents instanceof BaseAgent) {
      this.agents = new Map([["default", agents]]);
    } else if (Array.isArray(agents)) {
      this.agents = new Map(agents.map((agent, i) => [`agent_${i}`, agent]));
    } else {
      this.agents = agents;
    }

    // If primary agent not specified, use first agent
    this.primaryAgentKey = config.primaryAgentKey || null;
    if (!this.primaryAgentKey && this.agents.size > 0) {
      this.primaryAgentKey = this.agents.keys().next().value;
    }

    // Set tools if provided
    this.tools = config.tools || [];
  }

  /**
   * Get the primary agent for the flow
   */
  get primaryAgent(): BaseAgent | null {
    return this.primaryAgentKey ? this.getAgent(this.primaryAgentKey) : null;
  }

  /**
   * Get a specific agent by key
   */
  getAgent(key: string): BaseAgent | null {
    return this.agents.get(key) || null;
  }

  /**
   * Add a new agent to the flow
   */
  addAgent(key: string, agent: BaseAgent): void {
    this.agents.set(key, agent);
  }

  /**
   * Execute the flow with given input
   */
  abstract execute(inputText: string): Promise<string>;
}
