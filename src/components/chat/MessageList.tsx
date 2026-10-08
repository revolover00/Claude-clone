import React, { useMemo } from "react";
import ChatMessage from "./ChatMessage";
import type { Message } from "../../types/chat";

interface Props {
  messages: Message[];
  conversationId: string;
  onSaveEdit: (messageId: string, newContent: string) => void;
  onRetry: (assistantMessageId: string, options?: { model?: string; modifier?: string }) => void;
  onContinue?: (assistantMessageId: string) => void;
}

export const MessageList: React.FC<Props> = ({
  messages,
  conversationId,
  onSaveEdit,
  onRetry,
  onContinue,
}) => {
  const lastAssistantMsgId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  return (
    <div className="mx-auto w-full max-w-[720px] pt-6 pb-4">
      {messages.map((msg, index) => {
        // Find preceding user prompt for context (e.g. artifact naming)
        let userPrompt = "";
        if (msg.role === "assistant") {
          for (let i = index - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
              userPrompt = messages[i].content;
              break;
            }
          }
        }

        return (
          <ChatMessage
            key={msg.id}
            message={msg}
            userPrompt={userPrompt}
            conversationId={conversationId}
            onSaveEdit={onSaveEdit}
            onRetry={onRetry}
            onContinue={onContinue}
            isLastAssistantMessage={msg.id === lastAssistantMsgId}
          />
        );
      })}
    </div>
  );
};

export default MessageList;
