export type MessageRole = "user" | "assistant";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  isImage?: boolean;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: Attachment[];
  thinking?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  starred?: boolean;
  isTypingTitle?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
}

export interface Artifact {
  id: string;
  title: string;
  language: string;
  code: string;
  chatId: string;
  chatTitle: string;
  createdAt: number;
}

export type ResponseStyle = "Normal" | "Concise" | "Explanatory" | "Formal";

export interface UserPreferences {
  profileInstructions: string;
  responseStyle: ResponseStyle;
  theme: "dark" | "light";
  language: "en" | "ar";
}
