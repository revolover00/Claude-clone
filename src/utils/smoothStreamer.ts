import {
  getAdaptiveDrainRate,
  adjustDrainBoundary,
} from "./streamSmoothing";

export interface SmoothStreamerOptions {
  onUpdate: (displayedText: string, isFinished: boolean) => void;
  onFlushComplete?: (finalText: string) => void;
}

export class SmoothStreamer {
  private queue = "";
  private displayed = "";
  private rafId: number | null = null;
  private isStreamDone = false;
  private flushTimeoutId: any = null;
  private onUpdate: (displayedText: string, isFinished: boolean) => void;
  private onFlushComplete?: (finalText: string) => void;

  constructor(options: SmoothStreamerOptions) {
    this.onUpdate = options.onUpdate;
    this.onFlushComplete = options.onFlushComplete;
  }

  /**
   * Resets the streamer state for a fresh response.
   */
  start(): void {
    this.stop();
    this.queue = "";
    this.displayed = "";
    this.isStreamDone = false;
  }

  /**
   * Pushes incoming raw tokens into the queue ref.
   * Starts the rAF draining loop if not already running.
   */
  push(token: string): void {
    if (!token) return;
    this.queue += token;
    this.ensureLoopRunning();
  }

  /**
   * Called when server stream finishes (e.g. onDone from SSE).
   * Ensures the remaining queue is completely flushed within at most 400ms.
   */
  markDone(): void {
    this.isStreamDone = true;
    if (this.queue.length === 0) {
      this.cancelRaf();
      this.onUpdate(this.displayed, true);
      this.onFlushComplete?.(this.displayed);
      return;
    }

    // Set a hard deadline to force flush any remaining text within 400ms
    if (!this.flushTimeoutId) {
      this.flushTimeoutId = setTimeout(() => {
        this.flushImmediate();
      }, 400);
    }

    this.ensureLoopRunning();
  }

  /**
   * Immediately flushes all remaining text in the queue.
   * Used on user "Stop" or hard timeout.
   */
  flushImmediate(): void {
    this.cancelRaf();
    if (this.flushTimeoutId) {
      clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }

    if (this.queue.length > 0) {
      this.displayed += this.queue;
      this.queue = "";
    }
    this.isStreamDone = true;
    this.onUpdate(this.displayed, true);
    this.onFlushComplete?.(this.displayed);
  }

  /**
   * Cancels animation frames and timeouts without losing already displayed text.
   */
  stop(): void {
    this.cancelRaf();
    if (this.flushTimeoutId) {
      clearTimeout(this.flushTimeoutId);
      this.flushTimeoutId = null;
    }
  }

  getDisplayedText(): string {
    return this.displayed;
  }

  private ensureLoopRunning(): void {
    if (this.rafId === null) {
      if (typeof requestAnimationFrame !== "undefined") {
        this.rafId = requestAnimationFrame(this.tick);
      } else {
        this.rafId = setTimeout(this.tick, 16) as any;
      }
    }
  }

  private cancelRaf(): void {
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(this.rafId);
      } else {
        clearTimeout(this.rafId);
      }
      this.rafId = null;
    }
  }

  private tick = (): void => {
    this.rafId = null;

    if (this.queue.length === 0) {
      if (this.isStreamDone) {
        if (this.flushTimeoutId) {
          clearTimeout(this.flushTimeoutId);
          this.flushTimeoutId = null;
        }
        this.onUpdate(this.displayed, true);
        this.onFlushComplete?.(this.displayed);
      }
      return;
    }

    // Determine characters to drain this frame
    let charsPerFrame = getAdaptiveDrainRate(this.queue.length);

    // If stream is done, accelerate drain so it catches up comfortably before 400ms
    if (this.isStreamDone) {
      // 400ms is ~24 frames at 60Hz. Ensure at least queueLength / 15 chars/frame
      const accelerated = Math.ceil(this.queue.length / 15);
      charsPerFrame = Math.max(charsPerFrame, accelerated);
    }

    // Boundary check: surrogate pairs & markdown delimiters
    const boundary = adjustDrainBoundary(this.queue, charsPerFrame);
    const chunk = this.queue.slice(0, boundary);
    this.queue = this.queue.slice(boundary);

    this.displayed += chunk;
    this.onUpdate(this.displayed, false);

    // Schedule next frame if queue still has tokens
    if (this.queue.length > 0) {
      this.ensureLoopRunning();
    } else if (this.isStreamDone) {
      if (this.flushTimeoutId) {
        clearTimeout(this.flushTimeoutId);
        this.flushTimeoutId = null;
      }
      this.onUpdate(this.displayed, true);
      this.onFlushComplete?.(this.displayed);
    }
  };
}
