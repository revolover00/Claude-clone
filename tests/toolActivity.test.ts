import { describe, expect, it } from "vitest";
import { upsertToolActivityEvent } from "../src/utils/toolActivity";
import type { ToolActivityEvent } from "../src/types/chat";

const start: ToolActivityEvent = {
  id: "call-1",
  name: "load_skill",
  skill: "writing",
  status: "executing",
};

describe("tool activity event history", () => {
  it("updates one activity when its matching server call completes", () => {
    const events = upsertToolActivityEvent([start], {
      ...start,
      skill: "writing-guidance",
      status: "completed",
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: "call-1", status: "completed", skill: "writing-guidance" });
  });

  it("pairs legacy events without ids with the newest matching pending call", () => {
    const first = { name: "read_skill_file", skill: "docs", status: "executing" } as const;
    const second = { ...first };
    const events = upsertToolActivityEvent(
      [{ ...first, id: "old" }, { ...second, id: "new" }],
      { ...first, status: "completed" }
    );

    expect(events.map((event) => event.status)).toEqual(["executing", "completed"]);
    expect(events[1].id).toBe("new");
  });

  it("keeps completed history when a later tool call starts", () => {
    const complete = { ...start, status: "completed" as const };
    const next = upsertToolActivityEvent([complete], { ...start, id: "call-2" });

    expect(next).toHaveLength(2);
    expect(next.map((event) => event.status)).toEqual(["completed", "executing"]);
  });
});
