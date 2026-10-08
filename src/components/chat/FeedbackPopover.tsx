import { useState } from "react";
import type { Message } from "../../types/chat";
import { useToast } from "../../context/ToastContext";

interface FeedbackPopoverProps {
  message: Message;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FeedbackPopover({
  message,
  onClose,
  onSuccess,
}: FeedbackPopoverProps) {
  const { showToast } = useToast();
  const [feedbackReason, setFeedbackReason] = useState("");
  const [feedbackComment, setFeedbackComment] = useState("");

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackReason) {
      showToast("Please choose a reason", "error");
      return;
    }
    try {
      localStorage.setItem(
        `feedback_${message.id}`,
        JSON.stringify({ thumbs: "down", reason: feedbackReason, comment: feedbackComment })
      );
      onSuccess();
      onClose();
      showToast("Thank you for your valuable feedback!", "success");
    } catch {
      showToast("Failed to record feedback", "error");
    }
  };

  return (
    <div
      className="absolute bottom-9 left-0 z-30 w-64 rounded-xl border border-line bg-[#1e1c1a] p-3 shadow-xl anim-fade-in font-sans text-start animate-scale-up"
    >
      <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-2.5">
        <h4 className="text-[12.5px] font-bold text-ink uppercase tracking-wider select-none">
          Feedback Reason
        </h4>
        <div className="flex flex-col gap-1.5 text-[12px] text-ink-soft select-none">
          {[
            "Incorrect / misleading info",
            "Incomplete / cut short",
            "Poor formatting / code bugs",
            "Too long / verbose",
            "Other",
          ].map((reason) => (
            <label key={reason} className="flex items-center gap-2 cursor-pointer py-0.5 hover:text-ink transition-colors">
              <input
                type="radio"
                name="reason"
                value={reason}
                checked={feedbackReason === reason}
                onChange={(e) => setFeedbackReason(e.target.value)}
                className="accent-accent shrink-0 cursor-pointer"
              />
              <span className="truncate">{reason}</span>
            </label>
          ))}
        </div>
        
        <textarea
          rows={2}
          value={feedbackComment}
          onChange={(e) => setFeedbackComment(e.target.value)}
          placeholder="Optional comments..."
          className="w-full rounded border border-line/60 bg-elev-1 p-1.5 text-[11.5px] text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent/50 resize-none font-sans"
        />

        <div className="flex justify-end gap-1.5 text-[11px] font-semibold">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2.5 py-1 text-ink-soft hover:bg-elev-2 hover:text-ink cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-accent text-white px-3 py-1 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
