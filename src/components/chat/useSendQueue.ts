import { useState, useRef, useEffect } from "react";
import type { Attachment } from "../../types/chat";

export interface QueuedMessage {
  text: string;
  attachments: Attachment[];
  options: any;
}

export function useSendQueue(handleSend: (text: string, attachments?: Attachment[], options?: any) => void) {
  const [queuedMessage, setQueuedMessage] = useState<QueuedMessage | null>(null);
  const queuedMessageRef = useRef<QueuedMessage | null>(null);

  useEffect(() => {
    queuedMessageRef.current = queuedMessage;
  }, [queuedMessage]);

  const triggerQueuedMessage = () => {
    const queued = queuedMessageRef.current;
    if (queued) {
      setQueuedMessage(null);
      queuedMessageRef.current = null;
      setTimeout(() => {
        handleSend(queued.text, queued.attachments, queued.options);
      }, 150);
    }
  };

  return {
    queuedMessage,
    setQueuedMessage,
    triggerQueuedMessage,
  };
}
