import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CredentialList, type CredentialRow } from "../src/components/providers/CredentialList";

const cred = (id: string, label: string, status = "active"): CredentialRow => ({
  id,
  provider: "groq",
  label,
  key_last4: "1234",
  status,
});

describe("CredentialList (multi-key priority UI)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders every key with its status chip in priority order", () => {
    render(
      <CredentialList
        providerId="groq"
        credentials={[cred("a", "default"), cred("b", "key2", "exhausted"), cred("c", "key3", "invalid")]}
      />
    );
    expect(screen.getByLabelText("API keys in priority order")).toBeTruthy();
    expect(screen.getByText("default")).toBeTruthy();
    expect(screen.getByText("Quota reached")).toBeTruthy();
    expect(screen.getByText("Invalid")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    // fallback hint for the user
    expect(screen.getByText(/falls through to the next/)).toBeTruthy();
  });

  it("reorders with the arrow buttons and persists the priority to localStorage", () => {
    render(<CredentialList providerId="groq" credentials={[cred("a", "default"), cred("b", "key2")]} />);
    fireEvent.click(screen.getByLabelText("Move key2 up"));
    const saved = JSON.parse(localStorage.getItem("claude_clone_key_order") || "{}");
    expect(saved.groq).toEqual(["b", "a"]);
    // DOM order follows: key2 now first in the list
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("key2");
    // top key cannot move further up, bottom cannot go further down
    expect(screen.getByLabelText("Move key2 up")).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Move default down")).toHaveProperty("disabled", true);
  });

  it("initializes from a saved order that is already in localStorage", () => {
    localStorage.setItem("claude_clone_key_order", JSON.stringify({ groq: ["b", "a"] }));
    render(<CredentialList providerId="groq" credentials={[cred("a", "default"), cred("b", "key2")]} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("key2");
    expect(items[1].textContent).toContain("default");
  });

  it("renders nothing when the provider has no keys", () => {
    const { container } = render(<CredentialList providerId="groq" credentials={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
