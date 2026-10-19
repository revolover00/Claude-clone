import { useMemo } from "react";
import type { Message } from "../../types/chat";
import { useChat, getMessageSiblings } from "../../context/ChatContext";
import UserMessageView from "./UserMessageView";
import AssistantMessageView from "./AssistantMessageView";

type Props = {
  message: Message;
  userPrompt?: string;
  conversationId?: string;
  onSaveEdit?: (messageId: string, newContent: string) => void;
  onRetry?: (assistantMessageId: string, options?: { model?: string; modifier?: string }) => void;
  onContinue?: (assistantMessageId: string) => void;
  isLastAssistantMessage?: boolean;
};

export default function ChatMessage({
  message,
  userPrompt = "",
  conversationId = "",
  onSaveEdit,
  onRetry,
  onContinue,
  isLastAssistantMessage = false,
}: Props) {
  const { activeConversation } = useChat();

  const convMessages = activeConversation?.messages;
  const { siblings, currentIndex } = useMemo(() => {
    return getMessageSiblings(convMessages || [], message.id);
  }, [convMessages, message.id]);

  if (message.role === "user") {
    return (
      <UserMessageView
        message={message}
        conversationId={conversationId}
        onSaveEdit={onSaveEdit}
        siblings={siblings}
        currentIndex={currentIndex}
      />
    );
  }

  return (
    <AssistantMessageView
      message={message}
      userPrompt={userPrompt}
      conversationId={conversationId}
      onRetry={onRetry}
      onContinue={onContinue}
      isLastAssistantMessage={isLastAssistantMessage}
    />
  );
}
