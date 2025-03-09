// src/agent/planning.ts
import { ToolCallAgent } from "./toolcall";
import { Message, ToolCall } from "../schema";
import { LLMConfig } from "../llm/types";
import { ToolCollection } from "../tool/tool-collection";
import { PlanningTool } from "../tool/planning";
import { Terminate } from "../tool/terminate";

const PLANNING_SYSTEM_PROMPT = `
You are an expert Planning Agent tasked with solving problems efficiently through structured plans.
Your job is:
1. Analyze requests to understand the task scope
2. Create a clear, actionable plan that makes meaningful progress with the \`planning\` tool
3. Execute steps using available tools as needed
4. Track progress and adapt plans when necessary
5. Use \`finish\` to conclude immediately when the task is complete

Available tools will vary by task but may include:
- \`planning\`: Create, update, and track plans (commands: create, update, mark_step, etc.)
- \`finish\`: End the task when complete
Break tasks into logical steps with clear outcomes. Avoid excessive detail or sub-steps.
Think about dependencies and verification methods.
Know when to conclude - don't continue thinking once objectives are met.
`;

const NEXT_STEP_PROMPT = `
Based on the current state, what's your next action?
Choose the most efficient path forward:
1. Is the plan sufficient, or does it need refinement?
2. Can you execute the next step immediately?
3. Is the task complete? If so, use \`finish\` right away.

Be concise in your reasoning, then select the appropriate tool or action.
`;

/**
 * Agent that creates and manages plans to solve tasks
 */
export class PlanningAgent extends ToolCallAgent {
  // Planning-specific properties
  activePlanId: string | null;
  stepExecutionTracker: Map<string, Record<string, any>>;
  currentStepIndex: number | null;

  /**
   * Create a new PlanningAgent
   */
  constructor(
    config: {
      name?: string;
      description?: string;
      systemPrompt?: string;
      nextStepPrompt?: string;
      llmConfig?: LLMConfig;
      maxSteps?: number;
      availableTools?: ToolCollection;
    } = {}
  ) {
    // Set up with planning defaults
    super(config.name || "planning", {
      description:
        config.description ||
        "An agent that creates and manages plans to solve tasks",
      systemPrompt: config.systemPrompt || PLANNING_SYSTEM_PROMPT,
      nextStepPrompt: config.nextStepPrompt || NEXT_STEP_PROMPT,
      llmConfig: config.llmConfig,
      maxSteps: config.maxSteps || 20,
      toolChoices: "auto",
      specialToolNames: [new Terminate().name],
      availableTools:
        config.availableTools ||
        new ToolCollection(new PlanningTool(), new Terminate()),
    });

    // Initialize planning-specific properties
    this.activePlanId = `plan_${Date.now()}`;
    this.stepExecutionTracker = new Map();
    this.currentStepIndex = null;

    // Ensure we have the planning tool
    const planningTool = this.availableTools.getTool("planning");
    if (!planningTool) {
      this.availableTools.addTool(new PlanningTool());
    }
  }

  /**
   * Override think to include plan status
   */
  async think(): Promise<boolean> {
    // Add current plan status to prompt
    const prompt = this.activePlanId
      ? `CURRENT PLAN STATUS:\n${await this.getPlan()}\n\n${
          this.nextStepPrompt
        }`
      : this.nextStepPrompt || "";

    this.messages.push(Message.userMessage(prompt));

    // Get the current step index before thinking
    this.currentStepIndex = await this.getCurrentStepIndex();

    const result = await super.think();

    // After thinking, if we decided to execute a tool and it's not a planning tool or special tool,
    // associate it with the current step for tracking
    if (result && this.toolCalls.length > 0) {
      const latestToolCall = this.toolCalls[0]; // Get the most recent tool call

      if (
        latestToolCall.function.name !== "planning" &&
        !this.specialToolNames.includes(latestToolCall.function.name) &&
        this.currentStepIndex !== null
      ) {
        this.stepExecutionTracker.set(latestToolCall.id, {
          stepIndex: this.currentStepIndex,
          toolName: latestToolCall.function.name,
          status: "pending", // Will be updated after execution
        });
      }
    }

    return result;
  }

  /**
   * Override act to update plan status after execution
   */
  async act(): Promise<string> {
    const result = await super.act();

    // After executing the tool, update the plan status
    if (this.toolCalls.length > 0) {
      const latestToolCall = this.toolCalls[0];

      // Update the execution status to completed
      if (this.stepExecutionTracker.has(latestToolCall.id)) {
        const tracker = this.stepExecutionTracker.get(latestToolCall.id)!;
        tracker.status = "completed";
        tracker.result = result;
        this.stepExecutionTracker.set(latestToolCall.id, tracker);

        // Update the plan status if this was a non-planning, non-special tool
        if (
          latestToolCall.function.name !== "planning" &&
          !this.specialToolNames.includes(latestToolCall.function.name)
        ) {
          await this.updatePlanStatus(latestToolCall.id);
        }
      }
    }

    return result;
  }

