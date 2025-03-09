// src/utils/helpers.ts
import * as crypto from "crypto";
import { Message } from "../schema";

/**
 * Generate a random ID with specified length
 */
export function generateId(length: number = 10): string {
  return crypto.randomBytes(length).toString("hex");
}

/**
 * Create a timestamped ID
 */
export function timestampedId(prefix: string = ""): string {
  return `${prefix}${Date.now()}_${generateId(5)}`;
}

/**
 * Parse a string into a structured object using a schema
 */
export function parseStringToObject<T>(
  input: string,
  schema: any,
  fallback?: T
): T | null {
  try {
    // Basic attempt to parse JSON
    const parsed = JSON.parse(input.trim());

    // Validate against schema (placeholder - would use schema validation)
    return parsed;
  } catch (error) {
    console.warn(`Failed to parse string to object: ${error}`);
    return fallback || null;
  }
}

/**
 * Format error as a user-friendly message
 */
export function formatError(error: any): string {
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Error: ${String(error)}`;
}

/**
 * Extract relevant text from a longer document
 */
export function extractRelevantText(
  text: string,
  query: string,
  maxLength: number = 500
): string {
  // Simple implementation - in a real system this would use semantic similarity
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Find position of query or keywords
  const keywords = lowerQuery.split(/\s+/).filter((word) => word.length > 3);
  let bestPosition = lowerText.indexOf(lowerQuery);

  if (bestPosition === -1) {
    // Try to find any of the keywords
    for (const keyword of keywords) {
      const position = lowerText.indexOf(keyword);
      if (position !== -1) {
        bestPosition = position;
        break;
      }
    }
  }

  // If nothing found, return beginning of text
  if (bestPosition === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");
  }

  // Extract text around the best position
  const startPos = Math.max(0, bestPosition - maxLength / 2);
  const endPos = Math.min(text.length, startPos + maxLength);

  return (
    (startPos > 0 ? "..." : "") +
    text.slice(startPos, endPos) +
    (endPos < text.length ? "..." : "")
  );
}

/**
 * Merge messages with the same role
 */
export function mergeMessages(messages: Message[]): Message[] {
  const result: Message[] = [];
  let currentMessage: Message | null = null;

  for (const message of messages) {
    if (
      !currentMessage ||
      message.role !== currentMessage.role ||
      message.tool_calls ||
      currentMessage.tool_calls
    ) {
      // Start a new message
      currentMessage = new Message(
        message.role,
        message.content,
        message.tool_calls,
        message.name,
        message.tool_call_id
      );
      result.push(currentMessage);
    } else {
      // Merge with current message of the same role
      currentMessage.content = `${currentMessage.content || ""}\n\n${
        message.content || ""
      }`;
    }
  }

  return result;
}
