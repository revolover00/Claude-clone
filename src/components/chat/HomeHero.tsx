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
  const { preferences } = useChat();
  const greetingPrefix = getTimeGreeting();
  const userName = preferences.userName?.trim();
  const greetingText =
    userName && userName !== "You"
      ? `${greetingPrefix}, ${userName}`
      : `${greetingPrefix}, how are things?`;

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
    </div>
  );
};

export default HomeHero;
