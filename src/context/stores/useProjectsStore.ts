import { useState, useCallback, useEffect } from "react";
import type { Project, ProjectKnowledgeItem } from "../../types/chat";

const STORAGE_KEY_PROJECTS = "claude_clone_projects_v3";

const DEFAULT_PROJECTS: Project[] = [];

export function useProjectsStore() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_PROJECTS) ||
        localStorage.getItem("claude_clone_projects_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out seeded demo projects
          return parsed.filter((p: Project) => p.id !== "proj-1" && p.id !== "proj-2");
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_PROJECTS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  const addProject = useCallback((name: string, description: string) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      description,
      instructions: "",
      knowledge: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects((prev) => [newProj, ...prev]);
    return newProj;
  }, []);

  const updateProject = useCallback((id: string, partial: Partial<Project>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...partial, updatedAt: Date.now() } : p
      )
    );
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addProjectKnowledge = useCallback(
    (
      projectId: string,
      item: Omit<ProjectKnowledgeItem, "id" | "createdAt">
    ) => {
      const newItem: ProjectKnowledgeItem = {
        ...item,
        id: `know-${Date.now()}`,
        createdAt: Date.now(),
      };
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                knowledge: [newItem, ...(p.knowledge || [])],
                updatedAt: Date.now(),
              }
            : p
        )
      );
    },
    []
  );

  const deleteProjectKnowledge = useCallback(
    (projectId: string, knowledgeId: string) => {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                knowledge: (p.knowledge || []).filter((k) => k.id !== knowledgeId),
                updatedAt: Date.now(),
              }
            : p
        )
      );
    },
    []
  );

  const clearProjects = useCallback(() => {
    setProjects([]);
    localStorage.removeItem(STORAGE_KEY_PROJECTS);
  }, []);

  return {
    projects,
    addProject,
    updateProject,
    deleteProject,
    addProjectKnowledge,
    deleteProjectKnowledge,
    clearProjects,
  };
}
