// src/flow/flow-factory.ts
import { BaseAgent } from "../agent/base";
import { BaseFlow, FlowType } from "./base";
import { PlanningFlow } from "./planning";

/**
 * Factory for creating different types of flows with support for multiple agents
 */
export class FlowFactory {
  /**
   * Create a flow of the specified type with the given agents and configuration
   */
  static createFlow(
    flowType: FlowType,
    agents: BaseAgent | BaseAgent[] | Map<string, BaseAgent>,
    config: Record<string, any> = {}
  ): BaseFlow {
    const flows = {
      [FlowType.PLANNING]: PlanningFlow,
    };

    const FlowClass = flows[flowType];
    if (!FlowClass) {
      throw new Error(`Unknown flow type: ${flowType}`);
    }

    return new FlowClass(agents, config);
  }
}
