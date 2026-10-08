import type { Conversation, Message } from "../../types/chat";
import { getActiveBranch, getMessageSiblings, migrateConversations } from "./conversationsHelpers";

export { getActiveBranch, getMessageSiblings, migrateConversations };

export type ConversationAction =
  | { type: "SET_ALL"; conversations: Conversation[] }
  | {
      type: "SAVE_MESSAGE";
      conversationId: string;
      message: Message;
      projectId?: string | null;
    }
  | {
      type: "SET_CONVERSATION_MESSAGES";
      conversationId: string;
      messages: Message[];
    }
  | {
      type: "UPDATE_MESSAGE_CONTENT";
      conversationId: string;
      messageId: string;
      content: string;
      isStreaming?: boolean;
      isThinking?: boolean;
      isReconnecting?: boolean;
      thinking?: string;
      isError?: boolean;
      errorText?: string;
      errorDetails?: string;
      sources?: Array<{ title: string; url: string }>;
      isSearchingWeb?: boolean;
      thinkingStartedAt?: number;
      firstTokenAt?: number;
      thinkingMs?: number;
      finishReason?: string;
    }
  | {
      type: "SWITCH_VERSION";
      conversationId: string;
      messageId: string;
      targetVersionIndex: number;
    }
  | {
      type: "BRANCH_EDIT_USER";
      conversationId: string;
      newUserMsg: Message;
      newAssistantMsg: Message;
      parentId: string | null;
    }
  | {
      type: "BRANCH_RETRY_ASSISTANT";
      conversationId: string;
      newAssistantMsg: Message;
      parentUserMsgId: string;
    }
  | { type: "DELETE_CONVERSATION"; id: string }
  | { type: "TOGGLE_STAR"; id: string }
  | { type: "RENAME_CONVERSATION"; id: string; newTitle: string }
  | {
      type: "SET_TYPING_TITLE";
      conversationId: string;
      title: string;
      isTypingTitle: boolean;
    };

