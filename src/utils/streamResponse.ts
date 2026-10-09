import { SSEParser } from "./sseParser";
import { supabase } from "./supabaseClient";

export interface StreamCallbacks {
  onThinkingStart?: () => void;
  onThinkingUpdate?: (thought: string) => void;
  onToken?: (token: string, fullText: string) => void;
  onSources?: (sources: Array<{ title: string; url: string }>) => void;
  onDone?: (fullText: string) => void;
  onError?: (err: Error & { details?: string; code?: number }) => void;
  onFinish?: (finish: string) => void;
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
  memoryEnabled?: boolean;
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

      let token = "";
      try {
        let { data: { session } } = await supabase.auth.getSession();
        
        // Refresh if session is expired or close to expiring
        if (session && session.expires_at && session.expires_at < Date.now() / 1000 + 300) {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error("Failed to refresh session:", refreshError);
            await supabase.auth.signOut();
            throw new Error("Session expired, please sign in again.");
          }
          if (refreshedSession) {
            session = refreshedSession;
          }
        }
        
        if (session?.access_token) {
          token = session.access_token;
        } else {
           throw new Error("No active session");
        }
      } catch (err: any) {
        console.warn("Could not retrieve auth session token:", err);
        throw err;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
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
          memoryEnabled: options.memoryEnabled !== false,
        }),
        signal,
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let serverErrorMsg = "";
        let serverDetails = "";
        let serverCode: number | string = response.status;
        let isJson = false;

        if (contentType && contentType.includes("application/json")) {
          try {
            const errData = await response.json();
            isJson = true;
            if (errData?.error) serverErrorMsg = errData.error;
            if (errData?.details) serverDetails = errData.details;
            if (errData?.code) serverCode = errData.code;
          } catch {
            // Failed to parse JSON even though content-type was application/json
          }
        }

        let friendlyMsg = "";
        if (isJson) {
          if (serverCode === "MODEL_NOT_FOUND") {
            friendlyMsg = "Selected model is unavailable";
          } else {
            friendlyMsg = serverErrorMsg || `HTTP Error ${response.status}: ${response.statusText}`;
          }
        } else {
          friendlyMsg = `The AI endpoint returned HTTP ${response.status} (not an API response). The backend may not be deployed.`;
          serverDetails = `Method: ${response.type}, URL: ${response.url}, Status: ${response.status}, Content-Type: ${contentType || "none"}`;
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
        onFinish: (finish) => {
           callbacks.onFinish?.(finish);
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
