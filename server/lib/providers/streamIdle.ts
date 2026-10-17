/**
 * Liveness watchdog for provider streams.
 *
 * A provider socket can die without ever closing (half-open NAT, wedged
 * upstream). Waiting on `reader.read()` then hangs the SSE response forever
 * and the UI sits on "thinking…" until the user reloads. Racing every read
 * against an idle timer guarantees the stream always TERMINATES: either data
 * arrives (timer cancelled) or we raise a STREAM_INTERRUPTED error the client
 * already knows how to display and auto-retry.
 */
export const STREAM_IDLE_TIMEOUT_MS = 90_000;

export class IdleTimeoutError extends Error {
  code = "STREAM_INTERRUPTED";
  constructor(idleMs: number) {
    super(`The provider stopped responding (no data for ${Math.round(idleMs / 1000)}s). Try again or split the task into smaller parts.`);
    this.name = "IdleTimeoutError";
  }
}

interface CancellableReader {
  read(): Promise<{ done: boolean; value?: any }>;
}

/**
 * `reader.read()` raced against an inactivity timer. The timer only measures
 * the gap until THIS read settles — normal slow-but-flowing streams never
 * trip it. A custom `idleMs` exists for tests.
 */
export async function readWithIdleTimeout(
  reader: CancellableReader,
  idleMs: number = STREAM_IDLE_TIMEOUT_MS
): Promise<{ done: boolean; value?: any }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const idle = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new IdleTimeoutError(idleMs)), idleMs);
  });
  try {
    return await Promise.race([reader.read(), idle]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const PROVIDER_HEADERS_TIMEOUT_MS = 45_000;

/**
 * Fetch that gives up when the provider never answers at all. Covers the
 * "request went out, socket wedged" case that the stream watchdog can't see
 * (it only starts once headers arrive). Aborts are forwarded so the Stop
 * button still wins immediately.
 */
export async function fetchWithConnectTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = PROVIDER_HEADERS_TIMEOUT_MS
): Promise<Response> {
  const ctrl = new AbortController();
  const outer = init.signal as AbortSignal | null | undefined;
  const forward = () => ctrl.abort();
  if (outer?.aborted) ctrl.abort();
  outer?.addEventListener("abort", forward, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (err: any) {
    if (timedOut) {
      throw Object.assign(
        new Error(
          `The provider did not start responding within ${Math.round(timeoutMs / 1000)}s. It may be down or blocked from this server.`
        ),
        { code: 504 }
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", forward);
  }
}
