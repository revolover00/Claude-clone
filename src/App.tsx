import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import MainChat from "./components/MainChat";
import SearchModal from "./components/modals/SearchModal";
import SettingsModal from "./components/modals/SettingsModal";
import { ChatProvider } from "./context/ChatContext";
import { ToastProvider } from "./context/ToastContext";

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("claude_sidebar_open");
      if (saved !== null) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return typeof window === "undefined" || window.innerWidth >= 1024;
  });

  useEffect(() => {
    try {
      localStorage.setItem("claude_sidebar_open", JSON.stringify(sidebarOpen));
    } catch {
      // ignore
    }
  }, [sidebarOpen]);

  return (
    <div className="flex h-full overflow-hidden bg-shell text-ink font-sans">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v: boolean) => !v)}
      />
      <MainChat
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v: boolean) => !v)}
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
