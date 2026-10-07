import { useState, useRef } from "react";
import { Plus, FolderGit2, Trash2, X, Clock } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { useFocusTrap } from "../../utils/useFocusTrap";

export default function ProjectsView() {
  const { projects, addProject, deleteProject } = useChat();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, modalOpen, () => setModalOpen(false));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    addProject(name.trim(), description.trim() || "No description provided.");
    setName("");
    setDescription("");
    setModalOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12">
      <div className="mx-auto w-full max-w-[840px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-6">
          <div>
            <h1 className="text-[26px] font-medium text-ink">Projects</h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              Organize related conversations, project documents, and custom instructions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[14px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            <Plus size={16} strokeWidth={2.2} />
            <span>New project</span>
          </button>
        </div>

        {/* Projects Grid or Empty state */}
        <div className="mt-8">
          {projects.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[15px] font-medium text-ink-soft">
                No projects yet.
              </p>
              <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
                Create a project to bundle custom files, documentation, and specific context into ongoing conversations.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="group relative flex flex-col justify-between rounded-xl border border-line bg-elev-1 p-5 transition-all hover:border-line-soft hover:bg-elev-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-elev-3 text-accent">
                          <FolderGit2 size={16} />
                        </div>
                        <h3 className="text-[15.5px] font-medium text-ink">
                          {proj.name}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteProject(proj.id)}
                        title="Delete project"
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-ink-muted hover:text-red-500 dark:hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted">
                      {proj.description}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center gap-1.5 text-[12px] text-ink-faint">
                    <Clock size={13} />
                    <span>Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Project Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
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
              <h2 id="create-project-heading" className="text-[17px] font-medium text-ink">Create project</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ink-soft">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Marketing Website"
                  className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-ink-soft">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this project focused on?"
                  className="mt-1 w-full resize-none rounded-lg border border-line bg-elev-2 px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
