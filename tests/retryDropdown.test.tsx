import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RetryDropdown from "../src/components/chat/RetryDropdown";
import * as useModelsHook from "../src/hooks/useModels";
import type { Message } from "../src/types/chat";

describe("custom retry instructions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(useModelsHook, "useModels").mockReturnValue({ models: [] } as any);
  });

  it("passes a trimmed custom directive to the selected assistant response", () => {
    const onRetry = vi.fn();
    const onToggle = vi.fn();
    render(
      <RetryDropdown
        message={{ id: "assistant-2", role: "assistant", content: "Old answer", createdAt: 2 } as Message}
        isOpen onToggle={onToggle} onRetry={onRetry} dropdownRef={createRef<HTMLDivElement>()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /custom instruction/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Custom retry instruction" }), {
      target: { value: "  Answer in Arabic.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Retry response" }));

    expect(onRetry).toHaveBeenCalledWith("assistant-2", { modifier: "Answer in Arabic." });
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
