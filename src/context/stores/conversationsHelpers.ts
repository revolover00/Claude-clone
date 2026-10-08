import type { Conversation, Message } from "../../types/chat";

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

export function createEditUserBranch(
  conversations: Conversation[],
  conversationId: string,
  targetMessageId: string,
  newContent: string
) {
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

  return { newUserMsg, newAssistantMsg, parentId };
}

export function createRetryAssistantBranch(
  conversations: Conversation[],
  conversationId: string,
  assistantMessageId: string
) {
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

  return { parentUserMsg, newAssistantMsg, parentUserMsgId };
}
