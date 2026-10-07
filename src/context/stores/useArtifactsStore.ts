import { useState, useCallback, useEffect } from "react";
import type { Artifact } from "../../types/chat";

const STORAGE_KEY_ARTIFACTS = "claude_clone_artifacts_v3";

const DEFAULT_ARTIFACTS: Artifact[] = [
  {
    id: "art-1",
    identifier: "button-component",
    title: "Button Component",
    language: "tsx",
    type: "React",
    code: `export const Button = ({ children, variant = 'primary' }) => {\n  return (\n    <button className="px-4 py-2 rounded-lg bg-accent text-white">\n      {children}\n    </button>\n  );\n};`,
    chatId: "",
    chatTitle: "Component Library",
    version: 1,
    versions: [
      {
        version: 1,
        content: `export const Button = ({ children, variant = 'primary' }) => {\n  return (\n    <button className="px-4 py-2 rounded-lg bg-accent text-white">\n      {children}\n    </button>\n  );\n};`,
        createdAt: Date.now() - 3600000 * 48,
      },
    ],
    createdAt: Date.now() - 3600000 * 48,
    updatedAt: Date.now() - 3600000 * 48,
  },
];

export function useArtifactsStore() {
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ARTIFACTS) || localStorage.getItem("claude_clone_artifacts_v2");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_ARTIFACTS;
  });

  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ARTIFACTS, JSON.stringify(artifacts));
    } catch {
      // ignore
    }
  }, [artifacts]);

  const openArtifact = useCallback(
    (art: Artifact) => {
      const existing = artifacts.find(
        (a) =>
          a.id === art.id ||
          a.identifier === art.identifier ||
          a.title.toLowerCase() === art.title.toLowerCase()
      );
      setActiveArtifact(existing || art);
      setArtifactPanelOpen(true);
    },
    [artifacts]
  );

  const closeArtifact = useCallback(() => {
    setArtifactPanelOpen(false);
  }, []);

  const updateActiveArtifactLive = useCallback(
    (title: string, code: string) => {
      setActiveArtifact((curr) => {
        if (!curr) return null;
        if (curr.title.toLowerCase() === title.toLowerCase()) {
          return { ...curr, code };
        }
        return curr;
      });
    },
    []
  );

  const saveOrUpdateArtifact = useCallback(
    (
      title: string,
      language: string,
      type: string,
      code: string,
      chatId = "",
      chatTitle = ""
    ) => {
      const existing = artifacts.find(
        (a) => a.title.toLowerCase() === title.toLowerCase()
      );

      if (existing) {
        if (existing.code === code) {
          return existing;
        }

        const nextVersion = (existing.version || 1) + 1;
        const initialVersions =
          existing.versions && existing.versions.length > 0
            ? existing.versions
            : [{ version: 1, content: existing.code, createdAt: existing.createdAt }];

        const updatedVersions = [
          ...initialVersions,
          { version: nextVersion, content: code, createdAt: Date.now() },
        ];
        const updated: Artifact = {
          ...existing,
          code,
          version: nextVersion,
          versions: updatedVersions,
          chatId: chatId || existing.chatId,
          chatTitle: chatTitle || existing.chatTitle,
          updatedAt: Date.now(),
        };
        setArtifacts((prev) =>
          prev.map((a) => (a.id === existing.id ? updated : a))
        );
        if (
          activeArtifact?.id === existing.id ||
          activeArtifact?.title.toLowerCase() === title.toLowerCase()
        ) {
          setActiveArtifact(updated);
        }
        return updated;
      } else {
        const created: Artifact = {
          id: `art-${Date.now()}`,
          identifier: title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          title,
          language,
          type,
          code,
          chatId,
          chatTitle,
          version: 1,
          versions: [{ version: 1, content: code, createdAt: Date.now() }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setArtifacts((prev) => [created, ...prev]);
        return created;
      }
    },
    [artifacts, activeArtifact]
  );

  const setArtifactVersion = useCallback(
    (artifactId: string, version: number) => {
      setArtifacts((prev) =>
        prev.map((a) => {
          if (a.id !== artifactId) return a;
          const foundVer = a.versions?.find((v) => v.version === version);
          if (!foundVer) return a;
          const updated = {
            ...a,
            version,
            code: foundVer.content,
          };
          if (activeArtifact?.id === artifactId) {
            setActiveArtifact(updated);
          }
          return updated;
        })
      );
    },
    [activeArtifact]
  );

  const deleteArtifact = useCallback((id: string) => {
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    setActiveArtifact((curr) => (curr?.id === id ? null : curr));
  }, []);

  const clearArtifacts = useCallback(() => {
    setArtifacts([]);
    setActiveArtifact(null);
    setArtifactPanelOpen(false);
    localStorage.removeItem(STORAGE_KEY_ARTIFACTS);
  }, []);

  return {
    artifacts,
    activeArtifact,
    artifactPanelOpen,
    openArtifact,
    closeArtifact,
    saveOrUpdateArtifact,
    updateActiveArtifactLive,
    setArtifactVersion,
    deleteArtifact,
    clearArtifacts,
  };
}
