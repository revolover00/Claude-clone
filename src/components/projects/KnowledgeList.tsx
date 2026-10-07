import React, { useState, useRef } from "react";
import {
  FileText,
  FileCode,
  Upload,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useFocusTrap } from "../../utils/useFocusTrap";
import { useToast } from "../../context/ToastContext";
import type { ProjectKnowledgeItem } from "../../types/chat";

interface Props {
  projectId: string;
  knowledge: ProjectKnowledgeItem[];
  onAddKnowledge: (
    projectId: string,
    item: Omit<ProjectKnowledgeItem, "id" | "createdAt">
  ) => void;
  onDeleteKnowledge: (projectId: string, itemId: string) => void;
}

export const KnowledgeList: React.FC<Props> = ({
  projectId,
  knowledge,
  onAddKnowledge,
  onDeleteKnowledge,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addModalRef = useRef<HTMLDivElement>(null);
  const viewModalRef = useRef<HTMLDivElement>(null);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState("");
  const [snippetContent, setSnippetContent] = useState("");
  const [viewingItem, setViewingItem] = useState<ProjectKnowledgeItem | null>(null);

  useFocusTrap(addModalRef, addModalOpen, () => setAddModalOpen(false));
  useFocusTrap(viewModalRef, Boolean(viewingItem), () => setViewingItem(null));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        onAddKnowledge(projectId, {
          title: file.name,
          content: text,
          type: "file",
          fileName: file.name,
          fileSize: file.size,
        });
        showToast(`Uploaded ${file.name}`, "success");
      };
      reader.readAsText(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddSnippet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snippetTitle.trim() || !snippetContent.trim()) return;
    onAddKnowledge(projectId, {
      title: snippetTitle.trim(),
      content: snippetContent.trim(),
      type: "text",
    });
    setSnippetTitle("");
    setSnippetContent("");
    setAddModalOpen(false);
    showToast("Knowledge snippet added", "success");
  };

  return (
    <div className="rounded-xl border border-line bg-elev-1 p-5 shadow-sm font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-accent" />
            <h2 className="text-[15.5px] font-medium text-ink">
              Project Knowledge Base
            </h2>
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">
            Documents and snippets available to Claude across all chats in this project.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.html,.css,.csv,.yaml,.yml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-3 transition-colors cursor-pointer"
          >
            <Upload size={14} />
            <span>Upload Files</span>
          </button>

          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 shadow-sm transition-opacity cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Snippet</span>
          </button>
        </div>
      </div>

      {/* Knowledge Items Grid */}
      <div className="mt-4">
        {knowledge.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[14px] font-medium text-ink-soft">
              No knowledge items added yet.
            </p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              Add style guides, API documentation, or reference notes to ground your chats.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {knowledge.map((item) => (
              <div
                key={item.id}
                onClick={() => setViewingItem(item)}
                className="group relative flex flex-col justify-between rounded-lg border border-line bg-elev-2 p-3.5 hover:border-line-soft hover:bg-elev-3 cursor-pointer transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.type === "file" ? (
                        <FileCode size={16} className="text-accent shrink-0" />
                      ) : (
                        <FileText size={16} className="text-accent shrink-0" />
                      )}
                      <h4 className="text-[14px] font-medium text-ink truncate">
                        {item.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteKnowledge(projectId, item.id);
                        showToast("Knowledge item deleted", "info");
                      }}
                      className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-500 transition-opacity p-1 cursor-pointer"
                      title="Delete item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-muted leading-relaxed">
                    {item.content}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11.5px] text-ink-faint">
                  <span>{item.type === "file" ? "Uploaded file" : "Text snippet"}</span>
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Knowledge Modal */}
      {addModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setAddModalOpen(false)}
        >
          <div
            ref={addModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-snippet-title"
            className="anim-modal-in w-full max-w-lg rounded-xl border border-line bg-elev-1 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="add-snippet-title" className="text-[16px] font-medium text-ink">
                Add Knowledge Snippet
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSnippet} className="mt-4 space-y-3.5">
              <div>
                <label className="text-[12.5px] font-medium text-ink-muted">Title</label>
                <input
                  type="text"
                  required
                  value={snippetTitle}
                  onChange={(e) => setSnippetTitle(e.target.value)}
                  placeholder="e.g. Database schema overview"
                  className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[12.5px] font-medium text-ink-muted">Content</label>
                <textarea
                  rows={6}
                  required
                  value={snippetContent}
                  onChange={(e) => setSnippetContent(e.target.value)}
                  placeholder="Paste documentation, specifications, or guidance text here..."
                  className="mt-1 w-full rounded-lg border border-line bg-elev-2 p-3 text-[13.5px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-[13.5px] text-ink-muted hover:bg-elev-2 hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90 cursor-pointer"
                >
                  Add to Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Knowledge Item Modal */}
      {viewingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setViewingItem(null)}
        >
          <div
            ref={viewModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-snippet-title"
            className="anim-modal-in flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-elev-1 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 id="view-snippet-title" className="text-[16px] font-medium text-ink truncate">
                {viewingItem.title}
              </h3>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <pre className="rounded-lg bg-elev-2 p-4 text-[13px] text-ink leading-relaxed font-mono whitespace-pre-wrap">
                {viewingItem.content}
              </pre>
            </div>

            <div className="mt-4 flex justify-end border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="rounded-lg bg-elev-2 px-4 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-3 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeList;
