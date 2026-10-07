import React, { useState, useRef } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "../../utils/useFocusTrap";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export const NewProjectModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, isOpen, onClose);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim());
    setName("");
    setDescription("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm font-sans"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-heading"
        className="anim-modal-in w-full max-w-[460px] rounded-xl border border-line bg-elev-1 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="create-project-heading" className="text-[17px] font-medium text-ink">
            Create project
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-[13px] font-medium text-ink-muted">Name</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design System"
              className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[13px] font-medium text-ink-muted">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project about?"
              className="mt-1 w-full resize-none rounded-lg border border-line bg-elev-2 p-3 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3.5 py-1.5 text-[13.5px] text-ink-muted hover:bg-elev-2 hover:text-ink cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90 cursor-pointer"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;
