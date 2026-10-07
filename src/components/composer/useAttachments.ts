import { useState, useRef, useEffect, useCallback } from "react";
import type { Attachment } from "../../types/chat";
import { useToast } from "../../context/ToastContext";

export function useAttachments() {
  const { showToast } = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        const isImage = file.type.startsWith("image/");

        reader.onload = () => {
          const newAtt: Attachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            url: reader.result as string,
            isImage,
          };
          setAttachments((prev) => [...prev, newAtt]);
          showToast(`Attached ${file.name}`, "success");
        };

        reader.readAsDataURL(file);
      });
    },
    [showToast]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  // Global drag & drop overlay
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleFiles]);

  // Listen for window-wide dropped files from App.tsx
  useEffect(() => {
    const handleGlobalDrop = (e: Event) => {
      const custom = e as CustomEvent<{ files: File[] }>;
      if (custom.detail?.files && custom.detail.files.length > 0) {
        handleFiles(custom.detail.files);
      }
    };
    window.addEventListener("claude:drop-files", handleGlobalDrop);
    return () => {
      window.removeEventListener("claude:drop-files", handleGlobalDrop);
    };
  }, [handleFiles]);

  // Paste image or files from clipboard
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
      }
    },
    [handleFiles]
  );

  // Screenshot capture using getDisplayMedia
  const captureScreenshot = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        showToast("Screen capture not supported in this browser", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = stream.getVideoTracks()[0];
      const imageCapture = (window as any).ImageCapture
        ? new (window as any).ImageCapture(track)
        : null;

      if (imageCapture) {
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(bitmap, 0, 0);
        track.stop();

        const dataUrl = canvas.toDataURL("image/png");
        const newAtt: Attachment = {
          id: `att-${Date.now()}`,
          name: "screenshot.png",
          size: Math.round((dataUrl.length * 3) / 4),
          type: "image/png",
          url: dataUrl,
          isImage: true,
        };
        setAttachments((prev) => [...prev, newAtt]);
        showToast("Screenshot captured", "success");
      } else {
        track.stop();
        showToast("Screenshot captured", "success");
      }
    } catch {
      showToast("Screenshot cancelled", "info");
    }
  }, [showToast]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    attachments,
    isDragging,
    fileInputRef,
    handleFiles,
    removeAttachment,
    clearAttachments,
    handlePaste,
    captureScreenshot,
    openFilePicker,
  };
}
