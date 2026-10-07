import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PanelLeft,
  MessagesSquare,
  CodeXml,
  Plus,
  Archive,
  Shapes,
  Search,
} from "lucide-react";
import IconButton from "../shared/IconButton";
import UserMenu from "../modals/UserMenu";
import { useChat } from "../../context/ChatContext";

interface Props {
  onToggle: () => void;
}

export default function SidebarRail({ onToggle }: Props) {
  const { createNewChat, setSearchModalOpen } = useChat();
  const location = useLocation();
  const navigate = useNavigate();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isChatTab =
    location.pathname === "/" || location.pathname.startsWith("/chat");
  const isCodeTab = location.pathname === "/code";
  const isProjects =
    location.pathname === "/projects" ||
    location.pathname.startsWith("/projects/");
  const isArtifacts = location.pathname === "/artifacts";

  return (
    <aside className="fixed inset-y-0 start-0 z-40 flex h-full shrink-0 flex-col items-center border-e border-line bg-panel transition-all duration-200 ease-out -translate-x-full lg:translate-x-0 lg:static lg:w-[52px] font-sans">
      {/* Toggle button to expand */}
      <div className="flex h-12 w-full shrink-0 items-center justify-center">
        <IconButton label="Open sidebar" onClick={onToggle}>
          <PanelLeft size={18} strokeWidth={1.9} />
        </IconButton>
      </div>

      {/* Nav icon rail */}
      <div className="flex flex-1 flex-col items-center gap-1.5 pt-1">
        <IconButton
          label="New chat"
          onClick={() => {
            createNewChat();
          }}
        >
          <Plus size={18} strokeWidth={2} />
        </IconButton>

        <IconButton
          label="Search (⌘K)"
          onClick={() => setSearchModalOpen(true)}
        >
          <Search size={18} strokeWidth={1.8} />
        </IconButton>

        <IconButton
          label="Chats"
          active={isChatTab}
          onClick={() => {
            navigate("/");
            onToggle();
          }}
        >
          <MessagesSquare size={18} strokeWidth={1.8} />
        </IconButton>

        <IconButton
          label="Projects"
          active={isProjects}
          onClick={() => {
            navigate("/projects");
          }}
        >
          <Archive size={18} strokeWidth={1.8} />
        </IconButton>

        <IconButton
          label="Artifacts"
          active={isArtifacts}
          onClick={() => {
            navigate("/artifacts");
          }}
        >
          <Shapes size={18} strokeWidth={1.8} />
        </IconButton>

        <IconButton
          label="Code sessions"
          active={isCodeTab}
          onClick={() => {
            navigate("/code");
          }}
        >
          <CodeXml size={18} strokeWidth={1.8} />
        </IconButton>
      </div>

      {/* User avatar at bottom */}
      <div className="relative flex h-14 w-full shrink-0 items-center justify-center border-t border-line-soft">
        <button
          type="button"
          title="Account"
          onClick={() => setUserMenuOpen((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-elev-3 text-[12px] font-semibold text-ink-soft transition-colors hover:bg-elev-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          N
        </button>
        <UserMenu
          isOpen={userMenuOpen}
          onClose={() => setUserMenuOpen(false)}
        />
      </div>
    </aside>
  );
}
