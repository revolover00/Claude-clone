import React from "react";
import ChatMessage from "./ChatMessage";
import type { Message } from "../../types/chat";

interface Props {
  messages: Message[];
  conversationId: string;
  onSaveEdit: (messageId: string, newContent: string) => void;
  onRetry: (assistantMessageId: string) => void;
}

export const MessageList: React.FC<Props> = ({
  messages,
  conversationId,
  onSaveEdit,
  onRetry,
}) => {
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
          />
        );
      })}
    </div>
  );
};

export default MessageList;
