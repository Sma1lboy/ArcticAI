// src/agent/base.ts
import { AgentState, Memory, Message } from "../schema";
import { LLM } from "../llm";
import { LLMConfig } from "../llm/types";

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent {
  // Core attributes
  name: string;
  description?: string;

  // Prompts
  systemPrompt?: string;
  nextStepPrompt?: string;

  // Dependencies
  llm: LLM;
  memory: Memory;
  state: AgentState;

  // Execution control
  maxSteps: number;
  currentStep: number;
  duplicateThreshold: number;

  /**
   * Create a new agent
   */
  constructor(
    name: string,
    config: {
      description?: string;
      systemPrompt?: string;
      nextStepPrompt?: string;
      llmConfig?: LLMConfig;
      memory?: Memory;
      maxSteps?: number;
      duplicateThreshold?: number;
    } = {}
  ) {
    this.name = name;
    this.description = config.description;
    this.systemPrompt = config.systemPrompt;
    this.nextStepPrompt = config.nextStepPrompt;

    // Set defaults
    this.memory = config.memory || new Memory();
    this.state = AgentState.IDLE;
    this.maxSteps = config.maxSteps || 10;
    this.currentStep = 0;
    this.duplicateThreshold = config.duplicateThreshold || 2;

    // Initialize LLM (placeholder - will need actual config in implementation)
    this.llm = LLM.getInstance(this.name.toLowerCase(), {} as LLMConfig);
  }

  /**
   * Context manager for agent state transitions
   */
  async withState<T>(
    newState: AgentState,
    callback: () => Promise<T>
  ): Promise<T> {
    if (!Object.values(AgentState).includes(newState)) {
      throw new Error(`Invalid state: ${newState}`);
    }

    const previousState = this.state;
    this.state = newState;

    try {
      return await callback();
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    } finally {
      this.state = previousState;
    }
  }

  /**
   * Add a message to the agent's memory
   */
  updateMemory(
    role: "user" | "system" | "assistant" | "tool",
    content: string,
    options: Record<string, any> = {}
  ): void {
    const messageFactories = {
      user: () => Message.userMessage(content),
      system: () => Message.systemMessage(content),
      assistant: () => Message.assistantMessage(content),
      tool: () =>
        Message.toolMessage(
          content,
          options.name || "unknown",
          options.tool_call_id || "unknown"
        ),
    };

    if (!messageFactories[role]) {
      throw new Error(`Unsupported message role: ${role}`);
    }

    const message = messageFactories[role]();
    this.memory.addMessage(message);
  }

  /**
   * Run the agent with an optional initial request
   */
  async run(request?: string): Promise<string> {
    if (this.state !== AgentState.IDLE) {
      throw new Error(`Cannot run agent from state: ${this.state}`);
    }

    if (request) {
      this.updateMemory("user", request);
    }

    const results: string[] = [];

    return this.withState(AgentState.RUNNING, async () => {
      while (
        this.currentStep < this.maxSteps &&
        this.state !== AgentState.FINISHED
      ) {
        this.currentStep++;
        console.log(`Executing step ${this.currentStep}/${this.maxSteps}`);

        const stepResult = await this.step();

        // Check for stuck state
        if (this.isStuck()) {
          this.handleStuckState();
        }

        results.push(`Step ${this.currentStep}: ${stepResult}`);
      }

      if (this.currentStep >= this.maxSteps) {
        results.push(`Terminated: Reached max steps (${this.maxSteps})`);
      }

      return results.length ? results.join("\n") : "No steps executed";
    });
  }

  /**
   * Execute a single step in the agent's workflow
   */
  abstract step(): Promise<string>;

  /**
   * Handle stuck state by adding a prompt to change strategy
   */
  handleStuckState(): void {
    const stuckPrompt =
      "\
    Observed duplicate responses. Consider new strategies and avoid repeating ineffective paths already attempted.";

    this.nextStepPrompt = `${stuckPrompt}\n${this.nextStepPrompt}`;
    console.warn(`Agent detected stuck state. Added prompt: ${stuckPrompt}`);
  }

  /**
   * Check if the agent is stuck in a loop by detecting duplicate content
   */
  isStuck(): boolean {
    if (this.memory.messages.length < 2) {
      return false;
    }

    const lastMessage = this.memory.messages[this.memory.messages.length - 1];
    if (!lastMessage.content) {
      return false;
    }

    // Count identical content occurrences
    let duplicateCount = 0;
    for (let i = this.memory.messages.length - 2; i >= 0; i--) {
      const msg = this.memory.messages[i];
      if (msg.role === "assistant" && msg.content === lastMessage.content) {
        duplicateCount++;
      }
    }

    return duplicateCount >= this.duplicateThreshold;
  }

  /**
   * Get the list of messages from the agent's memory
   */
  get messages(): Message[] {
    return this.memory.messages;
  }

  /**
   * Set the list of messages in the agent's memory
   */
  set messages(value: Message[]) {
    this.memory.messages = value;
  }
}
