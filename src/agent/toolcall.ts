// src/agent/toolcall.ts
import { ReActAgent } from "./react";
import { AgentState, Message, ToolCall } from "../schema";
import { LLMConfig } from "../llm/types";
import { ToolCollection } from "../tool/tool-collection";
import { Terminate } from "../tool/terminate";
import { ToolError } from "../tool/base";

const SYSTEM_PROMPT = "You are an agent that can execute tool calls";
const NEXT_STEP_PROMPT =
  "If you want to stop interaction, use `terminate` tool/function call.";

const TOOL_CALL_REQUIRED = "Tool calls required but none provided";

/**
 * Agent that specializes in executing tool/function calls
 */
export class ToolCallAgent extends ReActAgent {
  // Tool-related properties
  availableTools: ToolCollection;
  toolChoices: "none" | "auto" | "required";
  specialToolNames: string[];
  toolCalls: ToolCall[];

  /**
   * Create a new ToolCallAgent
   */
  constructor(
    name: string = "toolcall",
    config: {
      description?: string;
      systemPrompt?: string;
      nextStepPrompt?: string;
      llmConfig?: LLMConfig;
      maxSteps?: number;
      toolChoices?: "none" | "auto" | "required";
      specialToolNames?: string[];
      availableTools?: ToolCollection;
    } = {}
  ) {
    super(name, {
      description:
        config.description || "an agent that can execute tool calls.",
      systemPrompt: config.systemPrompt || SYSTEM_PROMPT,
      nextStepPrompt: config.nextStepPrompt || NEXT_STEP_PROMPT,
      llmConfig: config.llmConfig,
      maxSteps: config.maxSteps || 30,
    });

    // Initialize tools
    this.toolChoices = config.toolChoices || "auto";
    this.specialToolNames = config.specialToolNames || [new Terminate().name];

    // Create default tool collection if none provided
    // FIXME(): CreateCHatCompletion
    // this.availableTools =
    //   config.availableTools ||
    //   new ToolCollection(new CreateChatCompletion(), new Terminate());

    this.toolCalls = [];
  }

  /**
   * Process current state and decide next actions using tools
   */
  async think(): Promise<boolean> {
    if (this.nextStepPrompt) {
      const userMsg = Message.userMessage(this.nextStepPrompt);
      this.messages.push(userMsg);
    }

    try {
      // Get response with tool options
      const response = await this.llm.askTool(
        this.messages,
        this.systemPrompt ? [Message.systemMessage(this.systemPrompt)] : null,
        this.availableTools.toParams(),
        this.toolChoices
      );

      this.toolCalls = response.tool_calls || [];

      // Log response info
      console.log(`✨ ${this.name}'s thoughts: ${response.content}`);
      console.log(
        `🛠️ ${this.name} selected ${this.toolCalls.length || 0} tools to use`
      );

      if (this.toolCalls.length > 0) {
        console.log(
          `🧰 Tools being prepared: ${this.toolCalls
            .map((call) => call.function.name)
            .join(", ")}`
        );
      }

      // Handle different tool_choices modes
      if (this.toolChoices === "none") {
        if (this.toolCalls.length > 0) {
          console.warn(
            `🤔 Hmm, ${this.name} tried to use tools when they weren't available!`
          );
        }

        if (response.content) {
          this.memory.addMessage(Message.assistantMessage(response.content));
          return true;
        }

        return false;
      }

      // Create and add assistant message
      const assistantMsg =
        this.toolCalls.length > 0
          ? Message.fromToolCalls(this.toolCalls, response.content)
          : Message.assistantMessage(response.content);

      this.memory.addMessage(assistantMsg);

      if (this.toolChoices === "required" && this.toolCalls.length === 0) {
        return true; // Will be handled in act()
      }

      // For 'auto' mode, continue with content if no commands but content exists
      if (this.toolChoices === "auto" && this.toolCalls.length === 0) {
        return !!response.content;
      }

      return this.toolCalls.length > 0;
    } catch (error) {
      console.error(
        `🚨 Oops! The ${this.name}'s thinking process hit a snag: ${error}`
      );
      this.memory.addMessage(
        Message.assistantMessage(
          `Error encountered while processing: ${
            error.message || String(error)
          }`
        )
      );
      return false;
    }
  }

  /**
   * Execute tool calls and handle their results
   */
  async act(): Promise<string> {
    if (this.toolCalls.length === 0) {
      if (this.toolChoices === "required") {
        throw new Error(TOOL_CALL_REQUIRED);
      }

      // Return last message content if no tool calls
      return (
        this.messages[this.messages.length - 1].content ||
        "No content or commands to execute"
      );
    }

    const results: string[] = [];
    for (const command of this.toolCalls) {
      const result = await this.executeTool(command);
      console.log(
        `🎯 Tool '${command.function.name}' completed its mission! Result: ${result}`
      );

      // Add tool response to memory
      const toolMsg = Message.toolMessage(
        result,
        command.function.name,
        command.id
      );
      this.memory.addMessage(toolMsg);
      results.push(result);
    }

    return results.join("\n\n");
  }

  /**
   * Execute a single tool call with robust error handling
   */
  /**
   * Handle special tool execution and state changes
   */
  async handleSpecialTool(name: string, result: any): Promise<void> {
    if (!this.isSpecialTool(name)) {
      return;
    }

    if (this.shouldFinishExecution(name, result)) {
      // Set agent state to finished
      console.log(`🏁 Special tool '${name}' has completed the task!`);
      this.state = AgentState.FINISHED;
    }
  }

  /**
   * Determine if tool execution should finish the agent
   */
  protected shouldFinishExecution(name: string, result: any): boolean {
    return true;
  }

  /**
   * Check if tool name is in special tools list
   */
  protected isSpecialTool(name: string): boolean {
    return this.specialToolNames
      .map((n) => n.toLowerCase())
      .includes(name.toLowerCase());
  }

  /**
   * Execute a single tool call with robust error handling
   */
  async executeTool(command: ToolCall): Promise<string> {
    if (!command || !command.function || !command.function.name) {
      return "Error: Invalid command format";
    }

    const name = command.function.name;
    const availableTool = this.availableTools.getTool(name);

    if (!availableTool) {
      return `Error: Unknown tool '${name}'`;
    }

    try {
      // Parse arguments
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(command.function.arguments || "{}");
      } catch (e) {
        return `Error parsing arguments for ${name}: Invalid JSON format`;
      }

      // Execute the tool
      console.log(`🔧 Activating tool: '${name}'...`);
      const result = await this.availableTools.execute(name, args);

      // Format result for display
      const observation = result.output
        ? `Observed output of cmd \`${name}\` executed:\n${String(
            result.output
          )}`
        : `Cmd \`${name}\` completed with no output`;

      // Handle special tools like `finish`
      await this.handleSpecialTool(name, result);

      return observation;
    } catch (error) {
      if (error instanceof ToolError) {
        console.error(
          `⚠️ Tool '${name}' encountered a problem: ${error.message}`
        );
        return `Error: ${error.message}`;
      } else {
        const errorMsg = `⚠️ Tool '${name}' encountered a problem: ${
          error.message || String(error)
        }`;
        console.error(errorMsg);
        return `Error: ${errorMsg}`;
      }
    }
  }
}
