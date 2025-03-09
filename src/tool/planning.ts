// src/tool/planning.ts
import { BaseTool, ToolError, ToolResult } from "./base";

const PLANNING_TOOL_DESCRIPTION = `
A planning tool that allows the agent to create and manage plans for solving complex tasks.
The tool provides functionality for creating plans, updating plan steps, and tracking progress.
`;

type StepStatus = "not_started" | "in_progress" | "completed" | "blocked";

interface Plan {
  plan_id: string;
  title: string;
  steps: string[];
  step_statuses: StepStatus[];
  step_notes: string[];
}

type PlanningCommand =
  | "create"
  | "update"
  | "list"
  | "get"
  | "set_active"
  | "mark_step"
  | "delete";

/**
 * A tool for creating and managing plans
 */
export class PlanningTool extends BaseTool {
  plans: Map<string, Plan>;
  private currentPlanId: string | null;

  constructor() {
    super("planning", PLANNING_TOOL_DESCRIPTION, {
      type: "object",
      properties: {
        command: {
          description:
            "The command to execute. Available commands: create, update, list, get, set_active, mark_step, delete.",
          enum: [
            "create",
            "update",
            "list",
            "get",
            "set_active",
            "mark_step",
            "delete",
          ],
          type: "string",
        },
        plan_id: {
          description:
            "Unique identifier for the plan. Required for create, update, set_active, and delete commands. Optional for get and mark_step (uses active plan if not specified).",
          type: "string",
        },
        title: {
          description:
            "Title for the plan. Required for create command, optional for update command.",
          type: "string",
        },
        steps: {
          description:
            "List of plan steps. Required for create command, optional for update command.",
          type: "array",
          items: { type: "string" },
        },
        step_index: {
          description:
            "Index of the step to update (0-based). Required for mark_step command.",
          type: "integer",
        },
        step_status: {
          description: "Status to set for a step. Used with mark_step command.",
          enum: ["not_started", "in_progress", "completed", "blocked"],
          type: "string",
        },
        step_notes: {
          description:
            "Additional notes for a step. Optional for mark_step command.",
          type: "string",
        },
      },
      required: ["command"],
      additionalProperties: false,
    });

    this.plans = new Map();
    this.currentPlanId = null;
  }

  /**
   * Execute the planning tool with the given command and parameters
   */
  async execute({
    command,
    plan_id = null,
    title = null,
    steps = null,
    step_index = null,
    step_status = null,
    step_notes = null,
  }: {
    command: PlanningCommand;
    plan_id?: string | null;
    title?: string | null;
    steps?: string[] | null;
    step_index?: number | null;
    step_status?: StepStatus | null;
    step_notes?: string | null;
  }): Promise<ToolResult> {
    switch (command) {
      case "create":
        return this.createPlan(plan_id, title, steps);
      case "update":
        return this.updatePlan(plan_id, title, steps);
      case "list":
        return this.listPlans();
      case "get":
        return this.getPlan(plan_id);
      case "set_active":
        return this.setActivePlan(plan_id);
      case "mark_step":
        return this.markStep(plan_id, step_index, step_status, step_notes);
      case "delete":
        return this.deletePlan(plan_id);
      default:
        throw new ToolError(
          `Unrecognized command: ${command}. Allowed commands are: create, update, list, get, set_active, mark_step, delete`
        );
    }
  }

