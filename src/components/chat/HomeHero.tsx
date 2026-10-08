import React from "react";
import { FolderGit2 } from "lucide-react";
import ClaudeSpark from "../icons/ClaudeSpark";
import Composer from "../Composer";
import { getTimeGreeting } from "../../utils/text";
import { useChat } from "../../context/ChatContext";
import type { Attachment, Project } from "../../types/chat";

interface Props {
  inChatView: boolean;
  currentProject?: Project;
  isStreaming: boolean;
  onSend: (
    text: string,
    attachments?: Attachment[],
    options?: {
      model: string;
      effort: string;
      webSearch: boolean;
      extendedThinking: boolean;
    }
  ) => void;
  onStop: () => void;
}

export const HomeHero: React.FC<Props> = ({
  inChatView,
  currentProject,
  isStreaming,
  onSend,
  onStop,
}) => {
  const { preferences, updatePreferences } = useChat();
  
  const [showFirstRunCard, setShowFirstRunCard] = React.useState(() => {
    return localStorage.getItem("claude_clone_memory_first_run_seen") !== "true";
  });

  const greetingPrefix = getTimeGreeting();
  const userName = preferences.userName?.trim();
  const greetingText =
    userName && userName !== "You"
      ? `${greetingPrefix}, ${userName}`
      : `${greetingPrefix}, how are things?`;

  const handleEnableMemory = () => {
    updatePreferences({ memory_enabled: true });
    localStorage.setItem("claude_clone_memory_first_run_seen", "true");
    setShowFirstRunCard(false);
  };

  const handleNotNow = () => {
    updatePreferences({ memory_enabled: false });
    localStorage.setItem("claude_clone_memory_first_run_seen", "true");
    setShowFirstRunCard(false);
  };

  return (
    <div
      className={`transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        inChatView
          ? "max-h-0 opacity-0 overflow-hidden pointer-events-none -translate-y-4"
          : "flex flex-1 flex-col items-center justify-center pt-8 pb-12 opacity-100 translate-y-0"
      }`}
    >
      <h1 className="anim-rise flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-3.5 text-center font-serif text-[clamp(28px,4.5vw,48px)] font-normal leading-[1.15] tracking-[-0.01em] text-ink">
        <ClaudeSpark size={46} className="shrink-0 text-accent mb-1 sm:mb-0" />
        <span className="break-words max-w-[90vw] sm:max-w-none">{greetingText}</span>
      </h1>

      {/* Active Project indicator if starting chat within project */}
      {currentProject && !inChatView && (
        <div className="mt-4 flex items-center gap-2 rounded-full border border-line bg-elev-2 px-3.5 py-1 text-[13px] text-ink-soft">
          <FolderGit2 size={14} className="text-accent" />
          <span>Project: <strong>{currentProject.name}</strong></span>
        </div>
      )}

      {/* Composer centered on Home View */}
      {!inChatView && (
        <div className="mt-9 w-full max-w-[690px]">
          <Composer
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            inChatView={false}
          />
        </div>
      )}

      {/* First-run Memory Card */}
      {!inChatView && showFirstRunCard && (
        <div className="mt-8 w-full max-w-[690px] rounded-xl border border-line bg-elev-1 p-4 shadow-sm animate-fade-in font-sans">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <ClaudeSpark size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14.5px] font-semibold text-ink">Personal Memory is now available</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Claude can securely remember key facts about yourself, your tools, and your workflow across conversations so you get highly personalized, expert assistance without repeating yourself. You're in full control.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={handleEnableMemory}
                  className="rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  Enable Memory
                </button>
                <button
                  onClick={handleNotNow}
                  className="rounded-lg bg-elev-3 border border-line px-3 py-1.5 text-[12px] font-medium text-ink hover:bg-elev-4 transition-colors cursor-pointer"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeHero;
