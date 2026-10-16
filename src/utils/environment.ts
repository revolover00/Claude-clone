/** Browser-environment probes used by the iframe banner and the diagnostics panel. */

/** True when the app runs inside an iframe (e.g. an embedded preview). */
export function isInIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Reading window.top can throw cross-origin, which only happens inside a frame.
    return true;
  }
}

/** Whether localStorage can actually be written (it is often blocked in embedded previews). */
export function isStorageAvailable(): boolean {
  try {
    const probeKey = "__claude_storage_probe__";
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/** Opens the current page in a new top-level tab, outside any embedding frame. */
export function openAppInNewTab(): void {
  window.open(window.location.href, "_blank", "noopener,noreferrer");
}

/** Copies text, falling back to execCommand when the Clipboard API is blocked (iframes). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
