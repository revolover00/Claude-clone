import { describe, expect, it } from "vitest";
import { migrateConversations } from "../src/context/stores/conversationsHelpers";
import { buildContinuationContext } from "../src/components/chat/sendStreamHelpers";
import type { Message } from "../src/types/chat";

describe("interrupted reply recovery", () => {
  it("restores a partial tree reply as stopped and continuable", () => {
    const [conversation] = migrateConversations([{
      id: "chat",
      title: "Recovery",
      rootMessageId: "user-1",
      messages: [
        { id: "user-1", role: "user", content: "Explain this", parentId: null },
        { id: "assistant-1", role: "assistant", content: "A partial answer", parentId: "user-1", isStreaming: true, isThinking: true, isReconnecting: true, isSearchingWeb: true },
      ],
    }]);
    const reply = conversation.messages[1];

    expect(reply).toMatchObject({
      isStreaming: false,
      isThinking: false,
      isReconnecting: false,
      isSearchingWeb: false,
      finishReason: "INTERRUPTED",
      isError: false,
    });
    expect(reply.content).toBe("A partial answer");
    expect(reply.errorText).toBeUndefined();
  });

  it("marks an interrupted empty reply as retryable with an actionable error", () => {
    const [conversation] = migrateConversations([{
      id: "chat",
      title: "Recovery",
      messages: [{ id: "assistant-1", role: "assistant", content: "", isStreaming: true }],
    }]);
    const reply = conversation.messages[0];

    expect(reply.finishReason).toBe("INTERRUPTED");
    expect(reply.isError).toBe(true);
    expect(reply.errorText).toContain("page reload");
  });

  it("includes the partial assistant reply in continuation context", () => {
    const messages = [
      { id: "user-1", role: "user", content: "Question" },
      { id: "assistant-1", role: "assistant", content: "Partial answer" },
      { id: "user-2", role: "user", content: "Later question" },
    ] as Message[];

    expect(buildContinuationContext(messages, "assistant-1").map(({ id }) => id))
      .toEqual(["user-1", "assistant-1"]);
  });
});
