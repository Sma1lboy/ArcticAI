// src/utils/flow-loader.ts
import { BaseFlow, FlowType } from "../flow/base";
import { FlowFactory } from "../flow/flow-factory";
import { BaseAgent } from "../agent/base";
import { PlanningAgent } from "../agent/planning";
import { ToolCallAgent } from "../agent/toolcall";
import { ToolCollection } from "../tool/tool-collection";
import { PlanningTool } from "../tool/planning";
import { Terminate } from "../tool/terminate";
import { CreateChatCompletion } from "../tool/create-completion";

/**
 * Flow configuration interface
 */
export interface FlowConfig {
  type: FlowType;
  agents: {
    [key: string]: {
      type: "planning" | "toolcall";
      description?: string;
      systemPrompt?: string;
      nextStepPrompt?: string;
      maxSteps?: number;
      tools?: string[];
    };
  };
  primaryAgent: string;
  executors?: string[];
}

/**
 * Utility to load flows from configuration
 */
export class FlowLoader {
  /**
   * Create a flow from a configuration object
   */
  static createFlowFromConfig(config: FlowConfig): BaseFlow {
    // Create agents based on configuration
    const agents = new Map<string, BaseAgent>();

    for (const [key, agentConfig] of Object.entries(config.agents)) {
      // Create agent based on type
      switch (agentConfig.type) {
        case "planning": {
          const agent = new PlanningAgent({
            name: key,
            description: agentConfig.description,
            systemPrompt: agentConfig.systemPrompt,
            nextStepPrompt: agentConfig.nextStepPrompt,
            maxSteps: agentConfig.maxSteps || 10,
            availableTools: this.getToolCollection(
              agentConfig.tools || ["planning", "terminate"]
            ),
          });
          agents.set(key, agent);
          break;
        }
        case "toolcall": {
          const agent = new ToolCallAgent(key, {
            description: agentConfig.description,
            systemPrompt: agentConfig.systemPrompt,
            nextStepPrompt: agentConfig.nextStepPrompt,
            maxSteps: agentConfig.maxSteps || 10,
            availableTools: this.getToolCollection(
              agentConfig.tools || ["chat", "terminate"]
            ),
          });
          agents.set(key, agent);
          break;
        }
        default:
          throw new Error(`Unknown agent type: ${agentConfig.type}`);
      }
    }

    // Create flow with the agents
    return FlowFactory.createFlow(config.type, agents, {
      primaryAgentKey: config.primaryAgent,
      executors: config.executors,
    });
  }

  /**
   * Create a tool collection based on tool names
   */
  private static getToolCollection(toolNames: string[]): ToolCollection {
    const toolMap: Record<string, () => any> = {
      planning: () => new PlanningTool(),
      terminate: () => new Terminate(),
      chat: () => new CreateChatCompletion(),
      // Add more tools as needed
    };

    const tools = toolNames
      .filter((name) => !!toolMap[name])
      .map((name) => toolMap[name]());

    return new ToolCollection(...tools);
  }
}
