import { describe, it, expect } from "vitest";
import {
  conversationsReducer,
  type ConversationAction,
} from "../src/context/stores/conversationsReducer";
import type { Conversation, Message } from "../src/types/chat";

describe("conversationsReducer", () => {
  const mockMessage: Message = {
    id: "msg-1",
    role: "user",
    content: "Hello Claude",
    createdAt: 1000,
    parentId: null,
    activeChildId: null,
  };

  const initialConversation: Conversation = {
    id: "conv-1",
    title: "Test Conversation",
    messages: [mockMessage],
    rootMessageId: "msg-1",
    createdAt: 1000,
    updatedAt: 1000,
    starred: false,
  };

  it("handles SET_ALL", () => {
    const action: ConversationAction = {
      type: "SET_ALL",
      conversations: [initialConversation],
    };
    expect(conversationsReducer([], action)).toEqual([initialConversation]);
  });

  it("handles SAVE_MESSAGE for a new conversation", () => {
    const newMsg: Message = {
      id: "msg-new",
      role: "user",
      content: "First message in brand new chat",
      createdAt: 2000,
    };
    const action: ConversationAction = {
      type: "SAVE_MESSAGE",
      conversationId: "conv-new",
      message: newMsg,
    };

    const nextState = conversationsReducer([], action);
    expect(nextState.length).toBe(1);
    expect(nextState[0].id).toBe("conv-new");
    expect(nextState[0].messages.length).toBe(1);
    expect(nextState[0].messages[0].id).toBe("msg-new");
    expect(nextState[0].rootMessageId).toBe("msg-new");
  });

  it("handles SAVE_MESSAGE for appending to existing conversation", () => {
    const assistantMsg: Message = {
      id: "msg-2",
      role: "assistant",
      content: "Hello! How can I help?",
      createdAt: 1500,
    };
    const action: ConversationAction = {
      type: "SAVE_MESSAGE",
      conversationId: "conv-1",
      message: assistantMsg,
    };

    const nextState = conversationsReducer([initialConversation], action);
    expect(nextState[0].messages.length).toBe(2);
    // Previous message should have activeChildId pointing to new message
    expect(nextState[0].messages[0].activeChildId).toBe("msg-2");
    expect(nextState[0].messages[1].parentId).toBe("msg-1");
  });

  it("handles UPDATE_MESSAGE_CONTENT", () => {
    const action: ConversationAction = {
      type: "UPDATE_MESSAGE_CONTENT",
      conversationId: "conv-1",
      messageId: "msg-1",
      content: "Updated prompt text",
      isStreaming: true,
      isThinking: false,
    };

    const nextState = conversationsReducer([initialConversation], action);
    expect(nextState[0].messages[0].content).toBe("Updated prompt text");
    expect(nextState[0].messages[0].isStreaming).toBe(true);
  });

  it("handles TOGGLE_STAR", () => {
    const action: ConversationAction = {
      type: "TOGGLE_STAR",
      id: "conv-1",
    };
    const stateWithStar = conversationsReducer([initialConversation], action);
    expect(stateWithStar[0].starred).toBe(true);

    const stateWithoutStar = conversationsReducer(stateWithStar, action);
    expect(stateWithoutStar[0].starred).toBe(false);
  });

  it("handles RENAME_CONVERSATION", () => {
    const action: ConversationAction = {
      type: "RENAME_CONVERSATION",
      id: "conv-1",
      newTitle: "New Custom Title",
    };
    const nextState = conversationsReducer([initialConversation], action);
    expect(nextState[0].title).toBe("New Custom Title");
  });

  it("handles DELETE_CONVERSATION", () => {
    const action: ConversationAction = {
      type: "DELETE_CONVERSATION",
      id: "conv-1",
    };
    const nextState = conversationsReducer([initialConversation], action);
    expect(nextState.length).toBe(0);
  });

  it("handles SET_TYPING_TITLE during auto-title generation", () => {
    const action: ConversationAction = {
      type: "SET_TYPING_TITLE",
      conversationId: "conv-1",
      title: "Typing...",
      isTypingTitle: true,
    };
    const nextState = conversationsReducer([initialConversation], action);
    expect(nextState[0].title).toBe("Typing...");
    expect(nextState[0].isTypingTitle).toBe(true);
  });
});
