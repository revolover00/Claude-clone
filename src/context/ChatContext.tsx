import React, {
  useReducer,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type {
  Message,
} from "../types/chat";
import { conversationsReducer } from "./stores/conversationsReducer";
import {
  getActiveBranch,
  getMessageSiblings,
  migrateConversations,
  createEditUserBranch,
  createRetryAssistantBranch,
} from "./stores/conversationsHelpers";
import { useArtifactsStore } from "./stores/useArtifactsStore";
import { usePreferencesStore } from "./stores/usePreferencesStore";
import { useProjectsStore } from "./stores/useProjectsStore";
import { useUIStore, type ActiveView } from "./stores/useUIStore";
import { runAutoTitle } from "./stores/autoTitleHelper";
import { useChatKeyboardShortcuts } from "./useChatKeyboardShortcuts";
import { ChatContext, type ChatContextType, useChat } from "./ChatContextCore";

export { getActiveBranch, getMessageSiblings, migrateConversations, useChat };
export type { ActiveView, ChatContextType };

const STORAGE_KEY_CONVS = "claude_clone_conversations_v3";

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations]);

  const [activeQuote, setActiveQuote] = useState<string | null>(null);
  const ui = useUIStore();
  const artifactsStore = useArtifactsStore();
  const preferencesStore = usePreferencesStore();
  const projectsStore = useProjectsStore();

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === ui.activeConversationId) || null;
  }, [conversations, ui.activeConversationId]);

  const activeBranch = useMemo(() => {
    return getActiveBranch(activeConversation?.messages || [], activeConversation?.rootMessageId);
  }, [activeConversation]);

  const saveMessage = useCallback((conversationId: string, message: Message, projectId?: string | null) => {
    dispatch({ type: "SAVE_MESSAGE", conversationId, message, projectId });
  }, []);

  const setConversationMessages = useCallback((conversationId: string, messages: Message[]) => {
    dispatch({ type: "SET_CONVERSATION_MESSAGES", conversationId, messages });
  }, []);

  const updateMessageContent = useCallback((
    conversationId: string,
    messageId: string,
    content: string,
    isStreaming = false,
    isThinking = false,
    thinking?: string,
    errorInfo?: { isError?: boolean; errorText?: string; errorDetails?: string },
    sources?: Array<{ title: string; url: string }>,
    isSearchingWeb?: boolean,
    timing?: { thinkingStartedAt?: number; firstTokenAt?: number; thinkingMs?: number },
    isReconnecting?: boolean,
    finishReason?: string
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
      thinkingStartedAt: timing?.thinkingStartedAt,
      firstTokenAt: timing?.firstTokenAt,
      thinkingMs: timing?.thinkingMs,
      isReconnecting,
      finishReason,
    });
  }, []);

  const switchMessageVersion = useCallback((conversationId: string, messageId: string, targetVersionIndex: number) => {
    dispatch({ type: "SWITCH_VERSION", conversationId, messageId, targetVersionIndex });
  }, []);

  const branchEditUserMessage = useCallback((conversationId: string, targetMessageId: string, newContent: string) => {
    const res = createEditUserBranch(conversations, conversationId, targetMessageId, newContent);
    if (!res) return null;
    const { newUserMsg, newAssistantMsg, parentId } = res;
    dispatch({ type: "BRANCH_EDIT_USER", conversationId, newUserMsg, newAssistantMsg, parentId });
    return { newUserMsg, newAssistantMsg };
  }, [conversations]);

  const branchRetryAssistantMessage = useCallback((conversationId: string, assistantMessageId: string) => {
    const res = createRetryAssistantBranch(conversations, conversationId, assistantMessageId);
    if (!res) return null;
    const { parentUserMsg, newAssistantMsg, parentUserMsgId } = res;
    dispatch({ type: "BRANCH_RETRY_ASSISTANT", conversationId, newAssistantMsg, parentUserMsgId });
    return { parentUserMsg, newAssistantMsg };
  }, [conversations]);

  const deleteConversation = useCallback((id: string) => {
    dispatch({ type: "DELETE_CONVERSATION", id });
    if (ui.activeConversationId === id) ui.setActiveConversationId(null);
  }, [ui]);

  const toggleStar = useCallback((id: string) => dispatch({ type: "TOGGLE_STAR", id }), []);
  const renameConversation = useCallback((id: string, newTitle: string) => dispatch({ type: "RENAME_CONVERSATION", id, newTitle }), []);

  const triggerAutoTitle = useCallback(async (conversationId: string, firstUserMsg: string, firstReply: string) => {
    await runAutoTitle(conversationId, firstUserMsg, firstReply, dispatch);
  }, []);

  const clearAllData = useCallback(() => {
    dispatch({ type: "SET_ALL", conversations: [] });
    ui.setActiveConversationId(null);
    projectsStore.clearProjects();
    artifactsStore.clearArtifacts();
    localStorage.removeItem(STORAGE_KEY_CONVS);
  }, [ui, projectsStore, artifactsStore]);

  const [generatingChatIds, setGeneratingChatIds] = useState<Set<string>>(new Set());
  const activeStreamsRef = useRef<Map<string, AbortController>>(new Map());

  const registerActiveStream = useCallback((chatId: string, abortCtrl: AbortController) => {
    activeStreamsRef.current.set(chatId, abortCtrl);
    setGeneratingChatIds((prev) => {
      const next = new Set(prev);
      next.add(chatId);
      return next;
    });
  }, []);

  const unregisterActiveStream = useCallback((chatId: string) => {
    activeStreamsRef.current.delete(chatId);
    setGeneratingChatIds((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  }, []);

  const stopActiveStream = useCallback((chatId: string) => {
    const ctrl = activeStreamsRef.current.get(chatId);
    if (ctrl) ctrl.abort();
    unregisterActiveStream(chatId);
  }, [unregisterActiveStream]);

  useChatKeyboardShortcuts(ui);

  const value = useMemo<ChatContextType>(() => ({
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
    activeQuote,
    setActiveQuote,
    generatingChatIds,
    registerActiveStream,
    unregisterActiveStream,
    stopActiveStream,
  }), [
    conversations, ui.activeConversationId, activeConversation, activeBranch, ui.setActiveConversationId,
    ui.createNewChat, saveMessage, setConversationMessages, updateMessageContent, deleteConversation,
    toggleStar, renameConversation, triggerAutoTitle, switchMessageVersion, branchEditUserMessage,
    branchRetryAssistantMessage, ui.canGoBack, ui.canGoForward, ui.goBack, ui.goForward, ui.activeView,
    ui.setActiveView, ui.searchModalOpen, ui.setSearchModalOpen, ui.settingsModalOpen, ui.setSettingsModalOpen,
    preferencesStore.preferences, preferencesStore.updatePreferences, projectsStore.projects,
    projectsStore.addProject, projectsStore.updateProject, projectsStore.deleteProject,
    projectsStore.addProjectKnowledge, projectsStore.deleteProjectKnowledge, artifactsStore.artifacts,
    artifactsStore.activeArtifact, artifactsStore.artifactPanelOpen, artifactsStore.openArtifact,
    artifactsStore.closeArtifact, artifactsStore.saveOrUpdateArtifact, artifactsStore.updateActiveArtifactLive,
    artifactsStore.setArtifactVersion, artifactsStore.deleteArtifact, clearAllData, activeQuote,
    setActiveQuote, generatingChatIds, registerActiveStream, unregisterActiveStream, stopActiveStream,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
