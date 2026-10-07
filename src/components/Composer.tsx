import { useEffect, useRef, useState, useCallback } from "react";
import {
  Plus,
  Mic,
  ChevronDown,
  ChevronRight,
  PenLine,
  GraduationCap,
  CodeXml,
  Coffee,
  Lightbulb,
  Check,
  ArrowUp,
  Square,
  Image as ImageIcon,
  Camera,
  FileText,
  X,
  Globe,
  Brain,
  Palette,
  UploadCloud,
} from "lucide-react";
import { cn } from "../utils/cn";
import Chip from "./shared/Chip";
import IconButton from "./shared/IconButton";
import { useToast } from "../context/ToastContext";
import { useChat } from "../context/ChatContext";
import type { Attachment, ResponseStyle } from "../types/chat";

const MODELS = [
  {
    id: "sonnet-5",
    name: "Sonnet 5",
    desc: "Smart, fast, exceptional reasoning",
  },
  {
    id: "opus-5",
    name: "Opus 5",
    desc: "Deep analysis and nuanced comprehension",
  },
  {
    id: "haiku-4-5",
    name: "Haiku 4.5",
    desc: "Near-instant responses for lightweight tasks",
  },
] as const;

type ModelId = (typeof MODELS)[number]["id"];

const EFFORTS = ["Low", "Medium", "High"] as const;
type Effort = (typeof EFFORTS)[number];

