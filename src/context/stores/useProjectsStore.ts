import { useState, useCallback, useEffect } from "react";
import type { Project, ProjectKnowledgeItem } from "../../types/chat";

const STORAGE_KEY_PROJECTS = "claude_clone_projects_v3";

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Design System",
    description: "Reusable UI components, icons, and styling guidelines.",
    instructions:
      "Always adhere to Claude design principles: warm tones, elegant serif headers, minimalist borders, and logical layout classes.",
    knowledge: [
      {
        id: "know-1",
        title: "Brand Style Guide",
        content:
          "Colors: Background #211f1d, Accent #d97757, Text #edeae4. Fonts: Inter (sans) & Source Serif 4 (serif).",
        type: "text",
        createdAt: Date.now() - 3600000 * 24,
      },
    ],
    updatedAt: Date.now() - 3600000 * 24,
  },
  {
    id: "proj-2",
    name: "API Integration",
    description: "Backend architecture, schemas, and endpoint definitions.",
    instructions:
      "Write clean, type-safe Express & Gemini TypeScript routes with robust error handling and streaming SSE format.",
    knowledge: [],
    updatedAt: Date.now() - 3600000 * 72,
  },
];

export function useProjectsStore() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_PROJECTS) ||
        localStorage.getItem("claude_clone_projects_v2");
      if (saved) return JSON.parse(saved);
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
