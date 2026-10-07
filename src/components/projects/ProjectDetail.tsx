import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  FolderGit2,
  Plus,
  MessagesSquare,
  X,
  ExternalLink,
} from "lucide-react";
import ProjectInstructions from "./ProjectInstructions";
import KnowledgeList from "./KnowledgeList";
import { useChat } from "../../context/ChatContext";
import { useToast } from "../../context/ToastContext";
import { useFocusTrap } from "../../utils/useFocusTrap";
import type { Project } from "../../types/chat";

interface Props {
  project: Project;
}

export const ProjectDetail: React.FC<Props> = ({ project }) => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    conversations,
    updateProject,
    deleteProject,
    addProjectKnowledge,
    deleteProjectKnowledge,
    createNewChat,
    setActiveConversationId,
    setActiveView,
  } = useChat();

  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDesc, setEditDesc] = useState(project.description);
  const editMetaRef = useRef<HTMLDivElement>(null);

  useFocusTrap(editMetaRef, editMetaOpen, () => setEditMetaOpen(false));

  const projectChats = conversations.filter((c) => c.projectId === project.id);

  const handleUpdateMeta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    updateProject(project.id, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    setEditMetaOpen(false);
    showToast("Project details updated", "success");
  };

  const handleStartProjectChat = () => {
    createNewChat(project.id);
  };

  const handleOpenChat = (chatId: string) => {
    setActiveConversationId(chatId);
    setActiveView("chat");
    navigate(`/chat/${chatId}`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12 font-sans">
      <div className="mx-auto w-full max-w-[840px] space-y-8 pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>All Projects</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditName(project.name);
                setEditDesc(project.description);
                setEditMetaOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-1 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-2 transition-colors cursor-pointer"
            >
              <Pencil size={13} />
              <span>Edit Details</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete project "${project.name}"?`)) {
                  deleteProject(project.id);
                  navigate("/projects");
                }
              }}
              title="Delete Project"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-elev-1 text-ink-muted hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Project Header Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-elev-3 text-accent shadow-sm">
              <FolderGit2 size={22} />
            </div>
            <div>
              <h1 className="text-[24px] font-medium tracking-tight text-ink">
                {project.name}
              </h1>
              <p className="mt-1 text-[14px] text-ink-muted">
                {project.description || "No description provided."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartProjectChat}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 self-start sm:self-auto cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.2} />
            <span>New Chat in Project</span>
          </button>
        </div>

        {/* SECTION 1: Custom Instructions */}
        <ProjectInstructions
          initialInstructions={project.instructions || ""}
          onSave={(inst) => updateProject(project.id, { instructions: inst })}
        />

        {/* SECTION 2: Project Knowledge Base */}
        <KnowledgeList
          projectId={project.id}
          knowledge={project.knowledge || []}
          onAddKnowledge={addProjectKnowledge}
          onDeleteKnowledge={deleteProjectKnowledge}
        />

        {/* SECTION 3: Project Chats */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <MessagesSquare size={16} className="text-accent" />
                <h2 className="text-[15.5px] font-medium text-ink">
                  Project Conversations
                </h2>
              </div>
              <p className="mt-1 text-[13px] text-ink-muted">
                Chats started inside this project inherit its instructions and knowledge base.
              </p>
            </div>

            <button
              type="button"
              onClick={handleStartProjectChat}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-3 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Start Chat</span>
            </button>
          </div>

          <div className="mt-4">
            {projectChats.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[14px] text-ink-soft">
                  No conversations yet in this project.
                </p>
                <button
                  type="button"
                  onClick={handleStartProjectChat}
                  className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline cursor-pointer"
                >
                  <span>Start your first project conversation</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            ) : (
              <div className="divide-y divide-line/40">
                {projectChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => handleOpenChat(chat.id)}
                    className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-elev-2 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14px] font-medium text-ink truncate">
                        {chat.title}
                      </h4>
                      <p className="text-[12px] text-ink-muted mt-0.5">
                        {chat.messages.length} messages · Updated {new Date(chat.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Metadata Modal */}
      {editMetaOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setEditMetaOpen(false)}
        >
          <div
            ref={editMetaRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-project-heading"
            className="anim-modal-in w-full max-w-[460px] rounded-xl border border-line bg-elev-1 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 id="edit-project-heading" className="text-[17px] font-medium text-ink">
                Edit project details
              </h2>
              <button
                type="button"
                onClick={() => setEditMetaOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateMeta} className="mt-5 space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ink-muted">Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-ink-muted">Description</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full resize-none rounded-lg border border-line bg-elev-2 p-3 text-[14px] text-ink focus:border-accent focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditMetaOpen(false)}
                  className="rounded-lg px-3.5 py-1.5 text-[13.5px] text-ink-muted hover:bg-elev-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetail;
