import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type {
  Conversation,
  Message,
  Project,
  Artifact,
  UserPreferences,
} from "../types/chat";

export type ActiveView =
  | "chat"
  | "projects"
  | "artifacts"
  | "customize"
  | "code";

interface ChatContextType {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  setActiveConversationId: (id: string | null) => void;
  createNewChat: () => void;
  saveMessage: (conversationId: string, message: Message) => void;
  setConversationMessages: (conversationId: string, messages: Message[]) => void;
  updateMessageContent: (
    conversationId: string,
    messageId: string,
    content: string,
    isStreaming?: boolean,
    isThinking?: boolean,
    thinking?: string
  ) => void;
  deleteConversation: (id: string) => void;
  toggleStar: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  triggerAutoTitle: (conversationId: string, firstUserMsg: string, firstReply: string) => Promise<void>;

  // History stack for Back / Forward buttons
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

  // Projects & Artifacts
  projects: Project[];
  addProject: (name: string, description: string) => void;
  deleteProject: (id: string) => void;
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
  clearAllData: () => void;
}

const STORAGE_KEY_CONVS = "claude_clone_conversations_v2";
const STORAGE_KEY_PREFS = "claude_clone_preferences_v2";
const STORAGE_KEY_PROJECTS = "claude_clone_projects_v2";
const STORAGE_KEY_ARTIFACTS = "claude_clone_artifacts_v2";

const DEFAULT_PREFERENCES: UserPreferences = {
  profileInstructions: "",
  responseStyle: "Normal",
  theme: "dark",
  language: "en",
};

const DEFAULT_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Design System",
    description: "Reusable UI components, icons, and styling guidelines.",
    updatedAt: Date.now() - 3600000 * 24,
  },
  {
    id: "proj-2",
    name: "API Integration",
    description: "Backend architecture, schemas, and endpoint definitions.",
    updatedAt: Date.now() - 3600000 * 72,
  },
];

