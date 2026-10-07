import { SSEParser } from "./sseParser";

export interface StreamCallbacks {
  onThinkingStart?: () => void;
  onThinkingUpdate?: (thought: string) => void;
  onToken?: (token: string, fullText: string) => void;
  onSources?: (sources: Array<{ title: string; url: string }>) => void;
  onDone?: (fullText: string) => void;
  onError?: (err: Error & { details?: string; code?: number }) => void;
}

export interface ChatStreamOptions {
  messages: any[];
  style: string;
  profileInstructions: string;
  projectInstructions?: string;
  projectKnowledge?: Array<{ title: string; content: string }>;
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
          projectInstructions: options.projectInstructions,
          projectKnowledge: options.projectKnowledge,
          model: options.model,
          effort: options.effort,
          webSearch: options.webSearch,
          extendedThinking: options.extendedThinking,
          language: options.language,
        }),
        signal,
      });

      if (!response.ok) {
        let serverErrorMsg = "";
        let serverDetails = "";
        let serverCode = response.status;
        try {
          const errData = await response.json();
          if (errData?.error) serverErrorMsg = errData.error;
          if (errData?.details) serverDetails = errData.details;
          if (errData?.code) serverCode = errData.code;
        } catch {
          // Response body was not JSON
        }

        // Read real error message from server response, or map status code
        let friendlyMsg = serverErrorMsg;
        if (!friendlyMsg) {
          if (response.status === 429) {
            friendlyMsg = "Rate limit reached, try again in a minute";
          } else if (response.status === 403) {
            friendlyMsg = "API key invalid or missing on the server";
          } else if (response.status === 404) {
            friendlyMsg = "Selected model is unavailable";
          } else {
            friendlyMsg = `HTTP Error ${response.status}: Failed to reach the AI gateway.`;
          }
        }

        const httpErr = new Error(friendlyMsg);
        (httpErr as any).details = serverDetails;
        (httpErr as any).code = serverCode;
        throw httpErr;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body received from server.");
      }

      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let accumulatedThinking = "";
      let midStreamError: (Error & { details?: string; code?: number }) | null = null;

      callbacks.onThinkingUpdate?.(""); // Initialize thinking process state

      const parser = new SSEParser({
        onThinking: (thought) => {
          accumulatedThinking += thought;
          callbacks.onThinkingUpdate?.(accumulatedThinking);
        },
        onSources: (sources) => {
          callbacks.onSources?.(sources);
        },
        onToken: (token) => {
          accumulatedContent += token;
          callbacks.onToken?.(token, accumulatedContent);
        },
        onError: (err) => {
          midStreamError = err;
        },
        onDone: () => {},
      });

      while (!isCancelled) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);

        if (midStreamError) {
          throw midStreamError;
        }
      }
      parser.flush();

      if (midStreamError) {
        throw midStreamError;
      }

      if (!isCancelled) {
        callbacks.onDone?.(accumulatedContent);
      }
    } catch (err: any) {
      if (isCancelled || err.name === "AbortError") {
        return;
      }
      console.error("Stream response error:", err);
      let message = err.message || "An unexpected error occurred.";
      if (
        err.name === "TypeError" ||
        (err.message &&
          (err.message.includes("Failed to fetch") ||
            err.message.includes("NetworkError") ||
            err.message.includes("fetch failed") ||
            err.message.includes("Load failed")))
      ) {
        message = "Backend unreachable";
      }

      const finalErr = new Error(message);
      (finalErr as any).details = err.details || (err.stack ? String(err.stack) : undefined);
      (finalErr as any).code = err.code;
      callbacks.onError?.(finalErr as any);
    }
  })();

  return () => {
    isCancelled = true;
    signal.removeEventListener("abort", onAbort);
  };
}
