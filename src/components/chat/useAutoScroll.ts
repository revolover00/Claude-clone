import { useRef, useState, useEffect, useCallback } from "react";
import type { Message } from "../../types/chat";

export function useAutoScroll(messages: Message[], inChatView: boolean, isStreaming: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [hasNewUnseenText, setHasNewUnseenText] = useState(false);

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // User is near bottom if they are within 120px of the absolute bottom
    const distToBottom = scrollHeight - (scrollTop + clientHeight);
    const near = distToBottom < 120;
    setIsNearBottom(near);
    setShowScrollBtn(!near && inChatView);
    if (near) {
      setHasNewUnseenText(false);
    }
  }, [inChatView]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (!scrollRef.current) return;
    
    // Smooth scroll option
    if (smooth) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    
    setHasNewUnseenText(false);
  }, []);

  // When new stream tokens arrive, if user is not near bottom, flag new text
  useEffect(() => {
    if (isStreaming && !isNearBottom) {
      setHasNewUnseenText(true);
    }
  }, [messages, isStreaming, isNearBottom]);

  // Auto scroll follow when streaming is active and user is near bottom
  useEffect(() => {
    if (isNearBottom && isStreaming) {
      scrollToBottom(false);
    }
  }, [messages, isStreaming, isNearBottom, scrollToBottom]);

  return {
    scrollRef,
    isNearBottom,
    setIsNearBottom,
    showScrollBtn,
    hasNewUnseenText,
    setHasNewUnseenText,
    checkScroll,
    scrollToBottom,
  };
}
