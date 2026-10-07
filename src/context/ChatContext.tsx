import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type {
  Conversation,
  Message,
  Project,
  ProjectKnowledgeItem,
  Artifact,
  UserPreferences,
} from "../types/chat";
import {
  conversationsReducer,
  getActiveBranch,
  getMessageSiblings,
  migrateConversations,
} from "./stores/conversationsReducer";
import { useArtifactsStore } from "./stores/useArtifactsStore";
import { usePreferencesStore } from "./stores/usePreferencesStore";
import { useProjectsStore } from "./stores/useProjectsStore";
import { useUIStore, type ActiveView } from "./stores/useUIStore";

export { getActiveBranch, getMessageSiblings, migrateConversations };
export type { ActiveView };

export interface ChatContextType {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  activeBranch: Message[];
  setActiveConversationId: (id: string | null) => void;
  createNewChat: (projectId?: string | null) => void;
  saveMessage: (conversationId: string, message: Message, projectId?: string | null) => void;
  setConversationMessages: (conversationId: string, messages: Message[]) => void;
  updateMessageContent: (
    conversationId: string,
    messageId: string,
    content: string,
    isStreaming?: boolean,
    isThinking?: boolean,
    thinking?: string,
    errorInfo?: { isError?: boolean; errorText?: string; errorDetails?: string },
    sources?: Array<{ title: string; url: string }>,
    isSearchingWeb?: boolean
  ) => void;
  deleteConversation: (id: string) => void;
  toggleStar: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  triggerAutoTitle: (conversationId: string, firstUserMsg: string, firstReply: string) => Promise<void>;

  // Message Branching & Versioning
  switchMessageVersion: (conversationId: string, messageId: string, targetVersionIndex: number) => void;
  branchEditUserMessage: (
    conversationId: string,
    targetMessageId: string,
    newContent: string
  ) => { newUserMsg: Message; newAssistantMsg: Message } | null;
  branchRetryAssistantMessage: (
    conversationId: string,
    assistantMessageId: string
  ) => { parentUserMsg: Message; newAssistantMsg: Message } | null;

  // History navigation
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;

  // Views & Routing
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Search Modal
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;

  // Settings Modal
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;

  // User Preferences
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;

  // Projects
  projects: Project[];
  addProject: (name: string, description: string) => Project;
  updateProject: (id: string, partial: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addProjectKnowledge: (
    projectId: string,
    item: Omit<ProjectKnowledgeItem, "id" | "createdAt">
  ) => void;
  deleteProjectKnowledge: (projectId: string, knowledgeId: string) => void;

  // Artifacts
  artifacts: Artifact[];
  activeArtifact: Artifact | null;
  artifactPanelOpen: boolean;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  saveOrUpdateArtifact: (
    title: string,
    language: string,
    type: string,
    code: string,
    chatId?: string,
    chatTitle?: string
  ) => Artifact;
  updateActiveArtifactLive: (title: string, code: string) => void;
  setArtifactVersion: (artifactId: string, version: number) => void;
  deleteArtifact: (id: string) => void;
  clearAllData: () => void;
}

const STORAGE_KEY_CONVS = "claude_clone_conversations_v3";

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial conversations with automatic migration
  const [conversations, dispatch] = useReducer(conversationsReducer, [], () => {
    try {
      const savedV3 = localStorage.getItem(STORAGE_KEY_CONVS);
      if (savedV3) return migrateConversations(JSON.parse(savedV3));

      const savedV2 = localStorage.getItem("claude_clone_conversations_v2");
      if (savedV2) return migrateConversations(JSON.parse(savedV2));
    } catch {
      // ignore
    }
    return [];
  });

  // Save conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations]);

