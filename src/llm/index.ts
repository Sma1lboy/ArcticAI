// src/llm/index.ts
import { Message } from "../schema/message";
import {
  LLMConfig,
  LLMSettings,
  ToolChoice,
  LLMMessage,
  ChatCompletionResponse,
} from "./types";

/**
 * Client for interacting with language model APIs
 */
export class LLM {
  private static instances: Map<string, LLM> = new Map();

  model: string;
  maxTokens: number;
  temperature: number;
  apiType: "openai" | "azure";
  apiKey: string;
  apiVersion?: string;
  baseUrl: string;

  /**
   * Get or create an LLM instance by config name
   */
  static getInstance(configName: string = "default", config: LLMConfig): LLM {
    if (!this.instances.has(configName)) {
      const instance = new LLM(configName, config);
      this.instances.set(configName, instance);
    }
    return this.instances.get(configName)!;
  }

  /**
   * Create a new LLM client instance
   */
  private constructor(configName: string, config: LLMConfig) {
    const llmConfig: LLMSettings = config[configName] || config.default;

    this.model = llmConfig.model;
    this.maxTokens = llmConfig.maxTokens;
    this.temperature = llmConfig.temperature;
    this.apiType = llmConfig.apiType;
    this.apiKey = llmConfig.apiKey;
    this.apiVersion = llmConfig.apiVersion;
    this.baseUrl = llmConfig.baseUrl;
  }

  /**
   * Format messages for LLM API
   */
  static formatMessages(
    messages: (Record<string, any> | Message)[]
  ): LLMMessage[] {
    const formattedMessages: LLMMessage[] = [];

    for (const message of messages) {
      if (message instanceof Message) {
        formattedMessages.push(message.toDict() as LLMMessage);
      } else if (typeof message === "object") {
        // Validate required fields
        if (!message.role) {
          throw new Error("Message object must contain 'role' field");
        }
        if (!message.content && !message.tool_calls) {
          throw new Error(
            "Message must contain either 'content' or 'tool_calls'"
          );
        }
        formattedMessages.push(message as LLMMessage);
      } else {
        throw new TypeError(`Unsupported message type: ${typeof message}`);
      }
    }

    // Validate all messages have required fields
    for (const msg of formattedMessages) {
      if (!["system", "user", "assistant", "tool"].includes(msg.role)) {
        throw new Error(`Invalid role: ${msg.role}`);
      }
    }

    return formattedMessages;
  }

  /**
   * Ask the LLM a question and get a response without tool calling
   */
  async ask(
    messages: (Record<string, any> | Message)[],
    systemMsgs: (Record<string, any> | Message)[] | null = null,
    stream: boolean = false,
    temperature?: number
  ): Promise<string> {
    try {
      // Format system and user messages
      let formattedMessages: LLMMessage[];
      if (systemMsgs) {
        formattedMessages = [
          ...LLM.formatMessages(systemMsgs),
          ...LLM.formatMessages(messages),
        ];
      } else {
        formattedMessages = LLM.formatMessages(messages);
      }

      // Build request body
      const requestBody = {
        model: this.model,
        messages: formattedMessages,
        max_tokens: this.maxTokens,
        temperature: temperature ?? this.temperature,
        stream: stream,
      };

      // Make the API request based on API type
      const endpoint = `${this.baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiType === "openai") {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      } else if (this.apiType === "azure") {
        headers["api-key"] = this.apiKey;
        if (this.apiVersion) {
          headers["api-version"] = this.apiVersion;
        }
      }

      if (!stream) {
        // Non-streaming request
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `LLM API request failed: ${response.status} - ${errorText}`
          );
        }

        const data = (await response.json()) as ChatCompletionResponse;
        if (!data.choices || !data.choices[0].message.content) {
          throw new Error("Empty or invalid response from LLM");
        }

        return data.choices[0].message.content;
      } else {
        // Streaming implementation would go here
        // For simplicity, we'll use non-streaming in this example
        throw new Error("Streaming is not implemented in this example");
      }
    } catch (error) {
      console.error(`LLM API error: ${error}`);
      throw error;
    }
  }

  /**
   * Ask the LLM using function/tool calls
   */
  async askTool(
    messages: (Record<string, any> | Message)[],
    systemMsgs: (Record<string, any> | Message)[] | null = null,
    tools: Record<string, any>[] | null = null,
    toolChoice: ToolChoice = "auto",
    temperature?: number,
    timeout: number = 60000
  ): Promise<any> {
    try {
      // Validate tool_choice
      if (!["none", "auto", "required"].includes(toolChoice)) {
        throw new Error(`Invalid tool_choice: ${toolChoice}`);
      }

      // Format messages
      let formattedMessages: LLMMessage[];
      if (systemMsgs) {
        formattedMessages = [
          ...LLM.formatMessages(systemMsgs),
          ...LLM.formatMessages(messages),
        ];
      } else {
        formattedMessages = LLM.formatMessages(messages);
      }

      // Validate tools if provided
      if (tools) {
        for (const tool of tools) {
          if (typeof tool !== "object" || !tool.type) {
            throw new Error("Each tool must be an object with 'type' field");
          }
        }
      }

      // Build request body
      const requestBody: Record<string, any> = {
        model: this.model,
        messages: formattedMessages,
        temperature: temperature ?? this.temperature,
        max_tokens: this.maxTokens,
      };

      if (tools) {
        requestBody.tools = tools;
        requestBody.tool_choice = toolChoice;
      }

      // Set up the completion request
      const endpoint = `${this.baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiType === "openai") {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      } else if (this.apiType === "azure") {
        headers["api-key"] = this.apiKey;
        if (this.apiVersion) {
          headers["api-version"] = this.apiVersion;
        }
      }

      // Make the request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `LLM API request failed: ${response.status} - ${errorText}`
          );
        }

        const data = (await response.json()) as ChatCompletionResponse;

        // Check if response is valid
        if (!data.choices || !data.choices[0].message) {
          throw new Error("Invalid or empty response from LLM");
        }

        return data.choices[0].message;
      } catch (error) {
        if (error.name === "AbortError") {
          throw new Error(`Request timed out after ${timeout}ms`);
        }
        throw error;
      }
    } catch (error) {
      console.error(`LLM API error in ask_tool: ${error}`);
      throw error;
    }
  }
}
