import { useState, useCallback, useEffect } from "react";
import type { Artifact } from "../../types/chat";

const STORAGE_KEY_ARTIFACTS = "claude_clone_artifacts_v3";

const DEFAULT_ARTIFACTS: Artifact[] = [];

export function useArtifactsStore() {
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ARTIFACTS) || localStorage.getItem("claude_clone_artifacts_v2");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((a: Artifact) => a.id !== "art-1");
        }
      }
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
    (title: string, code: string, isStreaming = true) => {
      setActiveArtifact((curr) => {
        if (!curr) return null;
        if (curr.title.toLowerCase() === title.toLowerCase()) {
          return { ...curr, code, isStreaming };
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
