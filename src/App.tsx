import { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import MainChat from "./components/MainChat";
import SearchModal from "./components/modals/SearchModal";
import SettingsModal from "./components/modals/SettingsModal";
import ArtifactPanel from "./components/artifacts/ArtifactPanel";
import { ChatProvider, useChat } from "./context/ChatContext";
import { ToastProvider } from "./context/ToastContext";

function AppContent() {
  const {
    activeArtifact,
    artifactPanelOpen,
    closeArtifact,
    setArtifactVersion,
    searchModalOpen,
    setSearchModalOpen,
    settingsModalOpen,
    setSettingsModalOpen,
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("claude_sidebar_open");
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return typeof window === "undefined" || window.innerWidth >= 1024;
  });

  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("claude_sidebar_open", JSON.stringify(sidebarOpen));
    } catch {
      // ignore
    }
  }, [sidebarOpen]);

  // Mobile swipe-from-left-edge listener to open sidebar
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch.clientX < 28) {
        touchStartXRef.current = touch.clientX;
      } else {
        touchStartXRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartXRef.current !== null) {
        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartXRef.current;
        if (deltaX > 48) {
          setSidebarOpen(true);
          touchStartXRef.current = null;
        }
      }
    };

    const handleTouchEnd = () => {
      touchStartXRef.current = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  // Esc closes top-most layer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (artifactPanelOpen) {
          e.preventDefault();
          closeArtifact();
        } else if (searchModalOpen) {
          e.preventDefault();
          setSearchModalOpen(false);
        } else if (settingsModalOpen) {
          e.preventDefault();
          setSettingsModalOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    artifactPanelOpen,
    closeArtifact,
    searchModalOpen,
    setSearchModalOpen,
    settingsModalOpen,
    setSettingsModalOpen,
  ]);

  return (
    <div className="flex h-full overflow-hidden bg-shell text-ink font-sans">
      {/* Mobile backdrop for sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v: boolean) => !v)}
      />

      {/* Main Chat Stage */}
      <MainChat
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v: boolean) => !v)}
      />

      {/* Slide-in Artifact Panel (Desktop 45% right column, Mobile sheet) */}
      <ArtifactPanel
        artifact={activeArtifact}
        isOpen={artifactPanelOpen}
        onClose={closeArtifact}
        onSelectVersion={(v) => {
          if (activeArtifact) setArtifactVersion(activeArtifact.id, v);
        }}
      />

      {/* Global Modals */}
      <SearchModal />
      <SettingsModal />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </ToastProvider>
  );
}