const SUGGESTIONS = [
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

type Props = {
  onSend?: (text: string, attachments?: Attachment[]) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  inChatView?: boolean;
  initialValue?: string;
  onEditLastMessage?: () => void;
};

export default function Composer({
  onSend,
  onStop,
  isStreaming = false,
  inChatView = false,
  initialValue = "",
  onEditLastMessage,
}: Props) {
  const { showToast } = useToast();
  const { preferences, updatePreferences } = useChat();

  const [value, setValue] = useState(initialValue);
  const [model, setModel] = useState<ModelId>("sonnet-5");
  const [effort, setEffort] = useState<Effort>("Medium");

  // Menus & Toggles
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [styleSubmenuOpen, setStyleSubmenuOpen] = useState(false);

  // Feature toggles
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Mic dictation
  const [micOn, setMicOn] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Suggestion examples panel
  const [activeChipExamples, setActiveChipExamples] = useState<string[] | null>(
    null
  );

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync external initialValue updates
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
      areaRef.current?.focus();
    }
  }, [initialValue]);

  // Textarea auto-grow
  const adjustHeight = () => {
    const textarea = areaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 176); // max-h-44 = 176px
    textarea.style.height = `${Math.max(nextHeight, 48)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  // Process files into Attachments
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        const isImage = file.type.startsWith("image/");

        reader.onload = () => {
          const newAtt: Attachment = {
            id: `att-${Date.now()}-${Math.random()}`,
            name: file.name,
            size: file.size,
            type: file.type,
            url: reader.result as string,
            isImage,
          };
          setAttachments((prev) => [...prev, newAtt]);
          showToast(`Attached ${file.name}`, "success");
        };

        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          // Read as text snippet or data URL
          reader.readAsDataURL(file);
        }
      });
    },
    [showToast]
  );

  // Global drag & drop overlay
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleFiles]);

  // Listen for window-wide dropped files from App.tsx
  useEffect(() => {
    const handleGlobalDrop = (e: Event) => {
      const custom = e as CustomEvent<{ files: File[] }>;
      if (custom.detail?.files && custom.detail.files.length > 0) {
        handleFiles(custom.detail.files);
      }
    };
    window.addEventListener("claude:drop-files", handleGlobalDrop);
    return () => {
      window.removeEventListener("claude:drop-files", handleGlobalDrop);
    };
  }, [handleFiles]);

  // Paste image or files from clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  // Screenshot capture using getDisplayMedia
  const handleScreenshot = async () => {
    setPlusMenuOpen(false);
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        showToast("Screen capture not supported in this browser", "error");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const track = stream.getVideoTracks()[0];
      const imageCapture = (window as any).ImageCapture
        ? new (window as any).ImageCapture(track)
        : null;

      if (imageCapture) {
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(bitmap, 0, 0);
        track.stop();

        const dataUrl = canvas.toDataURL("image/png");
        const newAtt: Attachment = {
          id: `att-${Date.now()}`,
          name: "screenshot.png",
          size: Math.round((dataUrl.length * 3) / 4),
          type: "image/png",
          url: dataUrl,
          isImage: true,
        };
        setAttachments((prev) => [...prev, newAtt]);
        showToast("Screenshot captured", "success");
      } else {
        track.stop();
        showToast("Screenshot captured", "success");
      }
    } catch {
      showToast("Screenshot cancelled", "info");
    }
  };

  // Mic dictation with Web Speech API
  const toggleMic = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("Speech recognition is not supported in this browser.", "error");
      return;
    }

    if (micOn) {
      recognitionRef.current?.stop();
      setMicOn(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang =
        preferences.language === "ar" ? "ar-EG" : "en-US";

      let initialTranscript = value;

      recognition.onstart = () => {
        setMicOn(true);
        showToast("Listening...", "info");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        setValue(
          initialTranscript
            ? `${initialTranscript} ${currentTranscript}`
            : currentTranscript
        );
      };

      recognition.onerror = () => {
        setMicOn(false);
        showToast("Dictation error or microphone permission denied", "error");
      };

      recognition.onend = () => {
        setMicOn(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setMicOn(false);
      showToast("Unable to start microphone dictation", "error");
    }
  };

  const handleSend = () => {
    if (isStreaming) {
      onStop?.();
      return;
    }
    if (!hasContent) return;

    const textToSend = value.trim();
    const attsToSend = [...attachments];

    setValue("");
    setAttachments([]);
    setActiveChipExamples(null);

    if (areaRef.current) {
      areaRef.current.style.height = "auto";
    }

    onSend?.(textToSend, attsToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Up arrow in empty composer edits last user message
    else if (e.key === "ArrowUp" && value === "" && !inChatView === false) {
      e.preventDefault();
      onEditLastMessage?.();
    }
  };

  const pickChip = (starter: string, examples: string[]) => {
    setValue(starter);
    setActiveChipExamples(examples);
    areaRef.current?.focus();
  };

  const currentModelObj =
    MODELS.find((m) => m.id === model) || MODELS[0];

  return (
    <div className="relative w-full font-sans">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Drag & drop overlay */}
      {isDragging && (
        <div className="fixed inset-4 z-50 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-black/75 backdrop-blur-sm pointer-events-none anim-modal-in">
          <div className="flex flex-col items-center gap-3 text-ink">
            <UploadCloud size={46} className="text-accent animate-bounce" />
            <p className="text-xl font-medium">Drop files here</p>
            <p className="text-sm text-ink-muted">
              Add photos, code files, and documents to your chat
            </p>
          </div>
        </div>
      )}

      {/* Composer Container */}
      <div className="mx-auto flex min-h-[128px] w-full max-w-[690px] flex-col rounded-[14px] border border-composer-line bg-composer px-4 pb-2.5 pt-3 transition-all duration-200 focus-within:border-accent/40 focus-within:shadow-[0_0_0_3px_rgba(217,119,87,0.07)]">
        {/* Attached files preview chips */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 pt-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="anim-popover-in relative flex items-center gap-2 rounded-lg border border-line bg-elev-1 p-1.5 pr-2.5 text-[12.5px] text-ink"
              >
                {att.isImage ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    className="h-9 w-9 rounded object-cover border border-line/60"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-elev-2 text-accent">
                    <FileText size={18} />
                  </div>
                )}
                <div className="min-w-0 max-w-[140px]">
                  <p className="truncate font-medium">{att.name}</p>
                  <p className="text-[10.5px] text-ink-muted">
                    {(att.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter((a) => a.id !== att.id)
                    )
                  }
                  className="ml-1 text-ink-muted hover:text-ink"
                  title="Remove attachment"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea with auto-grow */}
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (activeChipExamples) setActiveChipExamples(null);
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder="How can I help you today?"
          rows={2}
          aria-label="Message Claude"
          className="max-h-44 w-full resize-none overflow-y-auto bg-transparent text-[15.5px] leading-6 text-ink placeholder:text-ink-muted focus:outline-none scroll-slim"
        />

        {/* Bottom toolbar */}
        <div className="mt-auto flex items-center justify-between pt-2">
          {/* Left: Plus Menu */}
          <div className="relative">
            <IconButton
              label="Add content"
              onClick={() => {
                setPlusMenuOpen((v) => !v);
                setModelMenuOpen(false);
              }}
              className="h-8 w-8 text-ink-muted hover:text-ink"
            >
              <Plus size={18} strokeWidth={2} />
            </IconButton>

            {/* Plus button popup menu (scale+fade from bottom-left, 140ms) */}
            {plusMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    setStyleSubmenuOpen(false);
                  }}
                />
                <div className="anim-popover-in absolute bottom-full left-0 z-40 mb-2 w-56 origin-bottom-left rounded-xl border border-line bg-elev-1 p-1.5 shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
                  <button
                    type="button"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
                  >
                    <ImageIcon size={15} className="text-ink-muted" />
                    <span>Add files or photos</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleScreenshot}
                    className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
                  >
                    <Camera size={15} className="text-ink-muted" />
                    <span>Take a screenshot</span>
                  </button>

                  <button
                    type="button"
                    disabled
                    className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-faint opacity-50 cursor-not-allowed"
                  >
                    <span className="flex items-center gap-2.5">
                      <FileText size={15} />
                      <span>Add from Google Drive</span>
                    </span>
                    <span className="text-[10px] uppercase">Soon</span>
                  </button>

                  <div className="my-1 border-t border-line" />

                  {/* Feature toggles */}
                  <button
                    type="button"
                    onClick={() => {
                      setWebSearchEnabled((v) => !v);
                      showToast(
                        !webSearchEnabled
                          ? "Web search enabled"
                          : "Web search disabled",
                        "info"
                      );
                    }}
                    className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
                  >
                    <div className="flex items-center gap-2.5">
                      <Globe size={15} className="text-ink-muted" />
                      <span>Web search</span>
                    </div>
                    {webSearchEnabled && (
                      <Check size={14} className="text-accent" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExtendedThinkingEnabled((v) => !v);
                      showToast(
                        !extendedThinkingEnabled
                          ? "Extended thinking enabled"
                          : "Extended thinking disabled",
                        "info"
                      );
                    }}
                    className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
                  >
                    <div className="flex items-center gap-2.5">
                      <Brain size={15} className="text-ink-muted" />
                      <span>Extended thinking</span>
                    </div>
                    {extendedThinkingEnabled && (
                      <Check size={14} className="text-accent" />
                    )}
                  </button>

                  {/* Use style submenu */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setStyleSubmenuOpen((v) => !v)}
                      className="flex h-8 w-full items-center justify-between rounded-lg px-2.5 text-[13px] text-ink-soft transition-colors hover:bg-elev-2 hover:text-ink"
                    >
                      <div className="flex items-center gap-2.5">
                        <Palette size={15} className="text-ink-muted" />
                        <span>Use style</span>
                      </div>
                      <ChevronRight size={14} className="text-ink-muted" />
                    </button>

                    {styleSubmenuOpen && (
                      <div className="anim-popover-in absolute bottom-0 left-full ml-1 w-44 rounded-xl border border-line bg-elev-1 p-1.5 shadow-xl">
                        {(
                          [
                            "Normal",
                            "Concise",
                            "Explanatory",
                            "Formal",
                          ] as ResponseStyle[]
                        ).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              updatePreferences({ responseStyle: st });
                              setStyleSubmenuOpen(false);
                              setPlusMenuOpen(false);
                              showToast(`Style set to ${st}`, "info");
                            }}
                            className="flex h-7 w-full items-center justify-between rounded-lg px-2 text-[12.5px] text-ink-soft hover:bg-elev-2 hover:text-ink"
                          >
                            <span>{st}</span>
                            {preferences.responseStyle === st && (
                              <Check size={13} className="text-accent" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Model Selector & Send Button */}
          <div className="relative flex items-center gap-1.5">
            {/* Model & Effort Button */}
            <button
              type="button"
              onClick={() => {
                setModelMenuOpen((v) => !v);
                setPlusMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={modelMenuOpen}
              className="flex h-8 items-center gap-2 rounded-md px-2 transition-colors duration-150 hover:bg-elev-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <span className="text-[13.5px] font-medium text-ink-soft">
                {currentModelObj.name}
              </span>
              <span className="text-[13.5px] text-ink-muted">{effort}</span>
            </button>

            {/* Dictate Button */}
            <IconButton
              label={micOn ? "Stop dictation" : "Dictate"}
              onClick={toggleMic}
              className={cn(
                "rounded-full",
                micOn && "anim-mic text-accent hover:text-accent"
              )}
            >
              <Mic size={16} strokeWidth={1.9} />
            </IconButton>

            <button
              type="button"
              aria-label="Model options"
              onClick={() => {
                setModelMenuOpen((v) => !v);
                setPlusMenuOpen(false);
              }}
              className="flex h-8 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-150 hover:bg-elev-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <ChevronDown size={15} strokeWidth={2} />
            </button>

            {/* Model & Effort Dropdown Menu */}
            {modelMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setModelMenuOpen(false)}
                />
                <div
                  role="menu"
                  className="anim-popover-in absolute bottom-full right-0 z-40 mb-2 w-64 rounded-xl border border-line bg-elev-1 p-2 shadow-[0_16px_36px_rgba(0,0,0,0.5)]"
                >
                  {/* Models list */}
                  <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                    Model
                  </p>
                  <div className="space-y-1">
                    {MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="menuitemradio"
                        aria-checked={model === m.id}
                        onClick={() => {
                          setModel(m.id);
                        }}
                        className={cn(
                          "flex w-full items-start justify-between rounded-lg p-2 text-start transition-colors",
                          model === m.id
                            ? "bg-elev-2 text-ink"
                            : "text-ink-soft hover:bg-elev-2 hover:text-ink"
                        )}
                      >
                        <div>
                          <p className="text-[13.5px] font-medium">{m.name}</p>
                          <p className="text-[11.5px] text-ink-muted leading-tight">
                            {m.desc}
                          </p>
                        </div>
                        {model === m.id && (
                          <Check size={15} className="text-accent shrink-0 mt-0.5" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="my-2 border-t border-line" />

                  {/* Effort section */}
                  <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                    Effort
                  </p>
                  <div className="space-y-0.5">
                    {EFFORTS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        role="menuitemradio"
                        aria-checked={effort === e}
                        onClick={() => {
                          setEffort(e);
                          setModelMenuOpen(false);
                        }}
                        className={cn(
                          "flex h-8 w-full items-center justify-between rounded-md px-2 text-[13px] transition-colors",
                          effort === e
                            ? "text-ink font-medium bg-elev-2"
                            : "text-ink-soft hover:bg-elev-2"
                        )}
                      >
                        <span>{e}</span>
                        {effort === e && (
                          <Check size={14} className="text-accent" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Send / Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-sm transition-all duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 scale-100"
              >
                <Square size={13} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!hasContent}
                title={hasContent ? "Send message" : "Type a message or attach a file"}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
                  hasContent
                    ? "bg-accent text-white shadow-sm hover:opacity-90 scale-100 opacity-100 cursor-pointer"
                    : "bg-elev-3 text-ink-muted opacity-40 scale-90 cursor-not-allowed pointer-events-none"
                )}
              >
                <ArrowUp size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Suggestion Example Prompts Panel (slide-down + stagger fade) */}
      {activeChipExamples && (
        <div className="anim-popover-in mx-auto mt-2 max-w-[690px] rounded-xl border border-line bg-elev-1 p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
            <span>Example prompts</span>
            <button
              type="button"
              onClick={() => setActiveChipExamples(null)}
              className="text-ink-muted hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
          <div className="space-y-1">
            {activeChipExamples.map((example, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setValue(example);
                  setActiveChipExamples(null);
                  onSend?.(example, attachments);
                }}
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
          className="anim-rise mx-auto mt-10 flex max-w-[720px] flex-wrap items-center justify-center gap-2.5 px-4"
          style={{ animationDelay: "220ms" }}
        >
          {SUGGESTIONS.map(({ label, icon: Icon, starter, examples }) => (
            <Chip
              key={label}
              icon={<Icon strokeWidth={1.8} />}
              onClick={() => pickChip(starter, examples)}
            >
              {label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
