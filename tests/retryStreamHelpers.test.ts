import { describe, expect, it } from "vitest";
import { buildRetryContext, buildRetryPrompt } from "../src/components/chat/retryStreamHelpers";
import type { Message } from "../src/types/chat";

const messages = [
  { id: "user-1", role: "user", content: "First question" },
  { id: "assistant-1", role: "assistant", content: "First answer" },
  { id: "user-2", role: "user", content: "Second question" },
  { id: "assistant-2", role: "assistant", content: "Previous second answer" },
  { id: "user-3", role: "user", content: "Later question" },
] as Message[];

describe("retry context and prompt", () => {
  it("adds the previous answer only when applying a custom revision", () => {
    expect(buildRetryContext(messages, "user-2", "assistant-2", false).map(({ id }) => id))
      .toEqual(["user-1", "assistant-1"]);
    expect(buildRetryContext(messages, "user-2", "assistant-2", true).map(({ id }) => id))
      .toEqual(["user-1", "assistant-1", "user-2", "assistant-2"]);
  });

  it("uses the original prompt for standard retry and a clean instruction for revisions", () => {
    expect(buildRetryPrompt("Original question", " ")).toBe("Original question");
    expect(buildRetryPrompt("Original question", "  Answer in Arabic.  "))
      .toContain("\n\nAnswer in Arabic.");
  });
});
