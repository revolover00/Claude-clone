import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AssistantMessageToolbar from "../src/components/chat/AssistantMessageToolbar";
import type { Message } from "../src/types/chat";

describe("interrupted reply toolbar", () => {
  it("explains the saved partial and offers Continue", () => {
    const onContinue = vi.fn();
    render(
      <AssistantMessageToolbar
        message={{ id: "assistant-1", role: "assistant", content: "Partial", createdAt: 1, finishReason: "INTERRUPTED" } as Message}
        isArabic={false} hasMultipleVersions={false} currentIndex={0} siblingsLength={1}
        onPrevVersion={vi.fn()} onNextVersion={vi.fn()} timeStr="now" fullDateStr="today"
        copied={false} handleCopy={vi.fn()} handleReadAloud={vi.fn()} speechState="idle"
        thumbs={null} setThumbs={vi.fn()} thumbsDownPopoverOpen={false} setThumbsDownPopoverOpen={vi.fn()}
        retryDropdownOpen={false} setRetryDropdownOpen={vi.fn()} onContinue={onContinue}
        isLastAssistantMessage dropdownRef={createRef<HTMLDivElement>()}
      />
    );

    expect(screen.getByRole("status").textContent).toContain("partial reply saved");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledWith("assistant-1");
  });
});
