// src/tool/base.ts
/**
 * Represents a tool execution error
 */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

/**
 * Represents the result of a tool execution
 */
export class ToolResult {
  output: any;
  error: string | null;
  system: string | null;

  constructor(
    output: any = null,
    error: string | null = null,
    system: string | null = null
  ) {
    this.output = output;
    this.error = error;
    this.system = system;
  }

  /**
   * Checks if the result contains any information
   */
  hasContent(): boolean {
    return this.output !== null || this.error !== null || this.system !== null;
  }

  /**
   * Combines two tool results
   */
  combine(other: ToolResult): ToolResult {
    const combineFields = (
      field: string | null,
      otherField: string | null,
      concatenate: boolean = true
    ): string | null => {
      if (field && otherField) {
        if (concatenate) {
          return field + otherField;
        }
        throw new Error("Cannot combine tool results");
      }
      return field || otherField;
    };

    return new ToolResult(
      combineFields(this.output, other.output),
      combineFields(this.error, other.error),
      combineFields(this.system, other.system)
    );
  }

  /**
   * Convert the result to a string
   */
  toString(): string {
    return this.error ? `Error: ${this.error}` : String(this.output);
  }

  /**
   * Creates a new ToolResult with updated fields
   */
  replace(updates: Partial<ToolResult>): ToolResult {
    return new ToolResult(
      updates.output !== undefined ? updates.output : this.output,
      updates.error !== undefined ? updates.error : this.error,
      updates.system !== undefined ? updates.system : this.system
    );
  }
}

/**
 * Represents the result of a CLI command
 */
export class CLIResult extends ToolResult {}

/**
 * Represents a tool failure
 */
export class ToolFailure extends ToolResult {}

/**
 * Base abstract class for tools
 */
export abstract class BaseTool {
  name: string;
  description: string;
  parameters: Record<string, any> | null;

  constructor(
    name: string,
    description: string,
    parameters: Record<string, any> | null = null
  ) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
  }

  /**
   * Execute the tool with given parameters
   */
  async execute(...args: any[]): Promise<any> {
    throw new Error("Method not implemented");
  }

  /**
   * Convert tool to function call format
   */
  toParam(): Record<string, any> {
    return {
      type: "function",
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }
}
