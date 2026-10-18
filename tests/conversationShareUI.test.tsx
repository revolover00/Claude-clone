import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShareConversationDialog from "../src/components/chat/ShareConversationDialog";
import type { Conversation, Message } from "../src/types/chat";
import { decodeShareToken, readShareTokenFromHash } from "../src/shared/conversationShare";

const conversation = {
  id: "chat-1",
  title: "Share this chat",
  messages: [],
  createdAt: 1,
  updatedAt: 1,
} as Conversation;
const messages = [
  { id: "u1", role: "user", content: "Question", createdAt: 1 },
  { id: "a1", role: "assistant", content: "Answer", thinking: "private chain of thought", createdAt: 2 },
] as Message[];

let previousClipboard: PropertyDescriptor | undefined;

afterEach(() => {
  if (previousClipboard) Object.defineProperty(navigator, "clipboard", previousClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
  previousClipboard = undefined;
});

describe("conversation share dialog", () => {
  it("creates and copies a read-only link without reasoning data", async () => {
    previousClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ShareConversationDialog conversation={conversation} messages={messages} onClose={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: /create and copy link/i }));
    const field = await screen.findByLabelText("Read-only conversation share link");
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(field.getAttribute("value") || (field as HTMLInputElement).value));

    const url = new URL((field as HTMLInputElement).value);
    expect(url.pathname).toBe("/share");
    const token = readShareTokenFromHash(url.hash);
    expect(token).toBeTruthy();
    await expect(decodeShareToken(token!)).resolves.toMatchObject({
      title: "Share this chat",
      messages: [
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
      ],
    });
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
