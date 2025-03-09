// src/schema/memory.ts
import { Message } from "./message";

/**
 * Represents the memory of an agent, storing conversation history
 */
export class Memory {
  messages: Message[];
  maxMessages: number;

  constructor(maxMessages: number = 100) {
    this.messages = [];
    this.maxMessages = maxMessages;
  }

  /**
   * Add a message to memory
   */
  addMessage(message: Message): void {
    this.messages.push(message);

    // Implement message limit
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Add multiple messages to memory
   */
  addMessages(messages: Message[]): void {
    this.messages.push(...messages);

    // Implement message limit
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
  }

  /**
   * Clear all messages from memory
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Get the n most recent messages
   */
  getRecentMessages(n: number): Message[] {
    return this.messages.slice(-n);
  }

  /**
   * Convert messages to list of objects
   */
  toDictList(): Record<string, any>[] {
    return this.messages.map((msg) => msg.toDict());
  }
}
