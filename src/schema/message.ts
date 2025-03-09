// src/schema/message.ts
/**
 * Represents a function/tool call in a message.
 */
export interface Function {
  name: string;
  arguments: string;
}

/**
 * Represents a tool call in a message.
 */
export interface ToolCall {
  id: string;
  type: string;
  function: Function;
}

/**
 * Represents a message role in a conversation.
 */
export type MessageRole = "system" | "user" | "assistant" | "tool";

/**
 * Represents a message in a conversation.
 */
export class Message {
  role: MessageRole;
  content: string | null;
  tool_calls?: ToolCall[];
  name?: string;
  tool_call_id?: string;

  constructor(
    role: MessageRole,
    content: string | null = null,
    tool_calls: ToolCall[] | null = null,
    name: string | null = null,
    tool_call_id: string | null = null
  ) {
    this.role = role;
    this.content = content;
    if (tool_calls) this.tool_calls = tool_calls;
    if (name) this.name = name;
    if (tool_call_id) this.tool_call_id = tool_call_id;
  }

  /**
   * Convert message to a plain object
   */
  toDict(): Record<string, any> {
    const message: Record<string, any> = { role: this.role };

    if (this.content !== null) {
      message.content = this.content;
    }

    if (this.tool_calls) {
      message.tool_calls = this.tool_calls;
    }

    if (this.name) {
      message.name = this.name;
    }

    if (this.tool_call_id) {
      message.tool_call_id = this.tool_call_id;
    }

    return message;
  }

  /**
   * Create a user message
   */
  static userMessage(content: string): Message {
    return new Message("user", content);
  }

  /**
   * Create a system message
   */
  static systemMessage(content: string): Message {
    return new Message("system", content);
  }

  /**
   * Create an assistant message
   */
  static assistantMessage(content: string | null = null): Message {
    return new Message("assistant", content);
  }

  /**
   * Create a tool message
   */
  static toolMessage(
    content: string,
    name: string,
    tool_call_id: string
  ): Message {
    return new Message("tool", content, null, name, tool_call_id);
  }

  /**
   * Create an assistant message with tool calls
   */
  static fromToolCalls(tool_calls: ToolCall[], content: string = ""): Message {
    return new Message("assistant", content, tool_calls);
  }
}
