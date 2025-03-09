// src/tool/tool-collection.ts
import { BaseTool, ToolFailure, ToolResult, ToolError } from "./base";

/**
 * A collection of tools that can be used by agents
 */
export class ToolCollection {
  tools: BaseTool[];
  toolMap: Map<string, BaseTool>;

  constructor(...tools: BaseTool[]) {
    this.tools = tools;
    this.toolMap = new Map(tools.map((tool) => [tool.name, tool]));
  }

  /**
   * Get an iterator over the tools
   */
  [Symbol.iterator]() {
    return this.tools[Symbol.iterator]();
  }

  /**
   * Convert tools to parameters for LLM function calling
   */
  toParams(): Record<string, any>[] {
    return this.tools.map((tool) => tool.toParam());
  }

  /**
   * Execute a specific tool by name
   */
  async execute(
    name: string,
    toolInput: Record<string, any> = {}
  ): Promise<ToolResult> {
    const tool = this.toolMap.get(name);
    if (!tool) {
      return new ToolFailure(null, `Tool ${name} is invalid`);
    }

    try {
      const result = await tool.execute(toolInput);
      return result;
    } catch (error) {
      if (error instanceof ToolError) {
        return new ToolFailure(null, error.message);
      }
      return new ToolFailure(null, `Unknown error: ${error}`);
    }
  }

  /**
   * Execute all tools in the collection sequentially
   */
  async executeAll(): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const tool of this.tools) {
      try {
        const result = await tool.execute();
        results.push(result);
      } catch (error) {
        if (error instanceof ToolError) {
          results.push(new ToolFailure(null, error.message));
        } else {
          results.push(new ToolFailure(null, `Unknown error: ${error}`));
        }
      }
    }
    return results;
  }

  /**
   * Get a tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.toolMap.get(name);
  }

  /**
   * Add a tool to the collection
   */
  addTool(tool: BaseTool): this {
    this.tools.push(tool);
    this.toolMap.set(tool.name, tool);
    return this;
  }

  /**
   * Add multiple tools to the collection
   */
  addTools(...tools: BaseTool[]): this {
    for (const tool of tools) {
      this.addTool(tool);
    }
    return this;
  }
}
