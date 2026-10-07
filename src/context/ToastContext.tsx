import React, { createContext, useContext, useState, useCallback } from "react";
import { Check, Info, AlertCircle } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type?: "info" | "success" | "error";
}

interface ToastContextType {
  showToast: (message: string, type?: "info" | "success" | "error") => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback(
    (message: string, type: "info" | "success" | "error" = "info") => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none font-sans">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="anim-popover-in pointer-events-auto flex items-center gap-2.5 rounded-xl border border-line bg-elev-2 px-4 py-2.5 text-[13.5px] font-medium text-ink shadow-[0_12px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
          >
            {toast.type === "success" && (
              <Check size={16} className="text-accent" />
            )}
            {toast.type === "error" && (
              <AlertCircle size={16} className="text-[#f08578]" />
            )}
            {toast.type === "info" && (
              <Info size={16} className="text-link" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
};
