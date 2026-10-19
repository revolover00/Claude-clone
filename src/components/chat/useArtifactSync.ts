import { useEffect } from "react";
import type { Message, Artifact } from "../../types/chat";

interface ArtifactSyncOptions {
  message: Message;
  detected: any;
  conversationId: string;
  artifactPanelOpen: boolean;
  activeArtifact: Artifact | null;
  openArtifact: (art: Artifact) => void;
  updateActiveArtifactLive: (title: string, code: string, isStreaming?: boolean) => void;
  saveOrUpdateArtifact: (title: string, language: string, type: string, code: string, chatId?: string, chatTitle?: string) => Artifact;
}

export function useArtifactSync({
  message,
  detected,
  conversationId,
  artifactPanelOpen,
  activeArtifact,
  openArtifact,
  updateActiveArtifactLive,
  saveOrUpdateArtifact,
}: ArtifactSyncOptions) {
  useEffect(() => {
    if (message.isStreaming && detected?.code && detected.title) {
      const art: Artifact = {
        id: `art-${detected.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        identifier: detected.title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        title: detected.title,
        language: detected.language,
        type: detected.type,
        code: detected.code,
        chatId: conversationId,
        chatTitle: "",
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isStreaming: true,
      };

      if (!artifactPanelOpen || !activeArtifact || activeArtifact.title.toLowerCase() !== detected.title.toLowerCase()) {
        openArtifact(art);
      } else {
        updateActiveArtifactLive(detected.title, detected.code, true);
      }
    }
  }, [message.isStreaming, detected, artifactPanelOpen, activeArtifact, openArtifact, updateActiveArtifactLive, conversationId]);

  useEffect(() => {
    if (detected && !message.isStreaming && detected.code) {
      saveOrUpdateArtifact(detected.title, detected.language, detected.type, detected.code, conversationId);
      updateActiveArtifactLive(detected.title, detected.code, false);
    }
  }, [detected, message.isStreaming, saveOrUpdateArtifact, updateActiveArtifactLive, conversationId]);
}
