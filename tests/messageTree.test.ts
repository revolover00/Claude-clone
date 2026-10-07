import { describe, it, expect } from "vitest";
import {
  getActiveBranch,
  getMessageSiblings,
  migrateConversations,
  conversationsReducer,
} from "../src/context/stores/conversationsReducer";
import type { Message, Conversation } from "../src/types/chat";

describe("Message Tree Logic & Versioning", () => {
  const treeMessages: Message[] = [
    {
      id: "u1",
      parentId: null,
      activeChildId: "a1_v2", // Points to version 2 of assistant
      childrenIds: ["a1_v1", "a1_v2"],
      role: "user",
      content: "First user question",
      createdAt: 1000,
    },
    {
      id: "a1_v1",
      parentId: "u1",
      activeChildId: "u2_v1",
      childrenIds: ["u2_v1"],
      role: "assistant",
      content: "Assistant reply version 1",
      createdAt: 1100,
    },
    {
      id: "a1_v2",
      parentId: "u1",
      activeChildId: "u2_v2",
      childrenIds: ["u2_v2"],
      role: "assistant",
      content: "Assistant reply version 2 (retried)",
      createdAt: 1200,
    },
    {
      id: "u2_v1",
      parentId: "a1_v1",
      activeChildId: null,
      childrenIds: [],
      role: "user",
      content: "Follow-up question to version 1",
      createdAt: 1300,
    },
    {
      id: "u2_v2",
      parentId: "a1_v2",
      activeChildId: null,
      childrenIds: [],
      role: "user",
      content: "Follow-up question to version 2",
      createdAt: 1400,
    },
  ];

  describe("getActiveBranch", () => {
    it("follows activeChildId pointers from root to leaf", () => {
      const branch = getActiveBranch(treeMessages, "u1");
      expect(branch.map((m) => m.id)).toEqual(["u1", "a1_v2", "u2_v2"]);
    });

    it("returns empty array for empty messages", () => {
      expect(getActiveBranch([])).toEqual([]);
    });
  });

  describe("getMessageSiblings", () => {
    it("returns correct sibling list and current index for assistant version 1", () => {
      const { siblings, currentIndex } = getMessageSiblings(treeMessages, "a1_v1");
      expect(siblings.map((s) => s.id)).toEqual(["a1_v1", "a1_v2"]);
      expect(currentIndex).toBe(0);
    });

    it("returns correct sibling list and current index for assistant version 2", () => {
      const { siblings, currentIndex } = getMessageSiblings(treeMessages, "a1_v2");
      expect(siblings.map((s) => s.id)).toEqual(["a1_v1", "a1_v2"]);
      expect(currentIndex).toBe(1);
    });

    it("handles single message without siblings", () => {
      const { siblings, currentIndex } = getMessageSiblings(treeMessages, "u1");
      expect(siblings.length).toBe(1);
      expect(currentIndex).toBe(0);
    });
  });

  describe("migrateConversations", () => {
    it("migrates legacy flat message arrays to linked tree nodes", () => {
      const legacyRaw = [
        {
          id: "c-old",
          title: "Legacy Chat",
          messages: [
            { id: "m1", role: "user", content: "Hi" },
            { id: "m2", role: "assistant", content: "Hello" },
            { id: "m3", role: "user", content: "How are you?" },
          ],
        },
      ];

      const migrated = migrateConversations(legacyRaw);
      expect(migrated[0].rootMessageId).toBe("m1");
      expect(migrated[0].messages[0].parentId).toBeNull();
      expect(migrated[0].messages[0].activeChildId).toBe("m2");
      expect(migrated[0].messages[1].parentId).toBe("m1");
      expect(migrated[0].messages[1].activeChildId).toBe("m3");
      expect(migrated[0].messages[2].parentId).toBe("m2");
      expect(migrated[0].messages[2].activeChildId).toBeNull();
    });

    it("preserves already migrated conversation trees", () => {
      const existingConv: Conversation = {
        id: "c-tree",
        title: "Tree Chat",
        rootMessageId: "u1",
        messages: treeMessages,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const result = migrateConversations([existingConv]);
      expect(result[0].messages).toEqual(treeMessages);
    });
  });

  describe("Branching actions in reducer", () => {
    const conv: Conversation = {
      id: "conv-1",
      title: "Test Tree",
      rootMessageId: "u1",
      messages: treeMessages,
      createdAt: 1000,
      updatedAt: 1000,
    };

    it("handles SWITCH_VERSION to swap downstream active branch", () => {
      const switchedState = conversationsReducer([conv], {
        type: "SWITCH_VERSION",
        conversationId: "conv-1",
        messageId: "a1_v2",
        targetVersionIndex: 0, // Switch back to a1_v1
      });

      const parentNode = switchedState[0].messages.find((m) => m.id === "u1");
      expect(parentNode?.activeChildId).toBe("a1_v1");

      const activeBranch = getActiveBranch(switchedState[0].messages, "u1");
      expect(activeBranch.map((m) => m.id)).toEqual(["u1", "a1_v1", "u2_v1"]);
    });

    it("handles BRANCH_RETRY_ASSISTANT creating new sibling version", () => {
      const newAssistantMsg: Message = {
        id: "a1_v3",
        parentId: "u1",
        role: "assistant",
        content: "Assistant reply version 3",
        createdAt: 1500,
      };

      const nextState = conversationsReducer([conv], {
        type: "BRANCH_RETRY_ASSISTANT",
        conversationId: "conv-1",
        newAssistantMsg,
        parentUserMsgId: "u1",
      });

      const u1 = nextState[0].messages.find((m) => m.id === "u1");
      expect(u1?.activeChildId).toBe("a1_v3");
      expect(u1?.childrenIds).toContain("a1_v3");
    });
  });
});
