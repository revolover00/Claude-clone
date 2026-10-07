import { useRef, useState, useEffect, useCallback } from "react";
import type { Message } from "../../types/chat";

export function useAutoScroll(messages: Message[], inChatView: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distToBottom = scrollHeight - (scrollTop + clientHeight);
    const near = distToBottom < 80;
    setIsNearBottom(near);
    setShowScrollBtn(!near && inChatView);
  }, [inChatView]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Automatically scroll down when new messages or tokens arrive if near bottom
  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom(false);
    }
  }, [messages, isNearBottom, scrollToBottom]);

  return {
    scrollRef,
    isNearBottom,
    setIsNearBottom,
    showScrollBtn,
    checkScroll,
    scrollToBottom,
  };
}
