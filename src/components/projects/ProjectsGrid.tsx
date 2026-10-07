import React from "react";
import { useNavigate } from "react-router-dom";
import { FolderGit2, Trash2, Clock, Plus } from "lucide-react";
import type { Project } from "../../types/chat";

interface Props {
  projects: Project[];
  onOpenNewModal: () => void;
  onDeleteProject: (id: string) => void;
}

export const ProjectsGrid: React.FC<Props> = ({
  projects,
  onOpenNewModal,
  onDeleteProject,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12 font-sans">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h1 className="text-[24px] font-medium tracking-tight text-ink">Projects</h1>
            <p className="mt-1 text-[14px] text-ink-muted">
              Organize conversations with tailored instructions and reference knowledge.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenNewModal}
            className="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[14px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.2} />
            <span>New project</span>
          </button>
        </div>

        {/* Projects Grid or Proper Empty state */}
        <div className="mt-8">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-elev-1/50 py-20 px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-elev-2 text-accent mb-4 shadow-xs">
                <FolderGit2 size={28} strokeWidth={1.8} />
              </div>
              <h2 className="text-[17px] font-medium text-ink">No projects yet</h2>
              <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
                Create a project to bundle custom system instructions, files, and background context for your chats.
              </p>
              <button
                type="button"
                onClick={onOpenNewModal}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Plus size={15} strokeWidth={2.2} />
                <span>Create first project</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => navigate(`/projects/${proj.id}`)}
                  className="group relative flex flex-col justify-between rounded-xl border border-line bg-elev-1 p-5 transition-all cursor-pointer hover:border-line-soft hover:bg-elev-2 shadow-sm"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete project "${proj.name}"?`)) {
                            onDeleteProject(proj.id);
                          }
                        }}
                        title="Delete project"
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-ink-muted hover:text-red-500 p-1 cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted text-start">
                      {proj.description || "No description provided."}
                    </p>
                  </div>

                  <div className="mt-6 flex items-center justify-between text-[12px] text-ink-faint">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} />
                      <span>Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                    </div>
                    {proj.knowledge && proj.knowledge.length > 0 && (
                      <span>{proj.knowledge.length} docs</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectsGrid;
