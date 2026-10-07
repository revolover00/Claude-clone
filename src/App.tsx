import { useState } from "react";
import Sidebar from "./components/Sidebar";
import MainChat from "./components/MainChat";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 1024
  );

  return (
    <div className="flex h-full overflow-hidden bg-shell text-ink">
      {/* mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen((v) => !v)} />
      <MainChat />
    </div>
  );
}
