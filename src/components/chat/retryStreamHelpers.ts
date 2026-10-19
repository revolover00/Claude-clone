import type { Message } from "../../types/chat";

export function buildRetryContext(
  messages: Message[], userMessageId: string, assistantMessageId: string, includePreviousResponse: boolean
): Message[] {
  const userIndex = messages.findIndex((message) => message.id === userMessageId);
  if (!includePreviousResponse) return messages.slice(0, userIndex < 0 ? undefined : userIndex);
  if (userIndex < 0) return messages;
  const previousResponse = messages.find((message) => message.id === assistantMessageId);
  return [...messages.slice(0, userIndex + 1), ...(previousResponse ? [previousResponse] : [])];
}

export function buildRetryPrompt(userMessage: string, modifier: string): string {
  const instruction = modifier.trim();
  return instruction
    ? `Revise your previous response according to this instruction. Return the complete revised response, not a description of changes.\n\n${instruction}`
    : userMessage;
}
