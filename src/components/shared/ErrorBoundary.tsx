import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  fallbackType?: "page" | "artifact" | "message" | "card";
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(
            this.state.error || new Error("Unknown error"),
            this.handleReset
          );
        }
        return this.props.fallback;
      }

      const { fallbackType = "card" } = this.props;

      if (fallbackType === "message") {
        return (
          <div className="my-3 flex items-center justify-between rounded-xl border border-danger/30 bg-danger-bg p-3 text-[13.5px] text-ink">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={15} className="shrink-0" />
              <span>Something went wrong with this message</span>
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-elev-2 px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-elev-3 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          </div>
        );
      }

      if (fallbackType === "artifact") {
        return (
          <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-danger-bg text-danger mb-3">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-[15px] font-medium text-ink">
              Unable to render artifact
            </h4>
            <p className="mt-1 max-w-xs text-[13px] text-ink-muted leading-relaxed">
              An error occurred while evaluating this artifact preview.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-elev-2 px-3.5 py-1.5 text-[13px] font-medium text-ink hover:bg-elev-3 transition-colors"
            >
              <RotateCcw size={13} />
              <span>Retry</span>
            </button>
          </div>
        );
      }

      if (fallbackType === "page") {
        return (
          <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-shell p-6 text-center font-sans">
            <div className="w-full max-w-md rounded-2xl border border-line bg-elev-1 p-8 shadow-2xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-danger-bg text-danger mb-4">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-[20px] font-medium text-ink">
                Something went wrong
              </h2>
              <p className="mt-2 text-[14px] text-ink-muted leading-relaxed">
                An unexpected error occurred in the application. You can retry to reload the state.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
                >
                  <RotateCcw size={14} />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Default card fallback
      return (
        <div className="my-2 flex items-center justify-between rounded-lg border border-line bg-elev-1 px-3.5 py-2 text-[13px] text-ink-soft">
          <span className="flex items-center gap-2 text-ink-muted">
            <AlertTriangle size={14} className="text-danger" />
            <span>Something went wrong</span>
          </span>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[12px] font-medium text-accent hover:underline"
          >
            <RotateCcw size={12} />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
