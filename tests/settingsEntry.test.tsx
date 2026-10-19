import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import UserMenu from "../src/components/modals/UserMenu";
import * as ChatContextCore from "../src/context/ChatContextCore";
import * as AuthContextModule from "../src/context/AuthContext";

describe("UserMenu Settings Entry", () => {
  it("opens the Settings modal and closes the menu when Settings is clicked", () => {
    const onClose = vi.fn();
    const setSettingsModalOpen = vi.fn();

    vi.spyOn(ChatContextCore, "useChat").mockReturnValue({
      setSettingsModalOpen,
    } as any);

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { email: "test@example.com" } as any,
      profile: { display_name: "Test User" } as any,
      signOut: vi.fn(),
      loading: false,
    } as any);

    render(<UserMenu isOpen={true} onClose={onClose} />);

    const settingsButton = screen.getByRole("button", { name: /settings/i });
    expect(settingsButton).toBeDefined();

    fireEvent.click(settingsButton);

    expect(setSettingsModalOpen).toHaveBeenCalledWith(true);
    expect(onClose).toHaveBeenCalled();
  });
});
