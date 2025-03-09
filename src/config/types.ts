// src/config/types.ts
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
 * Application configuration
 */
export interface AppConfig {
  llm: {
    default: LLMSettings;
    [key: string]: LLMSettings;
  };
}
