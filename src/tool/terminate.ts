// src/tool/terminate.ts
import { BaseTool, ToolResult } from "./base";

const TERMINATE_DESCRIPTION =
  "Terminate the interaction when the request is met OR if the assistant cannot proceed further with the task.";

/**
 * A tool for terminating agent execution
 */
export class Terminate extends BaseTool {
  constructor() {
    super("terminate", TERMINATE_DESCRIPTION, {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "The finish status of the interaction.",
          enum: ["success", "failure"],
        },
      },
      required: ["status"],
    });
  }

  /**
   * Execute the terminate command
   */
  async execute({ status }: { status: string }): Promise<ToolResult> {
    return new ToolResult(
      `The interaction has been completed with status: ${status}`
    );
  }
}
