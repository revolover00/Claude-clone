/** Small helpers to open Settings on a specific tab from anywhere in the app. */
export const SETTINGS_TAB_EVENT = "claude:settings-tab";

export function requestSettingsTab(tab: string): void {
  try {
    localStorage.setItem("claude_clone_settings_tab", tab);
  } catch {
    /* storage may be unavailable (private mode) */
  }
  window.dispatchEvent(new CustomEvent(SETTINGS_TAB_EVENT, { detail: tab }));
}
