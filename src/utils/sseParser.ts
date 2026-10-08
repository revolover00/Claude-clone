export interface SSEParserOptions {
  onToken?: (token: string) => void;
  onThinking?: (thought: string) => void;
  onSources?: (sources: Array<{ title: string; url: string }>) => void;
  onError?: (err: Error & { details?: string; code?: number }) => void;
  onDone?: () => void;
  onFinish?: (finish: string) => void;
}

export class SSEParser {
  private buffer = "";
  private handlers: SSEParserOptions;

  constructor(handlers: SSEParserOptions) {
    this.handlers = handlers;
  }

  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    // Preserve the last potentially incomplete line in buffer
    this.buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;

      if (trimmed === "data: [DONE]") {
        this.handlers.onDone?.();
        continue;
      }

      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6);
        let data: any;
        try {
          data = JSON.parse(jsonStr);
        } catch {
          // If JSON fails to parse, ignore this line
          continue;
        }

        // Error handling OUTSIDE of JSON parse try/catch so errors properly reach onError
        if (data && data.error) {
          const err = new Error(data.error);
          if (data.details) (err as any).details = data.details;
          if (data.code) (err as any).code = data.code;
          this.handlers.onError?.(err as any);
          continue;
        }

        if (data?.thinking) {
          this.handlers.onThinking?.(data.thinking);
        }

        if (data?.sources) {
          this.handlers.onSources?.(data.sources);
        }

        if (data?.token) {
          this.handlers.onToken?.(data.token);
        }

        if (data?.finish) {
          this.handlers.onFinish?.(data.finish);
        }
      }
    }
  }

  flush(): void {
    if (this.buffer.trim()) {
      this.feed("\n");
    }
  }
}