  /**
   * Create a new plan with the given ID, title, and steps
   */
  private createPlan(
    planId: string | null,
    title: string | null,
    steps: string[] | null
  ): ToolResult {
    if (!planId) {
      throw new ToolError(
        "Parameter `plan_id` is required for command: create"
      );
    }

    if (this.plans.has(planId)) {
      throw new ToolError(
        `A plan with ID '${planId}' already exists. Use 'update' to modify existing plans.`
      );
    }

    if (!title) {
      throw new ToolError("Parameter `title` is required for command: create");
    }

    if (
      !steps ||
      !Array.isArray(steps) ||
      !steps.every((step) => typeof step === "string")
    ) {
      throw new ToolError(
        "Parameter `steps` must be a non-empty list of strings for command: create"
      );
    }

    // Create a new plan with initialized step statuses
    const plan: Plan = {
      plan_id: planId,
      title,
      steps,
      step_statuses: Array(steps.length).fill("not_started"),
      step_notes: Array(steps.length).fill(""),
    };

    this.plans.set(planId, plan);
    this.currentPlanId = planId; // Set as active plan

    return new ToolResult(
      `Plan created successfully with ID: ${planId}\n\n${this.formatPlan(plan)}`
    );
  }

  /**
   * Update an existing plan with new title or steps
   */
  private updatePlan(
    planId: string | null,
    title: string | null,
    steps: string[] | null
  ): ToolResult {
    if (!planId) {
      throw new ToolError(
        "Parameter `plan_id` is required for command: update"
      );
    }

    if (!this.plans.has(planId)) {
      throw new ToolError(`No plan found with ID: ${planId}`);
    }

    const plan = this.plans.get(planId)!;

    if (title) {
      plan.title = title;
    }

    if (steps) {
      if (
        !Array.isArray(steps) ||
        !steps.every((step) => typeof step === "string")
      ) {
        throw new ToolError(
          "Parameter `steps` must be a list of strings for command: update"
        );
      }

      // Preserve existing step statuses for unchanged steps
      const oldSteps = plan.steps;
      const oldStatuses = plan.step_statuses;
      const oldNotes = plan.step_notes;

      // Create new step statuses and notes
      const newStatuses: StepStatus[] = [];
      const newNotes: string[] = [];

      for (let i = 0; i < steps.length; i++) {
        // If the step exists at the same position in old steps, preserve status and notes
        if (i < oldSteps.length && steps[i] === oldSteps[i]) {
          newStatuses.push(oldStatuses[i]);
          newNotes.push(oldNotes[i]);
        } else {
          newStatuses.push("not_started");
          newNotes.push("");
        }
      }

      plan.steps = steps;
      plan.step_statuses = newStatuses;
      plan.step_notes = newNotes;
    }

    return new ToolResult(
      `Plan updated successfully: ${planId}\n\n${this.formatPlan(plan)}`
    );
  }

  /**
   * List all available plans
   */
  private listPlans(): ToolResult {
    if (this.plans.size === 0) {
      return new ToolResult(
        "No plans available. Create a plan with the 'create' command."
      );
    }

    let output = "Available plans:\n";
    for (const [planId, plan] of this.plans.entries()) {
      const currentMarker = planId === this.currentPlanId ? " (active)" : "";
      const completed = plan.step_statuses.filter(
        (status) => status === "completed"
      ).length;
      const total = plan.steps.length;
      const progress = `${completed}/${total} steps completed`;
      output += `• ${planId}${currentMarker}: ${plan.title} - ${progress}\n`;
    }

    return new ToolResult(output);
  }

  /**
   * Get details of a specific plan
   */
  private getPlan(planId: string | null): ToolResult {
    if (!planId) {
      // If no plan_id is provided, use the current active plan
      if (!this.currentPlanId) {
        throw new ToolError(
          "No active plan. Please specify a plan_id or set an active plan."
        );
      }
      planId = this.currentPlanId;
    }

    if (!this.plans.has(planId)) {
      throw new ToolError(`No plan found with ID: ${planId}`);
    }

    const plan = this.plans.get(planId)!;
    return new ToolResult(this.formatPlan(plan));
  }

  /**
   * Set a plan as the active plan
   */
  private setActivePlan(planId: string | null): ToolResult {
    if (!planId) {
      throw new ToolError(
        "Parameter `plan_id` is required for command: set_active"
      );
    }

    if (!this.plans.has(planId)) {
      throw new ToolError(`No plan found with ID: ${planId}`);
    }

    this.currentPlanId = planId;
    return new ToolResult(
      `Plan '${planId}' is now the active plan.\n\n${this.formatPlan(
        this.plans.get(planId)!
      )}`
    );
  }

