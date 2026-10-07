import React from "react";
import {
  PenLine,
  GraduationCap,
  CodeXml,
  Coffee,
  Lightbulb,
  X,
  ArrowUp,
} from "lucide-react";
import Chip from "../shared/Chip";
import type { Attachment } from "../../types/chat";

export const SUGGESTIONS = [
  {
    label: "Write",
    icon: PenLine,
    starter: "Help me write ",
    examples: [
      "Help me write a persuasive pitch for our new product feature",
      "Help me write an announcement email for a team reorganization",
      "Help me write a thoughtful reply declining an invitation politely",
      "Help me write a concise executive summary for this quarterly review",
    ],
  },
  {
    label: "Learn",
    icon: GraduationCap,
    starter: "Explain ",
    examples: [
      "Explain quantum computing like I'm a software developer",
      "Explain how attention mechanisms work in transformer models",
      "Explain the mathematical intuition behind vector embeddings",
      "Explain how zero-knowledge proofs enable privacy on blockchains",
    ],
  },
  {
    label: "Code",
    icon: CodeXml,
    starter: "Help me debug ",
    examples: [
      "Help me debug a React memory leak in useEffect cleanup",
      "Help me write a resilient debounce hook in TypeScript",
      "Help me design an optimistic UI update flow with rollbacks",
      "Help me write an efficient SQL query to find retention cohorts",
    ],
  },
  {
    label: "Life stuff",
    icon: Coffee,
    starter: "Help me plan ",
    examples: [
      "Help me plan a 3-day itinerary in Tokyo focused on food and architecture",
      "Help me structure my weekly workout routine balancing cardio and strength",
      "Help me organize a productive morning routine that avoids screen time",
      "Help me plan a healthy Mediterranean dinner menu for four guests",
    ],
  },
  {
    label: "Claude's choice",
    icon: Lightbulb,
    starter: "Surprise me — ",
    examples: [
      "Surprise me — analyze an overlooked invention that changed everyday life",
      "Surprise me — brainstorm 3 unconventional startup ideas around climate data",
      "Surprise me — share a mind-bending philosophical paradox and its resolutions",
      "Surprise me — write a short sci-fi story about an AI discovering archaeology",
    ],
  },
];

interface Props {
  inChatView: boolean;
  activeChipExamples: string[] | null;
  onSelectExample: (prompt: string) => void;
  onCloseExamples: () => void;
  onPickChip: (starter: string, examples: string[]) => void;
  attachments?: Attachment[];
}

export const SuggestionPanel: React.FC<Props> = ({
  inChatView,
  activeChipExamples,
  onSelectExample,
  onCloseExamples,
  onPickChip,
}) => {
  return (
    <>
      {/* Suggestion Example Prompts Panel (slide-down + stagger fade) */}
      {activeChipExamples && (
        <div className="anim-popover-in mx-auto mt-2 max-w-[690px] rounded-xl border border-line bg-elev-1 p-2 shadow-lg font-sans">
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            <span>Example prompts</span>
            <button
              type="button"
              onClick={onCloseExamples}
              className="text-ink-muted hover:text-ink focus-visible:outline-none"
            >
              <X size={13} />
            </button>
          </div>
          <div className="space-y-1">
            {activeChipExamples.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectExample(example)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-[13px] text-ink-soft hover:bg-elev-2 hover:text-ink transition-colors"
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <span className="truncate">{example}</span>
                <ArrowUp
                  size={13}
                  className="rotate-45 text-ink-muted shrink-0 ms-2"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Suggestion chips (only on Home view) */}
      {!inChatView && (
        <div
          className="anim-rise mx-auto mt-10 flex max-w-[720px] flex-wrap items-center justify-center gap-2.5 px-4 font-sans"
          style={{ animationDelay: "220ms" }}
        >
          {SUGGESTIONS.map(({ label, icon: Icon, starter, examples }) => (
            <Chip
              key={label}
              icon={<Icon strokeWidth={1.8} />}
              onClick={() => onPickChip(starter, examples)}
            >
              {label}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
};

export default SuggestionPanel;
