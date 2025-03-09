// src/flow/planning.ts
import { BaseFlow } from "./base";
import { BaseAgent } from "../agent/base";
import { LLM } from "../llm";
import { LLMConfig } from "../llm/types";
import { AgentState, Message } from "../schema";
import { PlanningTool } from "../tool/planning";

/**
 * A flow that manages planning and execution of tasks using agents
 */
export class PlanningFlow extends BaseFlow {
  llm: LLM;
  planningTool: PlanningTool;
  executorKeys: string[];
  activePlanId: string;
  currentStepIndex: number | null;

  /**
   * Create a new planning flow
   */
  constructor(
    agents: BaseAgent | BaseAgent[] | Map<string, BaseAgent>,
    config: {
      primaryAgentKey?: string;
      tools?: any[];
      executors?: string[];
      planId?: string;
      planningTool?: PlanningTool;
      llmConfig?: LLMConfig;
    } = {}
  ) {
    // Set executor keys if provided
    const executorKeys = config.executors || [];

    // Set plan ID if provided
    const activePlanId = config.planId || `plan_${Date.now()}`;

    // Initialize the planning tool if not provided
    const planningTool = config.planningTool || new PlanningTool();

    // Call parent's init with the processed data
    super(agents, {
      primaryAgentKey: config.primaryAgentKey,
      tools: config.tools,
    });

    // Store additional properties
    this.executorKeys = executorKeys;
    this.activePlanId = activePlanId;
    this.planningTool = planningTool;
    this.currentStepIndex = null;

    // Initialize LLM (placeholder - will need actual config in implementation)
    this.llm = LLM.getInstance("default", {} as LLMConfig);

    // Set executor_keys to all agent keys if not specified
    if (this.executorKeys.length === 0) {
      this.executorKeys = Array.from(this.agents.keys());
    }
  }

  /**
   * Get an appropriate executor agent for the current step
   */
  getExecutor(stepType?: string): BaseAgent {
    // If step type is provided and matches an agent key, use that agent
    if (stepType && this.agents.has(stepType)) {
      return this.agents.get(stepType)!;
    }

    // Otherwise use the first available executor or fall back to primary agent
    for (const key of this.executorKeys) {
      if (this.agents.has(key)) {
        return this.agents.get(key)!;
      }
    }

    // Fallback to primary agent
    if (this.primaryAgent) {
      return this.primaryAgent;
    }

    throw new Error("No suitable executor agent available");
  }

