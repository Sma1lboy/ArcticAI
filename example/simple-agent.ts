// examples/simple-agent.ts
import {
  ToolCallAgent,
  ToolCollection,
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
      temperature: 0.7,
      apiType: "openai",
    },
  },
});

async function main() {
  // Create a simple agent with basic tools
  const agent = new ToolCallAgent("SimpleAssistant", {
    description: "A simple assistant that can respond to queries",
    systemPrompt:
      "You are a helpful assistant that answers user questions accurately and concisely.",
    maxSteps: 5,
    availableTools: new ToolCollection(
      new CreateChatCompletion(),
      new Terminate()
    ),
  });

  // Run the agent with a prompt
  try {
    const result = await agent.run(
      "Tell me about the benefits of multi-agent systems in AI"
    );
    console.log("Execution result:");
    console.log(result);
  } catch (error) {
    console.error("Execution failed:", error);
  }
}

// Run the example
main().catch(console.error);
