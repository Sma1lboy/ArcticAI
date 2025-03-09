// src/tool/create-completion.ts
import { BaseTool, ToolResult } from "./base";

/**
 * A tool for creating structured chat completions
 */
export class CreateChatCompletion extends BaseTool {
  responseType: any;
  required: string[];

  constructor(responseType: any = String) {
    super(
      "create_chat_completion",
      "Creates a structured completion with specified output formatting.",
      {
        type: "object",
        properties: {
          response: {
            type: "string",
            description:
              "The response text that should be delivered to the user.",
          },
        },
        required: ["response"],
      }
    );

    this.responseType = responseType;
    this.required = ["response"];
    this.parameters = this._buildParameters();
  }

  /**
   * Build parameters schema based on response type
   */
  private _buildParameters(): Record<string, any> {
    if (this.responseType === String) {
      return {
        type: "object",
        properties: {
          response: {
            type: "string",
            description:
              "The response text that should be delivered to the user.",
          },
        },
        required: this.required,
      };
    }

    // Handle more complex types (like objects with specific schemas)
    // This would need expansion for full type support

    return {
      type: "object",
      properties: {
        response: {
          type: "string",
          description: `Response of type ${this.responseType.name || "any"}`,
        },
      },
      required: this.required,
    };
  }

  /**
   * Execute the chat completion
   */
  async execute(args: Record<string, any> = {}): Promise<ToolResult> {
    // Handle case when required is a list
    if (Array.isArray(this.required) && this.required.length > 0) {
      if (this.required.length === 1) {
        const requiredField = this.required[0];
        const result = args[requiredField] || "";
        return new ToolResult(result);
      } else {
        // Return multiple fields as an object
        const resultObj: Record<string, any> = {};
        for (const field of this.required) {
          resultObj[field] = args[field] || "";
        }
        return new ToolResult(resultObj);
      }
    } else {
      const requiredField = "response";
      const result = args[requiredField] || "";
      return new ToolResult(result);
    }
  }
}
