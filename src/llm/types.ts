// src/llm/types.ts

import { ToolCall } from "../schema/message";

/**
 * LLM model settings configuration
 */
export interface LLMSettings {
  model: string;
  baseUrl: string;
  apiKey: string;
  maxTokens: number;
  temperature: number;
  apiType: "openai" | "azure";
  apiVersion?: string;
}

/**
 * LLM configuration by name
 */
export interface LLMConfig {
  default: LLMSettings;
  [key: string]: LLMSettings;
}

/**
 * Response from a chat completion request
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Tool choice options for LLM tool calls
 */
export type ToolChoice = "none" | "auto" | "required";

/**
 * Message in a specific format expected by the LLM API
 */
export interface LLMMessage {
  role: string;
  content: string | null;
  tool_calls?: ToolCall[];
  name?: string;
  tool_call_id?: string;
}
