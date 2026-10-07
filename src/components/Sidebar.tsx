import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PanelLeft,
  MessagesSquare,
  CodeXml,
  Plus,
  Archive,
  Shapes,
  Briefcase,
  Search,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "../utils/cn";
import IconButton from "./shared/IconButton";
import SidebarRail from "./sidebar/SidebarRail";
import ChatList from "./sidebar/ChatList";
import UserRow from "./sidebar/UserRow";
import { useChat } from "../context/ChatContext";

type Props = {
  open: boolean;
  onToggle: () => void;
};

const NAV = [
  { label: "Projects", icon: Archive, path: "/projects" },
  { label: "Artifacts", icon: Shapes, path: "/artifacts" },
  { label: "Customize", icon: Briefcase, path: "/customize" },
];

export default function Sidebar({ open, onToggle }: Props) {
  const { conversations, createNewChat, setSearchModalOpen } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  const isCodeTab = location.pathname === "/code";
  const isProjects =
    location.pathname === "/projects" ||
    location.pathname.startsWith("/projects/");
  const isArtifacts = location.pathname === "/artifacts";
  const isCustomize = location.pathname === "/customize";

  const tab = isCodeTab ? "code" : "chat";
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Collapsed rail view
  if (!open) {
    return <SidebarRail onToggle={onToggle} />;
  }

  // Expanded sidebar view
  return (
    <aside className="fixed inset-y-0 start-0 z-40 flex h-full shrink-0 flex-col border-e border-line bg-panel transition-all duration-200 ease-out lg:static w-[85vw] max-w-[320px] lg:w-[280px] lg:max-w-none font-sans">
      {/* Top toolbar with Panel toggle, Search, and History Back/Forward */}
      <div className="flex h-12 shrink-0 items-center justify-between px-2">
        <div className="flex items-center gap-0.5">
          <IconButton label="Close sidebar" onClick={onToggle}>
            <PanelLeft size={18} strokeWidth={1.9} />
          </IconButton>

          <IconButton
            label="Search (⌘K)"
            onClick={() => setSearchModalOpen(true)}
          >
            <Search size={18} strokeWidth={1.9} />
          </IconButton>
        </div>

        <div className="flex items-center gap-0.5">
          <IconButton
            label="Back in history"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={17} strokeWidth={1.9} />
          </IconButton>
          <IconButton
            label="Forward in history"
            onClick={() => navigate(1)}
          >
            <ArrowRight size={17} strokeWidth={1.9} />
          </IconButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-3 pt-1">
        {/* Segmented control with smooth sliding pill indicator */}
        <div
          role="tablist"
          aria-label="Workspace"
          className="relative flex rounded-lg border border-line bg-elev-1 p-[3px]"
        >
          {/* Sliding indicator pill */}
          <div
            className={`absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] rounded-md bg-elev-4 shadow-sm transition-transform duration-200 ease-out ${
              tab === "code" ? "translate-x-full" : "translate-x-0"
            }`}
          />

          <button
            role="tab"
            type="button"
            aria-selected={tab === "chat"}
            onClick={() => {
              navigate("/");
            }}
            className={cn(
              "relative z-10 flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150",
              tab === "chat" ? "text-ink" : "text-ink-muted hover:text-ink-soft"
            )}
          >
            <MessagesSquare size={15} strokeWidth={1.9} />
            Chat
          </button>

          <button
            role="tab"
            type="button"
            aria-selected={tab === "code"}
            onClick={() => {
              navigate("/code");
            }}
            className={cn(
              "relative z-10 flex h-[30px] flex-1 items-center justify-center gap-1.5 rounded-md text-[13.5px] font-medium transition-colors duration-150",
              tab === "code" ? "text-ink" : "text-ink-muted hover:text-ink-soft"
            )}
          >
            <CodeXml size={15} strokeWidth={1.9} />
            Code
          </button>
        </div>

        {/* New chat button */}
        <button
          type="button"
          onClick={() => {
            createNewChat();
          }}
          className="mt-3 flex h-[34px] w-full items-center gap-2.5 rounded-lg bg-elev-3 px-2.5 text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-elev-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <Plus size={16} strokeWidth={2} />
          New chat
        </button>

        {/* Primary nav: Projects, Artifacts, Customize */}
        <nav className="mt-1.5 flex flex-col gap-0.5">
          {NAV.map(({ label, icon: Icon, path }) => {
            const isActive =
              path === "/projects"
                ? isProjects
                : path === "/artifacts"
                ? isArtifacts
                : isCustomize;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  navigate(path);
                }}
                className={cn(
                  "flex h-[34px] items-center gap-2.5 rounded-md px-2.5 text-[14px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 text-start",
                  isActive
                    ? "bg-elev-2 text-ink font-medium"
                    : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={1.8}
                  className={isActive ? "text-accent" : "text-ink-muted"}
                />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Chats header */}
        <div className="mt-6 flex items-center justify-between px-2 pb-1">
          <span className="text-[12.5px] font-medium text-ink-muted">
            Chats ({conversations.length})
          </span>
        </div>

        {/* Grouped conversations list */}
        <ChatList conversations={conversations} isLoading={isLoading} />

        {/* User profile row with popup menu */}
        <UserRow />
      </div>
    </aside>
  );
}