const DEFAULT_ARTIFACTS: Artifact[] = [
  {
    id: "art-1",
    identifier: "button-component",
    title: "Button Component",
    language: "tsx",
    type: "React",
    code: `export const Button = ({ children, variant = 'primary' }) => {\n  return (\n    <button className="px-4 py-2 rounded-lg bg-accent text-white">\n      {children}\n    </button>\n  );\n};`,
    chatId: "",
    chatTitle: "Component Library",
    version: 1,
    versions: [
      {
        version: 1,
        content: `export const Button = ({ children, variant = 'primary' }) => {\n  return (\n    <button className="px-4 py-2 rounded-lg bg-accent text-white">\n      {children}\n    </button>\n  );\n};`,
        createdAt: Date.now() - 3600000 * 48,
      },
    ],
    createdAt: Date.now() - 3600000 * 48,
    updatedAt: Date.now() - 3600000 * 48,
  },
];

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Load conversations
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONVS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  const [activeConversationId, setActiveConversationIdState] = useState<
    string | null
  >(null);

  // History stack for Back / Forward buttons
  const [history, setHistory] = useState<(string | null)[]>([null]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Active view
  const [activeView, setActiveView] = useState<ActiveView>("chat");

  // Modals
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PREFERENCES;
  });

  // Projects
  const [projects, setProjects] = useState<Project[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_PROJECTS;
  });

  // Artifacts
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ARTIFACTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_ARTIFACTS;
  });

  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false);

  const openArtifact = useCallback(
    (art: Artifact) => {
      // Look up existing artifact in store to preserve all version history
      const existing = artifacts.find(
        (a) =>
          a.id === art.id ||
          a.identifier === art.identifier ||
          a.title.toLowerCase() === art.title.toLowerCase()
      );
      setActiveArtifact(existing || art);
      setArtifactPanelOpen(true);
    },
    [artifacts]
  );

  const closeArtifact = useCallback(() => {
    setArtifactPanelOpen(false);
  }, []);

  const updateActiveArtifactLive = useCallback(
    (title: string, code: string) => {
      setActiveArtifact((curr) => {
        if (!curr) return null;
        if (curr.title.toLowerCase() === title.toLowerCase()) {
          return { ...curr, code };
        }
        return curr;
      });
    },
    []
  );

  const saveOrUpdateArtifact = useCallback(
    (
      title: string,
      language: string,
      type: string,
      code: string,
      chatId = "",
      chatTitle = ""
    ) => {
      const existing = artifacts.find(
        (a) => a.title.toLowerCase() === title.toLowerCase()
      );

      if (existing) {
        // If code hasn't changed, return existing
        if (existing.code === code) {
          return existing;
        }

        const nextVersion = (existing.version || 1) + 1;
        const initialVersions = existing.versions && existing.versions.length > 0
          ? existing.versions
          : [{ version: 1, content: existing.code, createdAt: existing.createdAt }];

        const updatedVersions = [
          ...initialVersions,
          { version: nextVersion, content: code, createdAt: Date.now() },
        ];
        const updated: Artifact = {
          ...existing,
          code,
          version: nextVersion,
          versions: updatedVersions,
          chatId: chatId || existing.chatId,
          chatTitle: chatTitle || existing.chatTitle,
          updatedAt: Date.now(),
        };
        setArtifacts((prev) =>
          prev.map((a) => (a.id === existing.id ? updated : a))
        );
        if (activeArtifact?.id === existing.id || activeArtifact?.title.toLowerCase() === title.toLowerCase()) {
          setActiveArtifact(updated);
        }
        return updated;
      } else {
        const created: Artifact = {
          id: `art-${Date.now()}`,
          identifier: title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          title,
          language,
          type,
          code,
          chatId,
          chatTitle,
          version: 1,
          versions: [{ version: 1, content: code, createdAt: Date.now() }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setArtifacts((prev) => [created, ...prev]);
        return created;
      }
    },
    [artifacts, activeArtifact]
  );

  const setArtifactVersion = useCallback(
    (artifactId: string, version: number) => {
      setArtifacts((prev) =>
        prev.map((a) => {
          if (a.id !== artifactId) return a;
          const foundVer = a.versions?.find((v) => v.version === version);
          if (!foundVer) return a;
          const updated = {
            ...a,
            version,
            code: foundVer.content,
          };
          if (activeArtifact?.id === artifactId) {
            setActiveArtifact(updated);
          }
          return updated;
        })
      );
    },
    [activeArtifact]
  );

  // Apply theme to document element
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === "light") {
      root.setAttribute("data-theme", "light");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [preferences.theme]);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONVS, JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }, [preferences]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    } catch {
      // ignore
    }
  }, [projects]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ARTIFACTS, JSON.stringify(artifacts));
    } catch {
      // ignore
    }
  }, [artifacts]);

  // Set active conversation with history recording
  const setActiveConversationId = useCallback(
    (id: string | null) => {
      setActiveConversationIdState(id);
      setActiveView("chat");

      setHistory((prev) => {
        const next = prev.slice(0, historyIndex + 1);
        if (next[next.length - 1] !== id) {
          next.push(id);
        }
        return next;
      });
      setHistoryIndex((prev) => prev + 1);
    },
    [historyIndex]
  );

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const goBack = useCallback(() => {
    if (canGoBack) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setActiveConversationIdState(history[newIdx]);
      setActiveView("chat");
    }
  }, [canGoBack, historyIndex, history]);

  const goForward = useCallback(() => {
    if (canGoForward) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setActiveConversationIdState(history[newIdx]);
      setActiveView("chat");
    }
  }, [canGoForward, historyIndex, history]);

  // "New" button creates an empty chat and returns to Home view
  const createNewChat = useCallback(() => {
    setActiveConversationId(null);
    setActiveView("chat");
  }, [setActiveConversationId]);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;

  // Save a new message
  const saveMessage = useCallback(
    (conversationId: string, message: Message) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === conversationId);
        if (existing) {
          return prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  updatedAt: Date.now(),
                }
              : c
          );
        } else {
          // Create new conversation
          const title =
            message.content.length > 40
              ? message.content.slice(0, 40) + "..."
              : message.content || "New conversation";
          const newConv: Conversation = {
            id: conversationId,
            title,
            messages: [message],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            starred: false,
          };
          return [newConv, ...prev];
        }
      });
    },
    []
  );

  const setConversationMessages = useCallback(
    (conversationId: string, messages: Message[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, messages, updatedAt: Date.now() }
            : c
        )
      );
    },
    []
  );

  // Update existing message content (streaming / thinking)
  const updateMessageContent = useCallback(
    (
      conversationId: string,
      messageId: string,
      content: string,
      isStreaming = false,
      isThinking = false,
      thinking?: string
    ) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          const updatedMessages = c.messages.map((m) => {
            if (m.id !== messageId) return m;
            return {
              ...m,
              content,
              isStreaming,
              isThinking,
              ...(thinking !== undefined ? { thinking } : {}),
            };
          });
          return {
            ...c,
            messages: updatedMessages,
            updatedAt: Date.now(),
          };
        })
      );
    },
    []
  );

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setActiveConversationIdState((curr) => (curr === id ? null : curr));
  }, []);

  const toggleStar = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c))
    );
  }, []);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() } : c))
    );
  }, []);

  // Auto-title with typewriter effect in sidebar
  const triggerAutoTitle = useCallback(
    async (conversationId: string, firstUserMsg: string, _firstReply: string) => {
      // Generate clean title
      let targetTitle = "";
      const trimmed = firstUserMsg.trim();
      if (trimmed.length <= 36) {
        targetTitle = trimmed;
      } else {
        // Cut at word boundary
        const sub = trimmed.slice(0, 36);
        const lastSpace = sub.lastIndexOf(" ");
        targetTitle = (lastSpace > 12 ? sub.slice(0, lastSpace) : sub) + "...";
      }
      if (!targetTitle) targetTitle = "Conversation";

      // Typewriter effect in the sidebar
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, title: "", isTypingTitle: true }
            : c
        )
      );

      for (let i = 1; i <= targetTitle.length; i++) {
        await new Promise((r) => setTimeout(r, 22));
        const partial = targetTitle.slice(0, i);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, title: partial } : c
          )
        );
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, title: targetTitle, isTypingTitle: false }
            : c
        )
      );
    },
    []
  );

  // Projects
  const addProject = useCallback((name: string, description: string) => {
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name,
      description,
      updatedAt: Date.now(),
    };
    setProjects((prev) => [newProj, ...prev]);
  }, []);

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);


  const updatePreferences = useCallback(
    (partial: Partial<UserPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const clearAllData = useCallback(() => {
    setConversations([]);
    setActiveConversationIdState(null);
    setProjects([]);
    setArtifacts([]);
    localStorage.removeItem(STORAGE_KEY_CONVS);
    localStorage.removeItem(STORAGE_KEY_PROJECTS);
    localStorage.removeItem(STORAGE_KEY_ARTIFACTS);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + K: Open search
      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchModalOpen((v) => !v);
      }

      // Ctrl/Cmd + Shift + O: New chat
      if (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        createNewChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [createNewChat]);

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        activeConversation,
        setActiveConversationId,
        createNewChat,
        saveMessage,
        setConversationMessages,
        updateMessageContent,
        deleteConversation,
        toggleStar,
        renameConversation,
        triggerAutoTitle,
        canGoBack,
        canGoForward,
        goBack,
        goForward,
        activeView,
        setActiveView,
        searchModalOpen,
        setSearchModalOpen,
        settingsModalOpen,
        setSettingsModalOpen,
        preferences,
        updatePreferences,
        projects,
        addProject,
        deleteProject,
        artifacts,
        activeArtifact,
        artifactPanelOpen,
        openArtifact,
        closeArtifact,
        saveOrUpdateArtifact,
        updateActiveArtifactLive,
        setArtifactVersion,
        clearAllData,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
};
