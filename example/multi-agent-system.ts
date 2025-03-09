// examples/multi-agent-system.ts
import {
  PlanningAgent,
  ToolCallAgent,
  ToolCollection,
  PlanningTool,
  Terminate,
  CreateChatCompletion,
  FlowFactory,
  FlowType,
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
      temperature: 0.0,
      apiType: "openai",
    },
    creative: {
      model: "gpt-4",
      baseUrl: "https://api.openai.com/v1",
      apiKey: process.env.OPENAI_API_KEY || "",
      maxTokens: 4096,
      temperature: 0.8, // Higher temperature for creative tasks
      apiType: "openai",
    },
  },
});

async function main() {
  // Create a collection of specialized agents

  // Planning Agent - responsible for overall planning
  const planningAgent = new PlanningAgent({
    name: "Planner",
    description: "Creates and manages plans for complex tasks",
    maxSteps: 10,
    availableTools: new ToolCollection(new PlanningTool(), new Terminate()),
  });

  // Research Agent - specialized in gathering information
  const researchAgent = new ToolCallAgent("Researcher", {
    description: "Specializes in information gathering and research",
    systemPrompt:
      "You are a research specialist. Your role is to gather accurate and comprehensive information.",
    maxSteps: 10,
    availableTools: new ToolCollection(
      new CreateChatCompletion(),
      new Terminate()
    ),
  });

  // Creative Agent - specialized in creative writing
  const creativeAgent = new ToolCallAgent("Creator", {
    description: "Specializes in creative content generation",
    systemPrompt:
      "You are a creative specialist. Your role is to generate engaging, original content.",
    maxSteps: 10,
    availableTools: new ToolCollection(
      new CreateChatCompletion(),
      new Terminate()
    ),
  });

  // Create a multi-agent flow with these agents
  const flow = FlowFactory.createFlow(
    FlowType.PLANNING,
    new Map([
      ["planner", planningAgent],
      ["researcher", researchAgent],
      ["creator", creativeAgent],
    ]),
    {
      primaryAgentKey: "planner",
      executors: ["researcher", "creator"],
    }
  );

  // Run the multi-agent system on a complex task
  try {
    console.log("Starting multi-agent task execution...");
    const result = await flow.execute(
      "Create a short blog post about the future of AI, including relevant facts about current AI technology and ending with an engaging conclusion."
    );

    console.log("\n\n====== FINAL RESULT ======\n");
    console.log(result);
  } catch (error) {
    console.error("Execution failed:", error);
  }
}

// Run the example
main().catch(console.error);
