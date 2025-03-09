// src/config/index.ts
import { AppConfig, LLMSettings } from "./types";

/**
 * Configuration manager class
 */
export class Config {
  private static instance: Config;
  private config: AppConfig;

  /**
   * Get the config singleton instance
   */
  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    // Initialize with default empty config
    this.config = {
      llm: {
        default: {
          model: "gpt-4",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "",
          maxTokens: 4096,
          temperature: 0.0,
          apiType: "openai",
        },
      },
    };
  }

  /**
   * Load configuration from an object
   */
  loadConfig(config: Partial<AppConfig>): void {
    this.config = this.mergeConfigs(this.config, config);
  }

  /**
   * Get LLM configuration
   */
  getLLMConfig(name: string = "default"): LLMSettings {
    return this.config.llm[name] || this.config.llm.default;
  }

  /**
   * Get the full application configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Merge configurations
   */
  private mergeConfigs(
    base: AppConfig,
    override: Partial<AppConfig>
  ): AppConfig {
    const result = { ...base };

    if (override.llm) {
      result.llm = { ...base.llm };

      for (const [key, value] of Object.entries(override.llm)) {
        if (key === "default") {
          result.llm.default = { ...base.llm.default, ...value };
        } else {
          result.llm[key] = { ...base.llm.default, ...value };
        }
      }
    }

    return result;
  }
}

export * from "./types";