  /**
   * Execute the planning flow with agents
   */
  async execute(inputText: string): Promise<string> {
    try {
      if (!this.primaryAgent) {
        throw new Error("No primary agent available");
      }

      // Create initial plan if input provided
      if (inputText) {
        await this.createInitialPlan(inputText);

        // Verify plan was created successfully by checking if it exists in the planning tool
        // This is a placeholder check - actual implementation would depend on how planning tool stores plans
        const planExists = true; // await this.planningTool.planExists(this.activePlanId);

        if (!planExists) {
          console.error(
            `Plan creation failed. Plan ID ${this.activePlanId} not found in planning tool.`
          );
          return `Failed to create plan for: ${inputText}`;
        }
      }

      let result = "";
      while (true) {
        // Get current step to execute
        const stepInfo = await this.getCurrentStepInfo();
        this.currentStepIndex = stepInfo.index;

        // Exit if no more steps or plan completed
        if (this.currentStepIndex === null) {
          result += await this.finalizePlan();
          break;
        }

        // Execute current step with appropriate agent
        const stepType = stepInfo.type;
        const executor = this.getExecutor(stepType);
        const stepResult = await this.executeStep(executor, stepInfo);
        result += stepResult + "\n";

        // Check if agent wants to terminate
        if (executor.state === AgentState.FINISHED) {
          break;
        }
      }

      return result;
    } catch (error) {
      console.error(`Error in PlanningFlow: ${error}`);
      return `Execution failed: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * Create an initial plan based on the request
   */
  private async createInitialPlan(request: string): Promise<void> {
    console.log(`Creating initial plan with ID: ${this.activePlanId}`);

    // Create a system message for plan creation
    const systemMessage = Message.systemMessage(
      "You are a planning assistant. Create a concise, actionable plan with clear steps. " +
        "Focus on key milestones rather than detailed sub-steps. " +
        "Optimize for clarity and efficiency."
    );

    // Create a user message with the request
    const userMessage = Message.userMessage(
      `Create a reasonable plan with clear steps to accomplish the task: ${request}`
    );

    // Call LLM with PlanningTool
    const response = await this.llm.askTool(
      [userMessage],
      [systemMessage],
      [this.planningTool.toParam()],
      "required"
    );

    // Process tool calls if present
    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.function.name === "planning") {
          // Parse the arguments
          let args: Record<string, any> = {};
          if (toolCall.function.arguments) {
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch (e) {
              console.error(
                `Failed to parse tool arguments: ${toolCall.function.arguments}`
              );
              continue;
            }
          }

          // Ensure plan_id is set correctly and execute the tool
          args.plan_id = this.activePlanId;

          // Execute the planning tool
          const result = await this.planningTool.execute(args);
          console.log(`Plan creation result: ${String(result)}`);
          return;
        }
      }
    }

    // If execution reached here, create a default plan
    console.warn("Creating default plan");

    // Create default plan using the planning tool
    await this.planningTool.execute({
      command: "create",
      plan_id: this.activePlanId,
      title: `Plan for: ${request.slice(0, 50)}${
        request.length > 50 ? "..." : ""
      }`,
      steps: ["Analyze request", "Execute task", "Verify results"],
    });
  }

  /**
   * Parse the current plan to identify the first non-completed step's info
   */
  private async getCurrentStepInfo(): Promise<{
    index: number | null;
    text?: string;
    type?: string;
  }> {
    // Placeholder implementation - actual implementation would parse plan data
    try {
      const planText = await this.getPlanText();
      const planLines = planText.split("\n");

      // Find the 'Steps:' line
      let stepsLineIndex = -1;
      for (let i = 0; i < planLines.length; i++) {
        if (planLines[i].trim() === "Steps:") {
          stepsLineIndex = i;
          break;
        }
      }

      if (stepsLineIndex === -1) {
        return { index: null };
      }

      // Look for non-completed steps
      for (let i = stepsLineIndex + 1; i < planLines.length; i++) {
        const line = planLines[i];
        if (line.includes("[ ]") || line.includes("[→]")) {
          // Extract step text and potential type
          const stepText = line.substring(line.indexOf("]") + 1).trim();

          // Try to extract step type if it's in [TYPE] format
          let stepType;
          const typeMatch = stepText.match(/\[([A-Z_]+)\]/);
          if (typeMatch) {
            stepType = typeMatch[1].toLowerCase();
          }

          // Mark step as in_progress
          const stepIndex = parseInt(line.match(/^\d+/)?.[0] || "0");

          await this.planningTool.execute({
            command: "mark_step",
            plan_id: this.activePlanId,
            step_index: stepIndex,
            step_status: "in_progress",
          });

          return {
            index: stepIndex,
            text: stepText,
            type: stepType,
          };
        }
      }

      // No active steps found
      return { index: null };
    } catch (error) {
      console.error(`Error getting current step info: ${error}`);
      return { index: null };
    }
  }

  /**
   * Execute the current step with the specified agent
   */
  private async executeStep(
    executor: BaseAgent,
    stepInfo: { index: number | null; text?: string; type?: string }
  ): Promise<string> {
    // Prepare context for the agent with current plan status
    const planStatus = await this.getPlanText();
    const stepText = stepInfo.text || `Step ${stepInfo.index}`;

    // Create a prompt for the agent to execute the current step
    const stepPrompt = `
      CURRENT PLAN STATUS:
      ${planStatus}

      YOUR CURRENT TASK:
      You are now working on step ${stepInfo.index}: "${stepText}"

      Please execute this step using the appropriate tools. When you're done, provide a summary of what you accomplished.
    `;

    // Use agent.run() to execute the step
    try {
      const stepResult = await executor.run(stepPrompt);

      // Mark the step as completed after successful execution
      await this.markStepCompleted();

      return stepResult;
    } catch (error) {
      console.error(`Error executing step ${stepInfo.index}: ${error}`);
      return `Error executing step ${stepInfo.index}: ${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  /**
   * Mark the current step as completed
   */
  private async markStepCompleted(): Promise<void> {
    if (this.currentStepIndex === null) {
      return;
    }

    try {
      // Mark the step as completed
      await this.planningTool.execute({
        command: "mark_step",
        plan_id: this.activePlanId,
        step_index: this.currentStepIndex,
        step_status: "completed",
      });

      console.log(
        `Marked step ${this.currentStepIndex} as completed in plan ${this.activePlanId}`
      );
    } catch (error) {
      console.warn(`Failed to update plan status: ${error}`);
      // Direct update of step status would go here if the tool execution fails
    }
  }
}
