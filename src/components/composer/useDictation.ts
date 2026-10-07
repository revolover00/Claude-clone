import { useState, useRef, useCallback } from "react";
import { useToast } from "../../context/ToastContext";

interface UseDictationOptions {
  language?: string;
  onTranscript: (text: string) => void;
  currentValue: string;
}

export function useDictation({ language, onTranscript, currentValue }: UseDictationOptions) {
  const { showToast } = useToast();
  const [micOn, setMicOn] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleMic = useCallback(() => {
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
      recognition.lang = language === "ar" ? "ar-EG" : "en-US";

      const initialTranscript = currentValue;

      recognition.onstart = () => {
        setMicOn(true);
        showToast("Listening...", "info");
      };

      recognition.onresult = (event: any) => {
        let currentTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentTranscript += event.results[i][0].transcript;
        }
        onTranscript(
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
  }, [micOn, language, currentValue, onTranscript, showToast]);

  return { micOn, toggleMic };
}
