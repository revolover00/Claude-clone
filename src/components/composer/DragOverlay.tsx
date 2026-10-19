import { UploadCloud } from "lucide-react";

interface DragOverlayProps {
  isDragging: boolean;
}

export default function DragOverlay({ isDragging }: DragOverlayProps) {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-4 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-black/75 backdrop-blur-sm pointer-events-none anim-modal-in">
      <div className="flex flex-col items-center gap-3 text-ink">
        <UploadCloud size={46} className="text-accent animate-bounce" />
        <p className="text-xl font-medium">Drop files here</p>
        <p className="text-sm text-ink-muted">Add photos, code files, and documents to your chat</p>
      </div>
    </div>
  );
}
