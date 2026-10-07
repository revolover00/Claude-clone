import type { Conversation, Message } from "../../types/chat";

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
      thinking?: string;
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

/**
 * Traverses the conversation tree from root to leaf following activeChildId.
 */
export function getActiveBranch(
  messages: Message[],
  rootMessageId?: string | null
): Message[] {
  if (!messages || messages.length === 0) return [];

  const map = new Map<string, Message>();
  const childrenMap = new Map<string | null, Message[]>();

  for (const m of messages) {
    map.set(m.id, m);
    const pId = m.parentId || null;
    const list = childrenMap.get(pId) || [];
    list.push(m);
    childrenMap.set(pId, list);
  }

  let current: Message | undefined;
  if (rootMessageId && map.has(rootMessageId)) {
    current = map.get(rootMessageId);
  } else {
    const roots = childrenMap.get(null) || [];
    current = roots[roots.length - 1] || messages[0];
  }

  const branch: Message[] = [];
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    branch.push(current);

    if (current.activeChildId && map.has(current.activeChildId)) {
      current = map.get(current.activeChildId);
    } else {
      const children = childrenMap.get(current.id) || [];
      current = children.length > 0 ? children[children.length - 1] : undefined;
    }
  }

  return branch;
}

/**
 * Gets all sibling message nodes sharing the same parent and returns current index.
 */
export function getMessageSiblings(
  messages: Message[],
  messageId: string
): { siblings: Message[]; currentIndex: number } {
  const target = messages.find((m) => m.id === messageId);
  if (!target) return { siblings: [], currentIndex: 0 };
  const parentId = target.parentId || null;
  const siblings = messages.filter((m) => (m.parentId || null) === parentId);
  const currentIndex = siblings.findIndex((s) => s.id === messageId);
  return {
    siblings,
    currentIndex: currentIndex === -1 ? 0 : currentIndex,
  };
}

/**
 * Automatically migrates existing legacy flat message arrays to linked tree nodes.
 */
export function migrateConversations(savedRaw: any[]): Conversation[] {
  if (!Array.isArray(savedRaw)) return [];
  return savedRaw.map((c) => {
    if (!c.messages || !Array.isArray(c.messages) || c.messages.length === 0) {
      return {
        ...c,
        messages: [],
        rootMessageId: null,
      };
    }

    const hasTreeStructure = c.messages.some((m: any) => "parentId" in m);
    if (hasTreeStructure) {
      return c;
    }

    // Convert sequential flat messages to linked tree nodes
    const messages: Message[] = c.messages.map((m: any, idx: number) => {
      const prevId = idx > 0 ? c.messages[idx - 1].id : null;
      const nextId = idx < c.messages.length - 1 ? c.messages[idx + 1].id : null;
      return {
        ...m,
        parentId: prevId,
        activeChildId: nextId,
        childrenIds: nextId ? [nextId] : [],
      };
    });

    return {
      ...c,
      messages,
      rootMessageId: messages[0]?.id || null,
    };
  });
}

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
            ...(action.thinking !== undefined ? { thinking: action.thinking } : {}),
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
