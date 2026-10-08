import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { BrowserRouter } from "react-router-dom";
import { UploadCloud, AlertTriangle, X } from "lucide-react";
import Sidebar from "./components/Sidebar";
import MainChat from "./components/MainChat";
import ErrorBoundary from "./components/shared/ErrorBoundary";
import { ChatProvider, useChat } from "./context/ChatContext";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginView from "./components/views/LoginView";
import MotionReview from "./components/views/MotionReview";

const ArtifactPanel = lazy(() => import("./components/artifacts/ArtifactPanel"));
const SearchModal = lazy(() => import("./components/modals/SearchModal"));
const SettingsModal = lazy(() => import("./components/modals/SettingsModal"));

function AppContent() {
  const isMotionPage = window.location.pathname === "/motion";
  if (isMotionPage) return <MotionReview />;

  const { loading, user } = useAuth();
  const {
    activeArtifact, artifactPanelOpen, closeArtifact, setArtifactVersion,
    searchModalOpen, setSearchModalOpen, settingsModalOpen, setSettingsModalOpen, setActiveView,
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem("claude_sidebar_open");
      if (saved !== null) return JSON.parse(saved);
    } catch { /* ignore */ }
    return typeof window === "undefined" || window.innerWidth >= 1024;
  });

  const [windowDragActive, setWindowDragActive] = useState(false);
  const [backendNotConfigured, setBackendNotConfigured] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => { if (data && data.hasKey === false) setBackendNotConfigured(true); })
      .catch((err) => console.warn("Health check error:", err));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("claude_sidebar_open", JSON.stringify(sidebarOpen));
    } catch { /* ignore */ }
  }, [sidebarOpen]);

  useEffect(() => {
    let startX: number | null = null, startY: number | null = null;
    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (startX === null || startY === null) return;
      const deltaX = e.changedTouches[0].clientX - startX;
      if (Math.abs(e.changedTouches[0].clientY - startY) < Math.abs(deltaX)) {
        if (startX < 24 && deltaX > 40) setSidebarOpen(true);
        else if (sidebarOpen && deltaX < -40) setSidebarOpen(false);
      }
      startX = null; startY = null;
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault(); dragCounterRef.current += 1; setWindowDragActive(true);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault(); dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0; setWindowDragActive(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault(); dragCounterRef.current = 0; setWindowDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        setActiveView("chat");
        window.dispatchEvent(new CustomEvent("claude:drop-files", { detail: { files: Array.from(e.dataTransfer.files) } }));
      }
    };
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [setActiveView]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchModalOpen) { e.preventDefault(); setSearchModalOpen(false); }
        else if (settingsModalOpen) { e.preventDefault(); setSettingsModalOpen(false); }
        else if (artifactPanelOpen) { e.preventDefault(); closeArtifact(); }
        else if (sidebarOpen && window.innerWidth < 1024) { e.preventDefault(); setSidebarOpen(false); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [artifactPanelOpen, closeArtifact, searchModalOpen, setSearchModalOpen, settingsModalOpen, setSettingsModalOpen, sidebarOpen]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-shell">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
      </div>
    );
  }

  if (!user) return <LoginView />;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-shell text-ink font-sans">
      {backendNotConfigured && (
        <div className="relative z-50 flex shrink-0 items-center justify-between border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-[13px] text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="shrink-0 text-amber-400" />
            <span>AI backend is not configured</span>
          </div>
          <button
            type="button"
            onClick={() => setBackendNotConfigured(false)}
            className="rounded p-1 text-amber-300 transition-colors hover:bg-amber-500/20 cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}

        <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v: boolean) => !v)} />
        <MainChat sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen((v: boolean) => !v)} />

        <Suspense fallback={null}>
          <ErrorBoundary fallbackType="artifact">
            <ArtifactPanel
              artifact={activeArtifact} isOpen={artifactPanelOpen} onClose={closeArtifact}
              onSelectVersion={(v) => { if (activeArtifact) setArtifactVersion(activeArtifact.id, v); }}
            />
          </ErrorBoundary>
        </Suspense>
      </div>

      <Suspense fallback={null}><SearchModal /></Suspense>
      <Suspense fallback={null}><SettingsModal /></Suspense>

      <div className={`fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/65 backdrop-blur-[2px] pointer-events-none transition-opacity duration-150 ${windowDragActive ? "opacity-100" : "opacity-0"}`} aria-hidden={!windowDragActive}>
        <div className="flex h-72 w-full max-w-xl flex-col items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-elev-1/95 p-6 shadow-2xl">
          <UploadCloud size={46} className="text-accent animate-bounce mb-3" />
          <p className="text-[20px] font-medium text-ink">Drop files here</p>
          <p className="mt-1 text-[13.5px] text-ink-muted">Add photos, code files, and documents to your chat</p>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary fallbackType="page">
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <ChatProvider>
              <AppContent />
            </ChatProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
