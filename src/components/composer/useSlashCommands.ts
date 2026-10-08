import type { Message, UserPreferences } from "../../types/chat";
import type { ModelId } from "./ModelMenu";

export interface SlashCommand {
  name: string;
  desc: string;
  action: string;
}

export const COMMANDS: SlashCommand[] = [
  { name: "/clear", desc: "Delete current chat history", action: "clear" },
  { name: "/model", desc: "Cycle active AI model", action: "model" },
  { name: "/style", desc: "Cycle response style", action: "style" },
  { name: "/new", desc: "Start a new chat session", action: "new" },
  { name: "/export", desc: "Export chat to Markdown", action: "export" },
];

interface SlashCommandsOptions {
  activeConversationId: string | null;
  activeBranch: Message[];
  preferences: UserPreferences;
  model: ModelId;
  setModel: (m: ModelId) => void;
  setValue: (v: string) => void;
  createNewChat: () => void;
  deleteConversation: (id: string) => void;
  updatePreferences: (p: Partial<UserPreferences>) => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export function useSlashCommands({
  activeConversationId,
  activeBranch,
  preferences,
  model,
  setModel,
  setValue,
  createNewChat,
  deleteConversation,
  updatePreferences,
  showToast,
}: SlashCommandsOptions) {
  const executeCommand = (action: string) => {
    if (action === "new") {
      createNewChat();
      setValue("");
      showToast("Started a new chat session", "success");
    } else if (action === "clear") {
      if (activeConversationId) deleteConversation(activeConversationId);
      createNewChat();
      setValue("");
      showToast("Chat history deleted", "info");
    } else if (action === "style") {
      const styles = ["Normal", "Concise", "Explanatory", "Formal"] as const;
      const currentIdx = styles.indexOf(preferences.responseStyle);
      const nextIdx = (currentIdx + 1) % styles.length;
      updatePreferences({ responseStyle: styles[nextIdx] });
      setValue("");
      showToast(`Response style set to ${styles[nextIdx]}`, "success");
    } else if (action === "model") {
      const modelIds: ModelId[] = ["sonnet-5", "opus-5", "haiku-4-5"];
      const nextIdx = (modelIds.indexOf(model) + 1) % modelIds.length;
      setModel(modelIds[nextIdx]);
      setValue("");
      const modelNames: Record<string, string> = { "sonnet-5": "Sonnet 5", "opus-5": "Opus 5", "haiku-4-5": "Haiku 4.5" };
      showToast(`Active model changed to ${modelNames[modelIds[nextIdx]]}`, "success");
    } else if (action === "export") {
      if (activeBranch && activeBranch.length > 0) {
         const md = activeBranch.map((m) => `### ${m.role === "user" ? "User" : "Assistant"}\n\n${m.content}`).join("\n\n");
         const blob = new Blob([md], { type: "text/markdown" });
         const a = document.createElement("a");
         a.href = URL.createObjectURL(blob);
         a.download = `chat-export-${Date.now()}.md`;
         a.click();
         showToast("Chat exported as Markdown", "success");
      } else {
        showToast("No chat history to export", "info");
      }
      setValue("");
    }
  };

  return {
    executeCommand,
  };
}
