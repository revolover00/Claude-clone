import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProjectsGrid from "../projects/ProjectsGrid";
import ProjectDetail from "../projects/ProjectDetail";
import NewProjectModal from "../projects/NewProjectModal";
import { useChat } from "../../context/ChatContext";

export default function ProjectsView() {
  const location = useLocation();
  const navigate = useNavigate();
  const { projects, addProject, deleteProject } = useChat();

  const [modalOpen, setModalOpen] = useState(false);

  // Check if viewing a specific project: /projects/:id
  const match = location.pathname.match(/^\/projects\/([^/]+)/);
  const projectId = match ? match[1] : null;
  const currentProject = projectId
    ? projects.find((p) => p.id === projectId)
    : null;

  const handleCreate = (name: string, description: string) => {
    const newProj = addProject(name, description);
    navigate(`/projects/${newProj.id}`);
  };

  // If URL has /projects/:id, render ProjectDetail view
  if (currentProject) {
    return <ProjectDetail project={currentProject} />;
  }

  // Otherwise render all projects grid
  return (
    <>
      <ProjectsGrid
        projects={projects}
        onOpenNewModal={() => setModalOpen(true)}
        onDeleteProject={deleteProject}
      />

      <NewProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