  /**
   * Retrieve the current plan status
   */
  async getPlan(): Promise<string> {
    if (!this.activePlanId) {
      return "No active plan. Please create a plan first.";
    }

    const result = await this.availableTools.execute("planning", {
      command: "get",
      plan_id: this.activePlanId,
    });

    return result.output ? String(result.output) : String(result);
  }

  /**
   * Run the agent with an optional initial request
   */
  async run(request?: string): Promise<string> {
    if (request) {
      await this.createInitialPlan(request);
    }
    return await super.run();
  }

  /**
   * Update the current plan progress based on completed tool execution
   */
  async updatePlanStatus(toolCallId: string): Promise<void> {
    if (!this.activePlanId) {
      return;
    }

    if (!this.stepExecutionTracker.has(toolCallId)) {
      console.warn(`No step tracking found for tool call ${toolCallId}`);
      return;
    }

    const tracker = this.stepExecutionTracker.get(toolCallId)!;
    if (tracker.status !== "completed") {
      console.warn(`Tool call ${toolCallId} has not completed successfully`);
      return;
    }

    const stepIndex = tracker.stepIndex;

    try {
      // Mark the step as completed
      await this.availableTools.execute("planning", {
        command: "mark_step",
        plan_id: this.activePlanId,
        step_index: stepIndex,
        step_status: "completed",
      });

      console.log(
        `Marked step ${stepIndex} as completed in plan ${this.activePlanId}`
      );
    } catch (error) {
      console.warn(`Failed to update plan status: ${error}`);
    }
  }

  /**
   * Parse the current plan to identify the first non-completed step's index
   */
  async getCurrentStepIndex(): Promise<number | null> {
    if (!this.activePlanId) {
      return null;
    }

    const plan = await this.getPlan();

    try {
      // Parse the plan text to find the first non-completed step
      const planLines = plan.split("\n");
      let stepsIndex = -1;

      // Find the index of the "Steps:" line
      for (let i = 0; i < planLines.length; i++) {
        if (planLines[i].trim() === "Steps:") {
          stepsIndex = i;
          break;
        }
      }

      if (stepsIndex === -1) {
        return null;
      }

      // Find the first non-completed step
      for (let i = 0; i < planLines.slice(stepsIndex + 1).length; i++) {
        const line = planLines[stepsIndex + 1 + i];
        if (line.includes("[ ]") || line.includes("[→]")) {
          // not_started or in_progress
          // Mark current step as in_progress
          await this.availableTools.execute("planning", {
            command: "mark_step",
            plan_id: this.activePlanId,
            step_index: i,
            step_status: "in_progress",
          });
          return i;
        }
      }

      return null; // No active step found
    } catch (error) {
      console.warn(`Error finding current step index: ${error}`);
      return null;
    }
  }

  /**
   * Create an initial plan based on the request
   */
  async createInitialPlan(request: string): Promise<void> {
    console.log(`Creating initial plan with ID: ${this.activePlanId}`);

    const messages = [
      Message.userMessage(
        `Analyze the request and create a plan with ID ${this.activePlanId}: ${request}`
      ),
    ];

    this.memory.addMessages(messages);

    const response = await this.llm.askTool(
      messages,
      this.systemPrompt ? [Message.systemMessage(this.systemPrompt)] : null,
      this.availableTools.toParams(),
      "required"
    );

    const assistantMsg = Message.fromToolCalls(
      response.tool_calls || [],
      response.content
    );

    this.memory.addMessage(assistantMsg);

    let planCreated = false;

    if (response.tool_calls) {
      for (const toolCall of response.tool_calls) {
        if (toolCall.function.name === "planning") {
          const result = await this.executeTool(toolCall);
          console.log(
            `Executed tool ${toolCall.function.name} with result: ${result}`
          );

          // Add tool response to memory
          const toolMsg = Message.toolMessage(
            result,
            toolCall.function.name,
            toolCall.id
          );

          this.memory.addMessage(toolMsg);
          planCreated = true;
          break;
        }
      }
    }

    if (!planCreated) {
      console.warn("No plan created from initial request");
      const toolMsg = Message.assistantMessage(
        "Error: Parameter `plan_id` is required for command: create"
      );
      this.memory.addMessage(toolMsg);
    }
  }
}
