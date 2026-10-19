import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useExternalStoreRuntime,
  type MessageState,
} from "@assistant-ui/react";
import { ArrowUp, Square } from "lucide-react";
import MarkdownView from "../chat/MarkdownView";
import { useAssistantUiStore, messageText } from "./useAssistantUiStore";
import { cn } from "../../utils/cn";
import ToolActivityView from "../chat/ToolActivityView";
import type { ToolActivityEvent } from "../../types/chat";

function UserRow({ message }: { message: MessageState }) {
  return (
    <div className="flex justify-end px-4 py-2.5">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-elev-2 px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        {messageText(message.content)}
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-muted"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
  );
}

function AssistantRow({ message, toolEvents, isArabic }: { message: MessageState; toolEvents?: ToolActivityEvent[]; isArabic: boolean }) {
  const text = messageText(message.content);
  const status = message.status;
  const running = status?.type === "running";
  const failed = status?.type === "incomplete" && status.reason === "error";
  const cancelled =
    status?.type === "incomplete" && status.reason === "cancelled";

  return (
    <div className="px-4 py-2.5">
      <div className="max-w-[48rem]">
        <ToolActivityView events={toolEvents || []} isStreaming={running} isArabic={isArabic} />
        {text ? (
          <MarkdownView
            content={text}
            isStreaming={running}
            className="text-[15.5px] leading-7 text-ink"
          />
        ) : running ? (
          <ThinkingDots />
        ) : null}
        {failed && (
          <p className="mt-2 text-[13px] text-rose-400">
            The response was interrupted. Try sending your message again.
          </p>
        )}
        {cancelled && (
          <p className="mt-2 text-[13px] text-ink-muted">Stopped.</p>
        )}
      </div>
    </div>
  );
}

function Greeting() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-2 pb-24">
      <h1 className="font-serif text-[30px] leading-tight text-ink">
        How can I help you today<span className="text-accent">*</span>
      </h1>
      <p className="text-[13.5px] text-ink-muted">
        This thread is powered by assistant-ui
      </p>
    </div>
  );
}

export function AssistantUiThread() {
  const { adapter, isRunning, isEmpty, messages, isArabic } = useAssistantUiStore();
  const runtime = useExternalStoreRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
          {isEmpty && <Greeting />}
          <ThreadPrimitive.Messages>
            {({ message }) =>
              message.role === "user" ? (
                <UserRow message={message} />
              ) : (
                <AssistantRow
                  message={message}
                  toolEvents={messages.find((item) => item.id === message.id)?.toolEvents}
                  isArabic={isArabic}
                />
              )
            }
          </ThreadPrimitive.Messages>
        </ThreadPrimitive.Viewport>

        <div className="shrink-0 border-t border-line bg-shell px-4 py-3">
          <ComposerPrimitive.Root className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-composer-line bg-composer px-3 py-2.5 shadow-lg focus-within:border-accent-border">
            <ComposerPrimitive.Input
              rows={1}
              placeholder="How can I help you today?"
              className="max-h-40 min-h-[38px] flex-1 resize-none bg-transparent px-1.5 py-1.5 text-[15px] leading-6 text-ink outline-none placeholder:text-ink-muted"
            />
            <ComposerPrimitive.Cancel
              aria-label="Stop response"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elev-3 hover:text-ink disabled:opacity-40",
                isRunning ? "flex" : "hidden"
              )}
            >
              <Square size={13} fill="currentColor" />
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send
              aria-label="Send message"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40",
                isRunning && "hidden"
              )}
            >
              <ArrowUp size={16} />
            </ComposerPrimitive.Send>
          </ComposerPrimitive.Root>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
