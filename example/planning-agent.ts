// examples/planning-agent.ts
import {
  PlanningAgent,
  ToolCollection,
  PlanningTool,
  Terminate,
  CreateChatCompletion,
  Config,
} from "../src";

// Configure the application
const config = Config.getInstance();
config.loadConfig({
  llm: {
    default: {
      model: "gpt-4",
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
      maxTokens: 4096,
      temperature: 0.2, // Lower temperature for planning
      apiType: "openai",
    },
  },
});

async function main() {
  // Create a planning agent with necessary tools
  const agent = new PlanningAgent({
    name: "PlanningAssistant",
    description:
      "An assistant that creates and follows plans to complete tasks",
    maxSteps: 15,
    availableTools: new ToolCollection(
      new PlanningTool(),
      new CreateChatCompletion(),
      new Terminate()
    ),
  });

  // Run the agent with a task that requires planning
  try {
    const result = await agent.run(
      "Plan a three-day trip to New York City for a family with children"
    );
    console.log("Execution result:");
    console.log(result);
  } catch (error) {
    console.error("Execution failed:", error);
  }
}

// Run the example
main().catch(console.error);