export function conversationsReducer(
  state: Conversation[],
  action: ConversationAction
): Conversation[] {
  switch (action.type) {
    case "SET_ALL":
      return action.conversations;

    case "SAVE_MESSAGE": {
      const { conversationId, message, projectId } = action;
      const existing = state.find((c) => c.id === conversationId);

      if (existing) {
        const currentBranch = getActiveBranch(existing.messages, existing.rootMessageId);
        const lastActive = currentBranch[currentBranch.length - 1];
        const parentId = message.parentId !== undefined ? message.parentId : (lastActive?.id || null);

        const nodeToSave: Message = {
          ...message,
          parentId,
        };

        const updatedMessages = existing.messages.map((m) => {
          if (parentId && m.id === parentId) {
            return {
              ...m,
              activeChildId: message.id,
              childrenIds: Array.from(new Set([...(m.childrenIds || []), message.id])),
            };
          }
          return m;
        });

        return state.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messages: [...updatedMessages, nodeToSave],
                updatedAt: Date.now(),
              }
            : c
        );
      } else {
        const title =
          message.content.length > 40
            ? message.content.slice(0, 40) + "..."
            : message.content || "New conversation";

        const rootNode: Message = {
          ...message,
          parentId: null,
        };

        const newConv: Conversation = {
          id: conversationId,
          title,
          projectId: projectId || null,
          rootMessageId: rootNode.id,
          messages: [rootNode],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          starred: false,
        };
        return [newConv, ...state];
      }
    }

    case "SET_CONVERSATION_MESSAGES":
      return state.map((c) =>
        c.id === action.conversationId
          ? { ...c, messages: action.messages, updatedAt: Date.now() }
          : c
      );

    case "UPDATE_MESSAGE_CONTENT": {
      return state.map((c) => {
        if (c.id !== action.conversationId) return c;
        const updatedMessages = c.messages.map((m) => {
          if (m.id !== action.messageId) return m;
          return {
            ...m,
            content: action.content,
            isStreaming: action.isStreaming ?? false,
            isThinking: action.isThinking ?? false,
            ...(action.isReconnecting !== undefined ? { isReconnecting: action.isReconnecting } : {}),
            ...(action.thinking !== undefined ? { thinking: action.thinking } : {}),
            ...(action.isError !== undefined ? { isError: action.isError } : {}),
            ...(action.errorText !== undefined ? { errorText: action.errorText } : {}),
            ...(action.errorDetails !== undefined ? { errorDetails: action.errorDetails } : {}),
            ...(action.sources !== undefined ? { sources: action.sources } : {}),
            ...(action.isSearchingWeb !== undefined ? { isSearchingWeb: action.isSearchingWeb } : {}),
            ...(action.thinkingStartedAt !== undefined ? { thinkingStartedAt: action.thinkingStartedAt } : {}),
            ...(action.firstTokenAt !== undefined ? { firstTokenAt: action.firstTokenAt } : {}),
            ...(action.thinkingMs !== undefined ? { thinkingMs: action.thinkingMs } : {}),
            ...(action.finishReason !== undefined ? { finishReason: action.finishReason } : {}),
          };
        });
        return {
          ...c,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
      });
    }

    case "SWITCH_VERSION": {
      const { conversationId, messageId, targetVersionIndex } = action;
      return state.map((c) => {
        if (c.id !== conversationId) return c;
        const target = c.messages.find((m) => m.id === messageId);
        if (!target) return c;
        const parentId = target.parentId || null;
        const siblings = c.messages.filter((m) => (m.parentId || null) === parentId);
        const chosenSibling = siblings[targetVersionIndex];
        if (!chosenSibling) return c;

        if (!parentId) {
          return {
            ...c,
            rootMessageId: chosenSibling.id,
            updatedAt: Date.now(),
          };
        }

        const updatedMessages = c.messages.map((m) =>
          m.id === parentId
            ? {
                ...m,
                activeChildId: chosenSibling.id,
              }
            : m
        );

        return {
          ...c,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
      });
    }

    case "BRANCH_EDIT_USER": {
      const { conversationId, newUserMsg, newAssistantMsg, parentId } = action;
      return state.map((c) => {
        if (c.id !== conversationId) return c;
        const updatedMessages = c.messages.map((m) => {
          if (parentId && m.id === parentId) {
            return {
              ...m,
              activeChildId: newUserMsg.id,
              childrenIds: [...(m.childrenIds || []), newUserMsg.id],
            };
          }
          return m;
        });

        updatedMessages.push(newUserMsg, newAssistantMsg);

        return {
          ...c,
          rootMessageId: parentId === null ? newUserMsg.id : c.rootMessageId,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
      });
    }

    case "BRANCH_RETRY_ASSISTANT": {
      const { conversationId, newAssistantMsg, parentUserMsgId } = action;
      return state.map((c) => {
        if (c.id !== conversationId) return c;
        const updatedMessages = c.messages.map((m) => {
          if (m.id === parentUserMsgId) {
            return {
              ...m,
              activeChildId: newAssistantMsg.id,
              childrenIds: [...(m.childrenIds || []), newAssistantMsg.id],
            };
          }
          return m;
        });

        updatedMessages.push(newAssistantMsg);

        return {
          ...c,
          messages: updatedMessages,
          updatedAt: Date.now(),
        };
      });
    }

    case "DELETE_CONVERSATION":
      return state.filter((c) => c.id !== action.id);

    case "TOGGLE_STAR":
      return state.map((c) => (c.id === action.id ? { ...c, starred: !c.starred } : c));

    case "RENAME_CONVERSATION":
      if (!action.newTitle.trim()) return state;
      return state.map((c) =>
        c.id === action.id ? { ...c, title: action.newTitle.trim() } : c
      );

    case "SET_TYPING_TITLE":
      return state.map((c) =>
        c.id === action.conversationId
          ? { ...c, title: action.title, isTypingTitle: action.isTypingTitle }
          : c
      );

    default:
      return state;
  }
}
