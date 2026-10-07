import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  FolderGit2,
  Trash2,
  X,
  Clock,
  ArrowLeft,
  FileText,
  Upload,
  MessagesSquare,
  Sparkles,
  Check,
  Pencil,
  FileCode,
  ExternalLink,
} from "lucide-react";
import { useChat } from "../../context/ChatContext";
import { useToast } from "../../context/ToastContext";
import { useFocusTrap } from "../../utils/useFocusTrap";
import type { Project, ProjectKnowledgeItem } from "../../types/chat";

/**
 * Individual Project Workspace View for /projects/:id
 */
function ProjectDetailView({ project }: { project: Project }) {
  const {
    conversations,
    updateProject,
    deleteProject,
    addProjectKnowledge,
    deleteProjectKnowledge,
    createNewChat,
  } = useChat();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [instructions, setInstructions] = useState(project.instructions || "");
  const [isSavedInstructions, setIsSavedInstructions] = useState(true);

  // Edit project metadata modal
  const [editMetaOpen, setEditMetaOpen] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editDesc, setEditDesc] = useState(project.description);

  // Add Knowledge Modal
  const [addKnowledgeOpen, setAddKnowledgeOpen] = useState(false);
  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeContent, setKnowledgeContent] = useState("");

  // View Knowledge Item Modal
  const [viewingItem, setViewingItem] = useState<ProjectKnowledgeItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const editMetaRef = useRef<HTMLDivElement>(null);
  const addKnowledgeRef = useRef<HTMLDivElement>(null);

  useFocusTrap(editMetaRef, editMetaOpen, () => setEditMetaOpen(false));
  useFocusTrap(addKnowledgeRef, addKnowledgeOpen, () => setAddKnowledgeOpen(false));

  useEffect(() => {
    setInstructions(project.instructions || "");
    setEditName(project.name);
    setEditDesc(project.description);
  }, [project]);

  // Project-associated conversations
  const projectChats = conversations.filter((c) => c.projectId === project.id);

  const handleInstructionsChange = (val: string) => {
    setInstructions(val);
    setIsSavedInstructions(false);
  };

  const handleSaveInstructions = () => {
    updateProject(project.id, { instructions });
    setIsSavedInstructions(true);
    showToast("Project instructions saved", "success");
  };

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

  const handleAddKnowledgeText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!knowledgeTitle.trim() || !knowledgeContent.trim()) return;
    addProjectKnowledge(project.id, {
      title: knowledgeTitle.trim(),
      content: knowledgeContent.trim(),
      type: "text",
    });
    setKnowledgeTitle("");
    setKnowledgeContent("");
    setAddKnowledgeOpen(false);
    showToast("Knowledge snippet added", "success");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        addProjectKnowledge(project.id, {
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

  const handleStartProjectChat = () => {
    createNewChat(project.id);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12 font-sans">
      <div className="mx-auto w-full max-w-[840px] space-y-8 pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            <span>All Projects</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditMetaOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-1 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-2 transition-colors"
            >
              <Pencil size={13} />
              <span>Edit Details</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete project "${project.name}"?`)) {
                  deleteProject(project.id);
                  navigate("/projects");
                }
              }}
              title="Delete Project"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-elev-1 text-ink-muted hover:bg-red-500/10 hover:text-red-500 transition-colors"
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
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-medium text-white shadow-sm transition-opacity hover:opacity-90 self-start sm:self-auto"
          >
            <Plus size={16} strokeWidth={2.2} />
            <span>New Chat in Project</span>
          </button>
        </div>

        {/* SECTION 1: Custom Instructions */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <h2 className="text-[15.5px] font-medium text-ink">
                Project Instructions
              </h2>
            </div>
            {!isSavedInstructions && (
              <button
                type="button"
                onClick={handleSaveInstructions}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-[12.5px] font-medium text-white hover:opacity-90 shadow-sm"
              >
                <Check size={13} />
                <span>Save</span>
              </button>
            )}
          </div>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            Instructions given here will be automatically included in the system prompt for every conversation created in this project.
          </p>

          <div className="mt-3.5">
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              onBlur={handleSaveInstructions}
              placeholder="e.g., Focus on clean React and Tailwind CSS architecture. Always provide complete working files with comments. Adhere to our team's brand style guide."
              className="w-full resize-y rounded-lg border border-line bg-elev-2 p-3 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* SECTION 2: Project Knowledge Base */}
        <div className="rounded-xl border border-line bg-elev-1 p-5 shadow-sm">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-3 transition-colors"
              >
                <Upload size={14} />
                <span>Upload Files</span>
              </button>

              <button
                type="button"
                onClick={() => setAddKnowledgeOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 shadow-sm transition-opacity"
              >
                <Plus size={14} />
                <span>Add Snippet</span>
              </button>
            </div>
          </div>

          {/* Knowledge Items Grid */}
          <div className="mt-4">
            {!project.knowledge || project.knowledge.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[14px] text-ink-soft">
                  No knowledge items added yet.
                </p>
                <p className="mt-1 text-[12.5px] text-ink-muted">
                  Add style guides, API documentation, or reference notes to ground your chats.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {project.knowledge.map((item) => (
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
                            deleteProjectKnowledge(project.id, item.id);
                            showToast("Knowledge item deleted", "info");
                          }}
                          className="opacity-0 group-hover:opacity-100 text-ink-muted hover:text-red-500 transition-opacity p-1"
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
        </div>

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
                All conversations associated with this project.
              </p>
            </div>
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
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white hover:opacity-90 shadow-sm"
                >
                  <Plus size={14} />
                  <span>Start a Chat</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {projectChats.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/chat/${c.id}`)}
                    className="group flex items-center justify-between rounded-lg border border-line bg-elev-2 p-3.5 hover:border-accent hover:bg-elev-3 cursor-pointer transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[14.5px] font-medium text-ink truncate">
                        {c.title}
                      </h4>
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">
                        {c.messages.length} message{c.messages.length === 1 ? "" : "s"} · Updated {new Date(c.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-ink-muted group-hover:text-ink">
                      <ExternalLink size={15} />
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
            className="anim-modal-in w-full max-w-[460px] rounded-xl border border-line bg-elev-1 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-medium text-ink">Edit Project Details</h2>
              <button
                type="button"
                onClick={() => setEditMetaOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateMeta} className="mt-5 space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ink-soft">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-ink-soft">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full resize-none rounded-lg border border-line bg-elev-2 px-3 py-2 text-[14px] text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditMetaOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Knowledge Snippet Modal */}
      {addKnowledgeOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setAddKnowledgeOpen(false)}
        >
          <div
            ref={addKnowledgeRef}
            role="dialog"
            aria-modal="true"
            className="anim-modal-in w-full max-w-[500px] rounded-xl border border-line bg-elev-1 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-medium text-ink">Add Knowledge Snippet</h2>
              <button
                type="button"
                onClick={() => setAddKnowledgeOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddKnowledgeText} className="mt-5 space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ink-soft">
                  Snippet Title
                </label>
                <input
                  type="text"
                  required
                  value={knowledgeTitle}
                  onChange={(e) => setKnowledgeTitle(e.target.value)}
                  placeholder="e.g., API Guidelines, Brand Rules..."
                  className="mt-1 w-full rounded-lg border border-line bg-elev-2 px-3 py-2 text-[14px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[13px] font-medium text-ink-soft">
                  Content / Notes
                </label>
                <textarea
                  rows={6}
                  required
                  value={knowledgeContent}
                  onChange={(e) => setKnowledgeContent(e.target.value)}
                  placeholder="Paste text, code guidelines, or documentation here..."
                  className="mt-1 w-full resize-y rounded-lg border border-line bg-elev-2 px-3 py-2 text-[13.5px] font-mono text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAddKnowledgeOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-[13.5px] font-medium text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90"
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
            role="dialog"
            aria-modal="true"
            className="anim-modal-in w-full max-w-[620px] max-h-[85vh] flex flex-col rounded-xl border border-line bg-elev-1 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <FileText size={17} className="text-accent" />
                <h2 className="text-[16.5px] font-medium text-ink truncate">
                  {viewingItem.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="text-ink-muted hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto rounded-lg border border-line bg-elev-2 p-4 text-[13.5px] font-mono leading-relaxed text-ink whitespace-pre-wrap select-text">
              {viewingItem.content}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main Projects View component handling both /projects and /projects/:id
 */
export default function ProjectsView() {
  const { projects, addProject, deleteProject } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const currentProjectId = location.pathname.startsWith("/projects/")
    ? location.pathname.replace("/projects/", "")
    : null;

  const currentProject = currentProjectId
    ? projects.find((p) => p.id === currentProjectId)
    : null;

  useFocusTrap(modalRef, modalOpen, () => setModalOpen(false));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = addProject(name.trim(), description.trim() || "No description provided.");
    setName("");
    setDescription("");
    setModalOpen(false);
    navigate(`/projects/${created.id}`);
  };

  // If viewing a specific project:
  if (currentProjectId) {
    if (!currentProject) {
      return (
        <div className="flex h-full flex-col items-center justify-center py-20 text-center font-sans">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-elev-2 text-ink-muted mb-4 shadow-sm">
            <FolderGit2 size={26} strokeWidth={1.8} />
          </div>
          <h2 className="text-[20px] font-medium text-ink">Project not found</h2>
          <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-muted">
            This project may have been deleted or the link is invalid.
          </p>
          <button
            type="button"
            onClick={() => navigate("/projects")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90"
          >
            <ArrowLeft size={16} />
            <span>Back to Projects</span>
          </button>
        </div>
      );
    }

    return <ProjectDetailView project={currentProject} />;
  }

  // Projects Overview Grid (/projects)
  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12 font-sans">
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
                          deleteProject(proj.id);
                        }}
                        title="Delete project"
                        className="opacity-0 transition-opacity group-hover:opacity-100 text-ink-muted hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted text-start">
                      {proj.description}
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
