import { useState, useEffect } from "react";

export function usePanelResize() {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("claude_artifact_panel_width");
      if (saved) return parseInt(saved, 10);
    } catch {
      // ignore
    }
    return Math.max(420, Math.min(650, window.innerWidth * 0.45));
  });

  const [isLargeScreen, setIsLargeScreen] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );

  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("claude_artifact_panel_width", width.toString());
    } catch {
      // ignore
    }
  }, [width]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(360, Math.min(window.innerWidth * 0.7, startWidth - deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return {
    width,
    isLargeScreen,
    handleMouseDown,
  };
}
