import { useState, useEffect } from "react";
import { useModels } from "../../hooks/useModels";
import type { Effort } from "./ModelMenu";

interface ComposerStateOptions {
  activeConversationId: string | null;
  initialValue: string;
  onChangeValue?: (val: string) => void;
}

export function useComposerState({
  activeConversationId,
  initialValue,
  onChangeValue,
}: ComposerStateOptions) {
  const [value, setValue] = useState(initialValue);
  const { defaultModel } = useModels();
  const [model, setModel] = useState<string>(defaultModel?.slug || "gemini-3-8-flash");
  const [effort, setEffort] = useState<Effort>("Medium");

  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [extendedThinkingEnabled, setExtendedThinkingEnabled] = useState(false);
  const [activeChipExamples, setActiveChipExamples] = useState<string[] | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const draftKey = activeConversationId ? `draft_${activeConversationId}` : "draft_new_chat";
    const saved = localStorage.getItem(draftKey) || "";
    setValue(saved);
    onChangeValue?.(saved);
  }, [activeConversationId, onChangeValue]);

  const handleValueChange = (newVal: string) => {
    setValue(newVal);
    onChangeValue?.(newVal);
    if (activeChipExamples) setActiveChipExamples(null);
    setSlashIndex(0);

    const draftKey = activeConversationId ? `draft_${activeConversationId}` : "draft_new_chat";
    if (newVal) localStorage.setItem(draftKey, newVal);
    else localStorage.removeItem(draftKey);
  };

  return {
    value,
    setValue,
    model,
    setModel,
    effort,
    setEffort,
    webSearchEnabled,
    setWebSearchEnabled,
    extendedThinkingEnabled,
    setExtendedThinkingEnabled,
    activeChipExamples,
    setActiveChipExamples,
    slashIndex,
    setSlashIndex,
    isOffline,
    handleValueChange,
  };
}
