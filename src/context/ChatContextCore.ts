import { createContext, useContext } from "react";
import type {
  Conversation,
  Message,
  Project,
  ProjectKnowledgeItem,
  Artifact,
  UserPreferences,
} from "../types/chat";
import type { ActiveView } from "./stores/useUIStore";

export interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  activeBranch: Message[];
  setActiveConversationId: (id: string | null) => void;
  createNewChat: (projectId?: string | null, isIncognito?: boolean) => void;
  saveMessage: (conversationId: string, message: Message, projectId?: string | null, isIncognito?: boolean) => void;
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
    isSearchingWeb?: boolean,
    timing?: { thinkingStartedAt?: number; firstTokenAt?: number; thinkingMs?: number },
    isReconnecting?: boolean,
    finishReason?: string,
    extra?: { extendedThinking?: boolean; thinkingPlan?: { level: "low" | "medium" | "high"; reason?: string } }
  ) => void;
  deleteConversation: (id: string) => void;
  toggleStar: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  triggerAutoTitle: (conversationId: string, firstUserMsg: string, firstReply: string) => Promise<void>;
  switchMessageVersion: (conversationId: string, messageId: string, targetVersionIndex: number) => void;
  branchEditUserMessage: (conversationId: string, targetMessageId: string, newContent: string) => { newUserMsg: Message; newAssistantMsg: Message } | null;
  branchRetryAssistantMessage: (conversationId: string, assistantMessageId: string) => { parentUserMsg: Message; newAssistantMsg: Message } | null;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  searchModalOpen: boolean;
  setSearchModalOpen: (open: boolean) => void;
  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => void;
  projects: Project[];
  addProject: (name: string, description: string) => Project;
  updateProject: (id: string, partial: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addProjectKnowledge: (projectId: string, item: Omit<ProjectKnowledgeItem, "id" | "createdAt">) => void;
  deleteProjectKnowledge: (projectId: string, knowledgeId: string) => void;
  artifacts: Artifact[];
  activeArtifact: Artifact | null;
  artifactPanelOpen: boolean;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  saveOrUpdateArtifact: (title: string, language: string, type: string, code: string, chatId?: string, chatTitle?: string) => Artifact;
  updateActiveArtifactLive: (title: string, code: string, isStreaming?: boolean) => void;
  setArtifactVersion: (artifactId: string, version: number) => void;
  deleteArtifact: (id: string) => void;
  clearAllData: () => void;
  activeQuote: string | null;
  setActiveQuote: (quote: string | null) => void;
  generatingChatIds: Set<string>;
  registerActiveStream: (chatId: string, abortCtrl: AbortController) => void;
  unregisterActiveStream: (chatId: string) => void;
  stopActiveStream: (chatId: string) => void;
}

export const ChatContext = createContext<ChatContextType | null>(null);

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
};
