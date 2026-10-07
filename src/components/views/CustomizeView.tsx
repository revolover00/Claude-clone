import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { useChat } from "../../context/ChatContext";
import type { ResponseStyle } from "../../types/chat";

const STYLES: { key: ResponseStyle; label: string; desc: string }[] = [
  { key: "Normal", label: "Normal", desc: "Balanced, natural and insightful Claude tone" },
  { key: "Concise", label: "Concise", desc: "Short, direct, minimal fluff or explanation" },
  { key: "Explanatory", label: "Explanatory", desc: "Detailed step-by-step breakdowns and analogies" },
  { key: "Formal", label: "Formal", desc: "Polished, professional, enterprise-grade prose" },
];

export default function CustomizeView() {
  const { preferences, updatePreferences } = useChat();
  const [instructions, setInstructions] = useState(
    preferences.profileInstructions
  );
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSave = () => {
    updatePreferences({ profileInstructions: instructions });
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-8 lg:px-12 font-sans">
      <div className="mx-auto w-full max-w-[760px]">
        {/* Header */}
        <div className="border-b border-line pb-6">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-accent" />
            <h1 className="text-[26px] font-medium text-ink">Customize Claude</h1>
          </div>
          <p className="mt-1 text-[14px] text-ink-muted">
            Shape Claude&apos;s behavior, knowledge about your background, and tone across all chats.
          </p>
        </div>

        <div className="mt-8 space-y-8">
          {/* Section 1: Response style chips */}
          <div className="rounded-xl border border-line bg-elev-1 p-6">
            <h2 className="text-[16px] font-medium text-ink">Response style</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              Choose how Claude structures and delivers its answers.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {STYLES.map(({ key, label, desc }) => {
                const isSelected = preferences.responseStyle === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updatePreferences({ responseStyle: key })}
                    className={`flex flex-col items-start rounded-lg border p-3.5 text-start transition-all ${
                      isSelected
                        ? "border-accent bg-elev-2 ring-1 ring-accent text-ink"
                        : "border-line bg-elev-2/50 text-ink-soft hover:border-line-soft hover:bg-elev-2"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[14px] font-medium">{label}</span>
                      {isSelected && <Check size={15} className="text-accent" />}
                    </div>
                    <span className="mt-1 text-[12px] text-ink-muted">{desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Profile preferences textarea */}
          <div className="rounded-xl border border-line bg-elev-1 p-6">
            <h2 className="text-[16px] font-medium text-ink">
              Profile preferences
            </h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              What should Claude know about you to provide better, more tailored responses? (e.g., your role, preferred tech stack, languages).
            </p>

            <div className="mt-4">
              <textarea
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g., I'm a senior frontend engineer building React and TypeScript applications. I prefer concise code snippets without redundant explanations..."
                className="w-full resize-none rounded-lg border border-line bg-elev-2 p-3.5 text-[14px] leading-relaxed text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-[12px] text-ink-muted">
                Automatically saved to local workspace
              </span>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-[13.5px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              >
                {savedFeedback ? (
                  <>
                    <Check size={14} />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
