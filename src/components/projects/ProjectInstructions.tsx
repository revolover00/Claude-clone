import React, { useState, useEffect } from "react";
import { Sparkles, Check } from "lucide-react";
import { useToast } from "../../context/ToastContext";

interface Props {
  initialInstructions: string;
  onSave: (instructions: string) => void;
}

export const ProjectInstructions: React.FC<Props> = ({
  initialInstructions,
  onSave,
}) => {
  const { showToast } = useToast();
  const [instructions, setInstructions] = useState(initialInstructions);
  const [isSaved, setIsSaved] = useState(true);

  useEffect(() => {
    setInstructions(initialInstructions);
    setIsSaved(true);
  }, [initialInstructions]);

  const handleChange = (val: string) => {
    setInstructions(val);
    setIsSaved(false);
  };

  const handleSave = () => {
    onSave(instructions);
    setIsSaved(true);
    showToast("Project instructions saved", "success");
  };

  return (
    <div className="rounded-xl border border-line bg-elev-1 p-5 shadow-sm font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-accent" />
          <h2 className="text-[15.5px] font-medium text-ink">
            Project Instructions
          </h2>
        </div>
        {!isSaved && (
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1 text-[12.5px] font-medium text-white hover:opacity-90 shadow-sm cursor-pointer"
          >
            <Check size={13} />
            <span>Save</span>
          </button>
        )}
      </div>
      <p className="mt-1.5 text-[13px] text-ink-muted">
        Instructions given here will be automatically included in the system prompt for every conversation created in this project.
      </p>

      <div className="mt-3.5">
        <textarea
          rows={4}
          value={instructions}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleSave}
          placeholder="e.g., Focus on clean React and Tailwind CSS architecture. Always provide complete working files with comments. Adhere to our team's brand style guide."
          className="w-full resize-y rounded-lg border border-line bg-elev-2 p-3 text-[14px] text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
        />
      </div>
    </div>
  );
};

export default ProjectInstructions;
