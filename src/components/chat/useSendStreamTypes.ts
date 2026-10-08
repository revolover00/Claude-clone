import type { Message, Project } from "../../types/chat";
import type { SmoothStreamer } from "../../utils/smoothStreamer";

export interface SendStreamOptions {
  activeConversationId: string | null;
  activeConversation: any;
  activeBranch: Message[];
  saveMessage: (conversationId: string, message: Message, projectId?: string | null) => void;
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
    finishReason?: string
  ) => void;
  setActiveConversationId: (id: string | null) => void;
  triggerAutoTitle: (conversationId: string, firstUserMsg: string, firstReply: string) => Promise<void>;
  preferences: any;
  currentProject: Project | undefined;
  registerActiveStream: (chatId: string, abortCtrl: AbortController) => void;
  unregisterActiveStream: (chatId: string) => void;
  scrollToBottom: (smooth: boolean) => void;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  abortRef: React.RefObject<AbortController | null>;
  streamerRef: React.RefObject<SmoothStreamer | null>;
  setComposerInitial: (val: string) => void;
}
