import { useCallback, useMemo, useRef, useState } from "react";
import type {
  AppendMessage,
  ExternalStoreAdapter,
  MessageStatus,
} from "@assistant-ui/react";
import { streamRealResponse } from "../../utils/streamResponse";
import { useModels } from "../../hooks/useModels";
import { useChat } from "../../context/ChatContext";
import { upsertToolActivityEvent } from "../../utils/toolActivity";
import type { ToolActivityEvent } from "../../types/chat";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: MessageStatus;
  toolEvents?: ToolActivityEvent[];
};

type PartLike = { type?: unknown; text?: unknown };

const COMPLETE: MessageStatus = { type: "complete", reason: "stop" };

/** Flatten message content to plain text, keeping only text parts. */
export function messageText(content: string | readonly PartLike[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

const uid = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `ui-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/**
 * External-store adapter that powers the assistant-ui thread at /assistant.
 * Messages live in this hook; generation streams through the shared
 * `streamRealResponse` client (same /api/chat SSE contract as the main chat).
 */
export function useAssistantUiStore() {
  const { defaultModel } = useModels();
  const { preferences } = useChat();

  const [messages, setMessagesState] = useState<UiMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const messagesRef = useRef<UiMessage[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const setMessages = useCallback((next: UiMessage[]) => {
    messagesRef.current = next;
    setMessagesState(next);
  }, []);

  const patchMessage = useCallback(
    (id: string, patch: Partial<UiMessage>) => {
      setMessages(
        messagesRef.current.map((m) => (m.id === id ? { ...m, ...patch } : m))
      );
    },
    [setMessages]
  );

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const text = messageText(message.content).trim();
      if (!text) return;
      const history = messagesRef.current;
      const assistantId = uid();
      setMessages([
        ...history,
        { id: uid(), role: "user", content: text, status: COMPLETE },
        { id: assistantId, role: "assistant", content: "", status: { type: "running" } },
      ]);

      const controller = new AbortController();
      controllerRef.current = controller;
      setIsRunning(true);

      await new Promise<void>((resolve) => {
        controller.signal.addEventListener("abort", () => resolve(), {
          once: true,
        });
        stopRef.current = streamRealResponse(
          text,
          controller.signal,
          {
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            style: preferences.responseStyle,
            profileInstructions: preferences.profileInstructions,
            model: defaultModel?.slug ?? "",
            effort: "Medium",
            webSearch: false,
            extendedThinking: false,
            language: preferences.language,
            memoryEnabled: preferences.memory_enabled !== false,
          },
          {
            onToken: (_token, fullText) => {
              patchMessage(assistantId, { content: fullText });
            },
            onTool: (event) => {
              const current = messagesRef.current.find((item) => item.id === assistantId);
              patchMessage(assistantId, { toolEvents: upsertToolActivityEvent(current?.toolEvents, event) });
            },
            onDone: (fullText) => {
              patchMessage(assistantId, { content: fullText, status: COMPLETE });
              resolve();
            },
            onError: (err) => {
              patchMessage(assistantId, {
                status: controller.signal.aborted
                  ? { type: "incomplete", reason: "cancelled" }
                  : {
                      type: "incomplete",
                      reason: "error",
                      error: String(err?.message ?? err),
                    },
              });
              resolve();
            },
          }
        );
      });

      const current = messagesRef.current.find((m) => m.id === assistantId);
      if (current?.status.type === "running") {
        patchMessage(assistantId, {
          status: controller.signal.aborted
            ? { type: "incomplete", reason: "cancelled" }
            : { type: "complete", reason: "unknown" },
        });
      }
      stopRef.current = null;
      controllerRef.current = null;
      setIsRunning(false);
    },
    [
      defaultModel?.slug,
      patchMessage,
      preferences.language,
      preferences.memory_enabled,
      preferences.profileInstructions,
      preferences.responseStyle,
      setMessages,
    ]
  );

  const onCancel = useCallback(async () => {
    stopRef.current?.();
    controllerRef.current?.abort();
  }, []);

  const handleSetMessages = useCallback(
    (next: readonly UiMessage[]) => {
      setMessages([...next]);
    },
    [setMessages]
  );

  const adapter = useMemo<ExternalStoreAdapter<UiMessage>>(
    () => ({
      messages,
      isRunning,
      convertMessage: (m) =>
        m.role === "user"
          ? { id: m.id, role: m.role, content: m.content }
          : { id: m.id, role: m.role, content: m.content, status: m.status },
      onNew,
      onCancel,
      setMessages: handleSetMessages,
    }),
    [messages, isRunning, onNew, onCancel, handleSetMessages]
  );

  return { adapter, isRunning, isEmpty: messages.length === 0, messages, isArabic: preferences.language === "ar" };
}
