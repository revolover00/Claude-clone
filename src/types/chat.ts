export type MessageRole = "user" | "assistant";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  isImage?: boolean;
}

export interface ArtifactVersion {
  version: number;
  content: string;
  createdAt: number;
}

export interface Artifact {
  id: string;
  identifier: string;
  title: string;
  language: string;
  type: string;
  code: string;
  chatId: string;
  chatTitle: string;
  version: number;
  versions?: ArtifactVersion[];
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  attachments?: Attachment[];
  thinking?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  artifactId?: string;
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

export type ResponseStyle = "Normal" | "Concise" | "Explanatory" | "Formal";

export interface UserPreferences {
  profileInstructions: string;
  responseStyle: ResponseStyle;
  theme: "dark" | "light";
  language: "en" | "ar";
}
