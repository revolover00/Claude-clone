import { useEffect } from "react";

export function useChatKeyboardShortcuts(ui: {
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  createNewChat: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setSearchModalOpen(!ui.searchModalOpen);
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        ui.createNewChat();
      }

      // Shortcut Ctrl/Cmd+, to open Settings
      if (isCmdOrCtrl && (e.key === "," || e.key === "<")) {
        e.preventDefault();
        ui.setSettingsModalOpen(!ui.settingsModalOpen);
      }

      // Shortcut '?' or Cmd+/ to open Keyboard Shortcuts dialog
      if ((e.key === "?" && !isCmdOrCtrl && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") || (isCmdOrCtrl && e.key === "/")) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("open-shortcuts-dialog"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ui]);
}
