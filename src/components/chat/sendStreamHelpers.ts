import type { Message, Attachment } from "../../types/chat";

export function createMessagePair(
  text: string,
  attachments: Attachment[] | undefined,
  extendedThinking: boolean,
  webSearch: boolean
) {
  const userMsg: Message = {
    id: `u-${Date.now()}`,
    role: "user",
    content: text,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
    createdAt: Date.now(),
  };

  const thinkingStartTime = extendedThinking ? Date.now() : undefined;
  const assistantMsgId = `a-${Date.now()}`;
  const assistantMsg: Message = {
    id: assistantMsgId,
    role: "assistant",
    content: "",
    thinking: "",
    isThinking: extendedThinking,
    isStreaming: true,
    isSearchingWeb: webSearch,
    thinkingStartedAt: thinkingStartTime,
    createdAt: Date.now(),
  };

  return {
    userMsg,
    assistantMsg,
    assistantMsgId,
    thinkingStartTime,
  };
}
