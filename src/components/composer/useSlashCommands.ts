import type { Message, UserPreferences, Model } from "../../types/chat";
import type { ModelId } from "./ModelMenu";
import { useModels } from "../../hooks/useModels";

export interface SlashCommand {
  name: string;
  desc: string;
  action: string;
  badges?: {
    thinking?: boolean;
    search?: boolean;
    vision?: boolean;
  };
}

export function getSlashCommands(models: Model[]): SlashCommand[] {
  const chatModels = models.filter((m) => m.kind === "chat" && m.enabled);

  const baseCommands: SlashCommand[] = [
    { name: "/clear", desc: "Delete current chat history", action: "clear" },
    { name: "/model", desc: "Cycle active AI model", action: "model" },
  ];

  const modelCommands: SlashCommand[] = chatModels.map((m) => ({
    name: `/model ${m.display_name}`,
    desc: m.description || `Switch to ${m.display_name}`,
    action: `model:${m.slug}`,
    badges: {
      thinking: m.supports_thinking,
      search: m.supports_search,
      vision: m.supports_vision,
    },
  }));

  const otherCommands: SlashCommand[] = [
    { name: "/style", desc: "Cycle response style", action: "style" },
    { name: "/new", desc: "Start a new chat session", action: "new" },
    { name: "/export", desc: "Export chat to Markdown", action: "export" },
  ];

  return [...baseCommands, ...modelCommands, ...otherCommands];
}

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
  const { models, normalizeSlug } = useModels();
  const chatModels = models.filter((m) => m.kind === "chat" && m.enabled);

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
      const currentNorm = normalizeSlug(model);
      const currentIdx = chatModels.findIndex(
        (m) => m.slug === currentNorm || m.id === currentNorm
      );
      const nextIdx = (currentIdx + 1) % (chatModels.length || 1);
      const nextModel = chatModels[nextIdx] || chatModels[0];
      if (nextModel) {
        setModel(nextModel.slug);
        localStorage.setItem("claude_clone_last_model", nextModel.slug);
        setValue("");
        showToast(`Active model changed to ${nextModel.display_name}`, "success");
      }
    } else if (action.startsWith("model:")) {
      const selectedSlug = normalizeSlug(action.slice("model:".length));
      const targetModel = chatModels.find(
        (m) => m.slug === selectedSlug || m.id === selectedSlug
      );
      if (targetModel) {
        setModel(targetModel.slug);
        localStorage.setItem("claude_clone_last_model", targetModel.slug);
        setValue("");
        showToast(`Active model changed to ${targetModel.display_name}`, "success");
      }
    } else if (action === "export") {
      if (activeBranch && activeBranch.length > 0) {
        const md = activeBranch
          .map((m) => `### ${m.role === "user" ? "User" : "Assistant"}\n\n${m.content}`)
          .join("\n\n");
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