  // Hook stores
  const ui = useUIStore();
  const artifactsStore = useArtifactsStore();
  const preferencesStore = usePreferencesStore();
  const projectsStore = useProjectsStore();

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === ui.activeConversationId) || null;
  }, [conversations, ui.activeConversationId]);

  const activeBranch = useMemo(() => {
    return getActiveBranch(
      activeConversation?.messages || [],
      activeConversation?.rootMessageId
    );
  }, [activeConversation]);

  const saveMessage = useCallback(
    (conversationId: string, message: Message, projectId?: string | null) => {
      dispatch({
        type: "SAVE_MESSAGE",
        conversationId,
        message,
        projectId,
      });
    },
    []
  );

  const setConversationMessages = useCallback(
    (conversationId: string, messages: Message[]) => {
      dispatch({
        type: "SET_CONVERSATION_MESSAGES",
        conversationId,
        messages,
      });
    },
    []
  );

  const updateMessageContent = useCallback(
    (
      conversationId: string,
      messageId: string,
      content: string,
      isStreaming = false,
      isThinking = false,
      thinking?: string,
      errorInfo?: { isError?: boolean; errorText?: string; errorDetails?: string },
      sources?: Array<{ title: string; url: string }>,
      isSearchingWeb?: boolean
    ) => {
      dispatch({
        type: "UPDATE_MESSAGE_CONTENT",
        conversationId,
        messageId,
        content,
        isStreaming,
        isThinking,
        thinking,
        isError: errorInfo?.isError,
        errorText: errorInfo?.errorText,
        errorDetails: errorInfo?.errorDetails,
        sources,
        isSearchingWeb,
      });
    },
    []
  );

  const switchMessageVersion = useCallback(
    (conversationId: string, messageId: string, targetVersionIndex: number) => {
      dispatch({
        type: "SWITCH_VERSION",
        conversationId,
        messageId,
        targetVersionIndex,
      });
    },
    []
  );

  const branchEditUserMessage = useCallback(
    (conversationId: string, targetMessageId: string, newContent: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return null;
      const targetMsg = conv.messages.find((m) => m.id === targetMessageId);
      if (!targetMsg) return null;

      const parentId = targetMsg.parentId || null;
      const newUserMsgId = `u-${Date.now()}`;
      const newAssistantMsgId = `a-${Date.now()}`;

      const newUserMsg: Message = {
        id: newUserMsgId,
        parentId,
        activeChildId: newAssistantMsgId,
        childrenIds: [newAssistantMsgId],
        role: "user",
        content: newContent,
        attachments: targetMsg.attachments,
        createdAt: Date.now(),
      };

      const newAssistantMsg: Message = {
        id: newAssistantMsgId,
        parentId: newUserMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        createdAt: Date.now(),
      };

      dispatch({
        type: "BRANCH_EDIT_USER",
        conversationId,
        newUserMsg,
        newAssistantMsg,
        parentId,
      });

      return { newUserMsg, newAssistantMsg };
    },
    [conversations]
  );

  const branchRetryAssistantMessage = useCallback(
    (conversationId: string, assistantMessageId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return null;
      const targetAssistant = conv.messages.find((m) => m.id === assistantMessageId);
      if (!targetAssistant || !targetAssistant.parentId) return null;

      const parentUserMsgId = targetAssistant.parentId;
      const parentUserMsg = conv.messages.find((m) => m.id === parentUserMsgId);
      if (!parentUserMsg) return null;

      const newAssistantMsgId = `a-${Date.now()}`;
      const newAssistantMsg: Message = {
        id: newAssistantMsgId,
        parentId: parentUserMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        createdAt: Date.now(),
      };

      dispatch({
        type: "BRANCH_RETRY_ASSISTANT",
        conversationId,
        newAssistantMsg,
        parentUserMsgId,
      });

      return { parentUserMsg, newAssistantMsg };
    },
    [conversations]
  );

  const deleteConversation = useCallback(
    (id: string) => {
      dispatch({ type: "DELETE_CONVERSATION", id });
      if (ui.activeConversationId === id) {
        ui.setActiveConversationId(null);
      }
    },
    [ui]
  );

  const toggleStar = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_STAR", id });
  }, []);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    dispatch({ type: "RENAME_CONVERSATION", id, newTitle });
  }, []);

  const triggerAutoTitle = useCallback(
    async (conversationId: string, firstUserMsg: string, firstReply: string) => {
      let targetTitle = "New conversation";
      try {
        const res = await fetch("/api/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firstUserMsg, firstReply }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.title) {
            targetTitle = data.title;
          }
        }
      } catch (err) {
        console.error("Auto-title error:", err);
        const trimmed = firstUserMsg.trim();
        targetTitle = trimmed.length <= 36 ? trimmed : trimmed.slice(0, 36) + "...";
      }

      dispatch({
        type: "SET_TYPING_TITLE",
        conversationId,
        title: "",
        isTypingTitle: true,
      });

      for (let i = 1; i <= targetTitle.length; i++) {
        await new Promise((r) => setTimeout(r, 22));
        const partial = targetTitle.slice(0, i);
        dispatch({
          type: "SET_TYPING_TITLE",
          conversationId,
          title: partial,
          isTypingTitle: true,
        });
      }

      dispatch({
        type: "SET_TYPING_TITLE",
        conversationId,
        title: targetTitle,
        isTypingTitle: false,
      });
    },
    []
  );

  const clearAllData = useCallback(() => {
    dispatch({ type: "SET_ALL", conversations: [] });
    ui.setActiveConversationId(null);
    projectsStore.clearProjects();
    artifactsStore.clearArtifacts();
    localStorage.removeItem(STORAGE_KEY_CONVS);
  }, [ui, projectsStore, artifactsStore]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ui.setSearchModalOpen(!ui.searchModalOpen);
      }

      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        ui.createNewChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ui]);

  const value = useMemo<ChatContextType>(
    () => ({
      conversations,
      activeConversationId: ui.activeConversationId,
      activeConversation,
      activeBranch,
      setActiveConversationId: ui.setActiveConversationId,
      createNewChat: ui.createNewChat,
      saveMessage,
      setConversationMessages,
      updateMessageContent,
      deleteConversation,
      toggleStar,
      renameConversation,
      triggerAutoTitle,
      switchMessageVersion,
      branchEditUserMessage,
      branchRetryAssistantMessage,
      canGoBack: ui.canGoBack,
      canGoForward: ui.canGoForward,
      goBack: ui.goBack,
      goForward: ui.goForward,
      activeView: ui.activeView,
      setActiveView: ui.setActiveView,
      searchModalOpen: ui.searchModalOpen,
      setSearchModalOpen: ui.setSearchModalOpen,
      settingsModalOpen: ui.settingsModalOpen,
      setSettingsModalOpen: ui.setSettingsModalOpen,
      preferences: preferencesStore.preferences,
      updatePreferences: preferencesStore.updatePreferences,
      projects: projectsStore.projects,
      addProject: projectsStore.addProject,
      updateProject: projectsStore.updateProject,
      deleteProject: projectsStore.deleteProject,
      addProjectKnowledge: projectsStore.addProjectKnowledge,
      deleteProjectKnowledge: projectsStore.deleteProjectKnowledge,
      artifacts: artifactsStore.artifacts,
      activeArtifact: artifactsStore.activeArtifact,
      artifactPanelOpen: artifactsStore.artifactPanelOpen,
      openArtifact: artifactsStore.openArtifact,
      closeArtifact: artifactsStore.closeArtifact,
      saveOrUpdateArtifact: artifactsStore.saveOrUpdateArtifact,
      updateActiveArtifactLive: artifactsStore.updateActiveArtifactLive,
      setArtifactVersion: artifactsStore.setArtifactVersion,
      deleteArtifact: artifactsStore.deleteArtifact,
      clearAllData,
    }),
    [
      conversations,
      ui.activeConversationId,
      activeConversation,
      activeBranch,
      ui.setActiveConversationId,
      ui.createNewChat,
      saveMessage,
      setConversationMessages,
      updateMessageContent,
      deleteConversation,
      toggleStar,
      renameConversation,
      triggerAutoTitle,
      switchMessageVersion,
      branchEditUserMessage,
      branchRetryAssistantMessage,
      ui.canGoBack,
      ui.canGoForward,
      ui.goBack,
      ui.goForward,
      ui.activeView,
      ui.setActiveView,
      ui.searchModalOpen,
      ui.setSearchModalOpen,
      ui.settingsModalOpen,
      ui.setSettingsModalOpen,
      preferencesStore.preferences,
      preferencesStore.updatePreferences,
      projectsStore.projects,
      projectsStore.addProject,
      projectsStore.updateProject,
      projectsStore.deleteProject,
      projectsStore.addProjectKnowledge,
      projectsStore.deleteProjectKnowledge,
      artifactsStore.artifacts,
      artifactsStore.activeArtifact,
      artifactsStore.artifactPanelOpen,
      artifactsStore.openArtifact,
      artifactsStore.closeArtifact,
      artifactsStore.saveOrUpdateArtifact,
      artifactsStore.updateActiveArtifactLive,
      artifactsStore.setArtifactVersion,
      artifactsStore.deleteArtifact,
      clearAllData,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
};
