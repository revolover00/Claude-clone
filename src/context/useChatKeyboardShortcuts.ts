import { useEffect } from "react";

export function useChatKeyboardShortcuts(ui: {
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
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
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ui]);
}
