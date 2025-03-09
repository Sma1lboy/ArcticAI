# ArcticAI

A TypeScript framework for building flexible multi-agent systems using modern LLMs (Large Language Models).

## Features

- **Modular Agent Framework**: Create specialized agents for different tasks
- **Multi-Agent Orchestration**: Manage flows with multiple cooperative agents
- **Extensible Tool System**: Build and use custom tools for agent interactions
- **Planning and Execution**: Manage complex task decomposition and execution
- **TypeScript/JavaScript Support**: Built with TypeScript for static typing and JavaScript for flexibility

## Installation

```bash
npm install ts-multi-agents
```

## Quick Start

### Basic Agent Example

```typescript
import {
  ToolCallAgent,
  ToolCollection,
  Terminate,
  CreateChatCompletion,
} from "ts-multi-agents";

// Configure your agent
const agent = new ToolCallAgent("SimpleAssistant", {
  description: "A simple assistant that can respond to queries",
  systemPrompt:
    "You are a helpful assistant that answers user questions accurately and concisely.",
  availableTools: new ToolCollection(
    new CreateChatCompletion(),
    new Terminate()
  ),
});

// Run the agent
const result = await agent.run("Tell me about multi-agent systems");
console.log(result);
```

### Planning Agent Example

```typescript
import {
  PlanningAgent,
  ToolCollection,
  PlanningTool,
  Terminate,
} from "ts-multi-agents";

// Create a planning agent
const planningAgent = new PlanningAgent({
  name: "Planner",
  description: "Creates and manages plans for complex tasks",
  availableTools: new ToolCollection(new PlanningTool(), new Terminate()),
});

// Run with a complex task
const result = await planningAgent.run(
  "Plan a three-day trip to New York City"
);
console.log(result);
```

### Multi-Agent System

```typescript
import {
  PlanningAgent,
  ToolCallAgent,
  FlowFactory,
  FlowType,
} from "ts-multi-agents";

// Create specialized agents
const planningAgent = new PlanningAgent({ name: "Planner" /* config */ });
const researchAgent = new ToolCallAgent("Researcher", {
  /* config */
});
const creativeAgent = new ToolCallAgent("Creator", {
  /* config */
});

// Create a multi-agent flow
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

// Execute the flow
const result = await flow.execute(
  "Create a detailed report on renewable energy technologies"
);
console.log(result);
```

## Core Components

### Agents

- **BaseAgent**: Abstract foundation for all agents
- **ReActAgent**: Implements the ReAct (Reasoning and Acting) paradigm
- **ToolCallAgent**: Specialized agent for tool/function calling
