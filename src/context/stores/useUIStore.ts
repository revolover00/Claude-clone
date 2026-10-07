import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type ActiveView =
  | "chat"
  | "projects"
  | "artifacts"
  | "customize"
  | "code";

export function useUIStore() {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeView, setActiveViewState] = useState<ActiveView>("chat");
  const [activeConversationId, setActiveConversationIdState] = useState<
    string | null
  >(null);

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Synchronize state from URL pathname
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith("/chat/")) {
      const id = path.replace("/chat/", "");
      setActiveConversationIdState(id);
      setActiveViewState("chat");
    } else if (path === "/" || path === "") {
      setActiveConversationIdState(null);
      setActiveViewState("chat");
    } else if (path === "/projects" || path.startsWith("/projects/")) {
      setActiveViewState("projects");
      setActiveConversationIdState(null);
    } else if (path === "/artifacts") {
      setActiveViewState("artifacts");
      setActiveConversationIdState(null);
    } else if (path === "/customize") {
      setActiveViewState("customize");
      setActiveConversationIdState(null);
    } else if (path === "/code") {
      setActiveViewState("code");
      setActiveConversationIdState(null);
    }
  }, [location.pathname]);

  const setActiveConversationId = useCallback(
    (id: string | null) => {
      setActiveConversationIdState(id);
      setActiveViewState("chat");
      if (id) {
        navigate(`/chat/${id}`);
      } else {
        navigate("/");
      }
    },
    [navigate]
  );

  const createNewChat = useCallback(
    (projectId?: string | null) => {
      setActiveConversationIdState(null);
      setActiveViewState("chat");
      if (projectId) {
        navigate(`/?project=${projectId}`);
      } else {
        navigate("/");
      }
    },
    [navigate]
  );

  const setActiveView = useCallback(
    (view: ActiveView) => {
      setActiveViewState(view);
      if (view === "chat") {
        if (activeConversationId) {
          navigate(`/chat/${activeConversationId}`);
        } else {
          navigate("/");
        }
      } else if (view === "projects") {
        navigate("/projects");
      } else if (view === "artifacts") {
        navigate("/artifacts");
      } else if (view === "customize") {
        navigate("/customize");
      } else if (view === "code") {
        navigate("/code");
      }
    },
    [activeConversationId, navigate]
  );

  const canGoBack = true;
  const canGoForward = true;

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const goForward = useCallback(() => {
    navigate(1);
  }, [navigate]);

  return {
    activeView,
    setActiveView,
    activeConversationId,
    setActiveConversationId,
    createNewChat,
    searchModalOpen,
    setSearchModalOpen,
    settingsModalOpen,
    setSettingsModalOpen,
    canGoBack,
    canGoForward,
    goBack,
    goForward,
  };
}
