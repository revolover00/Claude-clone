import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import SharedConversationView from "../src/components/views/SharedConversationView";
import { buildShareSnapshot, encodeShareToken } from "../src/shared/conversationShare";

describe("shared conversation page", () => {
  it("opens the portable snapshot as a read-only page and sanitizes message HTML", async () => {
    const snapshot = buildShareSnapshot("A shared answer", [
      { role: "user", content: "What happened?" },
      { role: "assistant", content: '<img src=x onerror="alert(1)">Here is **the answer**.' },
    ]);
    const token = await encodeShareToken(snapshot);
    window.history.replaceState({}, "", `/share#share=${token}`);

    render(<MemoryRouter initialEntries={["/share"]}><SharedConversationView /></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "A shared answer" })).toBeTruthy();
    expect(screen.getByText("What happened?")).toBeTruthy();
    expect(document.body.textContent).toContain("Here is the answer.");
    expect(document.querySelector("[onerror]")).toBeNull();
  });
});
