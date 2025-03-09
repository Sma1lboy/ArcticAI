#!/usr/bin/env node
// src/cli.ts
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { Config } from "./config";
import { FlowLoader, FlowConfig } from "./utils/flow-loader";
import { FlowType } from "./flow/base";
import { logger, LogLevel } from "./utils/logger";

// Load environment variables (assume dotenv is used)
try {
  require("dotenv").config();
} catch (e) {
  console.warn("dotenv not found, skipping environment variable loading");
}

// Set logging level based on environment variable
const logLevel = process.env.LOG_LEVEL || "INFO";
const logLevelMap: Record<string, LogLevel> = {
  DEBUG: LogLevel.DEBUG,
  INFO: LogLevel.INFO,
  WARN: LogLevel.WARN,
  ERROR: LogLevel.ERROR,
  NONE: LogLevel.NONE,
};
logger.setLevel(logLevelMap[logLevel] || LogLevel.INFO);

// Configure LLM with API key from environment
const config = Config.getInstance();
config.loadConfig({
  llm: {
    default: {
      model: process.env.LLM_MODEL || "gpt-4",
      baseUrl: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || "4096", 10),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
      apiType: (process.env.LLM_API_TYPE || "openai") as "openai" | "azure",
      apiVersion: process.env.AZURE_API_VERSION,
    },
  },
});

// Default flow configuration
const defaultConfig: FlowConfig = {
  type: FlowType.PLANNING,
  agents: {
    planner: {
      type: "planning",
      description: "Plans and coordinates the execution of tasks",
      maxSteps: 15,
      tools: ["planning", "terminate"],
    },
    executor: {
      type: "toolcall",
      description: "Executes specific tasks from the plan",
      maxSteps: 10,
      tools: ["chat", "terminate"],
    },
  },
  primaryAgent: "planner",
  executors: ["executor"],
};

/**
 * Main CLI function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const configFile = args
    .find((arg) => arg.startsWith("--config="))
    ?.split("=")[1];
  const prompt = args.find((arg) => arg.startsWith("--prompt="))?.split("=")[1];

  // Load config file if provided
  let flowConfig = defaultConfig;
  if (configFile) {
    try {
      const configPath = path.resolve(process.cwd(), configFile);
      const configContent = fs.readFileSync(configPath, "utf8");
      flowConfig = JSON.parse(configContent);
    } catch (error) {
      logger.error(`Failed to load config file: ${error}`);
      process.exit(1);
    }
  }

  // Create flow from config
  const flow = FlowLoader.createFlowFromConfig(flowConfig);

  // If prompt was provided as an argument, run directly
  if (prompt) {
    logger.info(`Running flow with prompt: ${prompt}`);
    try {
      const result = await flow.execute(prompt);
      console.log("\n===== RESULT =====\n");
      console.log(result);
    } catch (error) {
      logger.error(`Execution failed: ${error}`);
    }
    return;
  }

  // Interactive mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("TS-Multi-Agents CLI");
  console.log('Type your prompt or "exit" to quit');

  const askQuestion = () => {
    rl.question("\n> ", async (input) => {
      if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        rl.close();
        return;
      }

      try {
        logger.info("Executing flow...");
        const startTime = Date.now();
        const result = await flow.execute(input);
        const executionTime = (Date.now() - startTime) / 1000;

        console.log("\n===== RESULT =====\n");
        console.log(result);
        logger.info(
          `Execution completed in ${executionTime.toFixed(2)} seconds`
        );
      } catch (error) {
        logger.error(`Execution failed: ${error}`);
      }

      askQuestion();
    });
  };

  askQuestion();

  rl.on("close", () => {
    console.log("\nGoodbye!");
    process.exit(0);
  });
}

// Run the CLI
main().catch((error) => {
  logger.error(`Unhandled error: ${error}`);
  process.exit(1);
});