  /**
   * Mark a step with a specific status and optional notes
   */
  private markStep(
    planId: string | null,
    stepIndex: number | null,
    stepStatus: StepStatus | null,
    stepNotes: string | null
  ): ToolResult {
    if (!planId) {
      // If no plan_id is provided, use the current active plan
      if (!this.currentPlanId) {
        throw new ToolError(
          "No active plan. Please specify a plan_id or set an active plan."
        );
      }
      planId = this.currentPlanId;
    }

    if (!this.plans.has(planId)) {
      throw new ToolError(`No plan found with ID: ${planId}`);
    }

    if (stepIndex === null) {
      throw new ToolError(
        "Parameter `step_index` is required for command: mark_step"
      );
    }

    const plan = this.plans.get(planId)!;

    if (stepIndex < 0 || stepIndex >= plan.steps.length) {
      throw new ToolError(
        `Invalid step_index: ${stepIndex}. Valid indices range from 0 to ${
          plan.steps.length - 1
        }.`
      );
    }

    if (
      stepStatus &&
      !["not_started", "in_progress", "completed", "blocked"].includes(
        stepStatus
      )
    ) {
      throw new ToolError(
        `Invalid step_status: ${stepStatus}. Valid statuses are: not_started, in_progress, completed, blocked`
      );
    }

    if (stepStatus) {
      plan.step_statuses[stepIndex] = stepStatus;
    }

    if (stepNotes) {
      plan.step_notes[stepIndex] = stepNotes;
    }

    return new ToolResult(
      `Step ${stepIndex} updated in plan '${planId}'.\n\n${this.formatPlan(
        plan
      )}`
    );
  }

  /**
   * Delete a plan
   */
  private deletePlan(planId: string | null): ToolResult {
    if (!planId) {
      throw new ToolError(
        "Parameter `plan_id` is required for command: delete"
      );
    }

    if (!this.plans.has(planId)) {
      throw new ToolError(`No plan found with ID: ${planId}`);
    }

    this.plans.delete(planId);

    // If the deleted plan was the active plan, clear the active plan
    if (this.currentPlanId === planId) {
      this.currentPlanId = null;
    }

    return new ToolResult(`Plan '${planId}' has been deleted.`);
  }

  /**
   * Format a plan for display
   */
  private formatPlan(plan: Plan): string {
    let output = `Plan: ${plan.title} (ID: ${plan.plan_id})\n`;
    output += "=".repeat(output.length) + "\n\n";

    // Calculate progress statistics
    const totalSteps = plan.steps.length;
    const completed = plan.step_statuses.filter(
      (status) => status === "completed"
    ).length;
    const inProgress = plan.step_statuses.filter(
      (status) => status === "in_progress"
    ).length;
    const blocked = plan.step_statuses.filter(
      (status) => status === "blocked"
    ).length;
    const notStarted = plan.step_statuses.filter(
      (status) => status === "not_started"
    ).length;

    output += `Progress: ${completed}/${totalSteps} steps completed `;

    if (totalSteps > 0) {
      const percentage = (completed / totalSteps) * 100;
      output += `(${percentage.toFixed(1)}%)\n`;
    } else {
      output += "(0%)\n";
    }

    output += `Status: ${completed} completed, ${inProgress} in progress, ${blocked} blocked, ${notStarted} not started\n\n`;
    output += "Steps:\n";

    // Add each step with its status and notes
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const status = plan.step_statuses[i];
      const notes = plan.step_notes[i];

      const statusSymbol =
        {
          not_started: "[ ]",
          in_progress: "[→]",
          completed: "[✓]",
          blocked: "[!]",
        }[status] || "[ ]";

      output += `${i}. ${statusSymbol} ${step}\n`;
      if (notes) {
        output += `   Notes: ${notes}\n`;
      }
    }

    return output;
  }
}
