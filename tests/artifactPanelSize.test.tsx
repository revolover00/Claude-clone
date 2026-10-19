import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getArtifactPanelHeight, useArtifactPanelSize } from "../src/components/artifacts/useArtifactPanelSize";

describe("artifact sandbox sizing", () => {
  it("opens compact and animates between compact and expanded heights", () => {
    const { result, rerender } = renderHook(
      ({ isOpen, artifactId }) => useArtifactPanelSize(isOpen, artifactId),
      { initialProps: { isOpen: false, artifactId: "first" } },
    );

    rerender({ isOpen: true, artifactId: "first" });
    expect(result.current.isExpanded).toBe(false);
    expect(getArtifactPanelHeight(result.current.isExpanded, false)).toBe("44dvh");

    act(() => result.current.toggleExpanded());
    expect(result.current.isExpanded).toBe(true);
    expect(getArtifactPanelHeight(result.current.isExpanded, false)).toBe("calc(100dvh - 3rem)");
    expect(getArtifactPanelHeight(result.current.isExpanded, true)).toBe("100%");
  });

  it("starts a newly opened artifact in compact mode", () => {
    const { result, rerender } = renderHook(
      ({ isOpen, artifactId }) => useArtifactPanelSize(isOpen, artifactId),
      { initialProps: { isOpen: true, artifactId: "first" } },
    );
    act(() => result.current.toggleExpanded());
    expect(result.current.isExpanded).toBe(true);

    rerender({ isOpen: true, artifactId: "second" });
    expect(result.current.isExpanded).toBe(false);
  });
});
