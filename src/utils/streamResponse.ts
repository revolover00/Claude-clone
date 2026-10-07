export interface StreamCallbacks {
  onThinkingStart?: () => void;
  onThinkingUpdate?: (thought: string) => void;
  onToken?: (token: string, fullText: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (err: Error) => void;
}

export interface ChatStreamOptions {
  messages: any[];
  style: string;
  profileInstructions: string;
  model: string;
  effort: string;
  webSearch: boolean;
  extendedThinking: boolean;
  language: string;
}

export function streamRealResponse(
  prompt: string,
  signal: AbortSignal,
  options: ChatStreamOptions,
  callbacks: StreamCallbacks
): () => void {
  let isCancelled = false;

  const onAbort = () => {
    isCancelled = true;
  };
  signal.addEventListener("abort", onAbort);

  (async () => {
    try {
      callbacks.onThinkingStart?.();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            ...options.messages.map((m) => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments,
            })),
            { role: "user", content: prompt },
          ],
          style: options.style,
          profileInstructions: options.profileInstructions,
          model: options.model,
          effort: options.effort,
          webSearch: options.webSearch,
          extendedThinking: options.extendedThinking,
          language: options.language,
        }),
        signal,
      });

      if (!response.ok) {
        let errMsg = "An error occurred during generation.";
        if (response.status === 429) {
          errMsg = "Rate limit exceeded. Please wait a moment before retrying.";
        } else if (response.status === 402) {
          errMsg = "Model quota exceeded. Please select another model or try again later.";
        } else {
          errMsg = `HTTP Error ${response.status}: Failed to reach the AI gateway.`;
        }
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body received from server.");
      }

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let accumulatedThinking = "";
      let buffer = "";

      callbacks.onThinkingUpdate?.(""); // Initialize thinking process state

      while (!isCancelled) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed === "data: [DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.error) {
                throw new Error(data.error);
              }

              if (data.thinking) {
                accumulatedThinking += data.thinking;
                callbacks.onThinkingUpdate?.(accumulatedThinking);
              }

              if (data.token) {
                accumulatedContent += data.token;
                callbacks.onToken?.(data.token, accumulatedContent);
              }
            } catch (err) {
              console.error("Error parsing stream line:", err, jsonStr);
            }
          }
        }
      }

      if (!isCancelled) {
        callbacks.onDone?.(accumulatedContent);
      }
    } catch (err: any) {
      if (isCancelled || err.name === "AbortError") {
        return;
      }
      console.error("Stream response error:", err);
      let message = err.message || "Backend unreachable";
      if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
        message = "Backend unreachable. Please make sure the backend is active.";
      }
      callbacks.onError?.(new Error(message));
    }
  })();

  return () => {
    isCancelled = true;
    signal.removeEventListener("abort", onAbort);
  };
}
