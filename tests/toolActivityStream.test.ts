import { describe, expect, it, vi } from "vitest";
import { pumpGeminiStream } from "../server/lib/chatStreamHelpers";

async function* chunks(values: unknown[]) {
  for (const value of values) yield value;
}

describe("Gemini tool activity SSE events", () => {
  it("uses one stable opaque id from tool start through completion", async () => {
    const writes: string[] = [];
    const res = { write: (value: string) => writes.push(value) };
    const stream = chunks([
      { candidates: [{ content: { parts: [{ functionCall: { name: "load_skill", args: { name: "writing" } } }] } }] },
      { candidates: [{ content: { parts: [{ text: "Ready" }] }, finishReason: "STOP" }] },
    ]);

    await pumpGeminiStream({
      res,
      stream,
      abortCtrl: new AbortController(),
      modelId: "gemini-test",
      formattedMessages: [],
      config: {},
      executeSkillFunctionCall: vi.fn().mockResolvedValue({ result: "instructions", skillName: "writing" }),
      runSkillToolStream: vi.fn().mockResolvedValue(chunks([])),
    });

    const events = writes.flatMap((write) => write.split("\n"))
      .filter((line) => line.startsWith("data: {"))
      .map((line) => JSON.parse(line.slice(6)))
      .flatMap((payload) => payload.tool ? [payload.tool] : []);

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.status)).toEqual(["executing", "completed"]);
    expect(events[0].id).toBeTruthy();
    expect(events[1].id).toBe(events[0].id);
  });
});
