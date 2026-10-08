export type MessageRole = "user" | "assistant";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  isImage?: boolean;
  isPastedText?: boolean;
  wordCount?: number;
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
  isStreaming?: boolean;
}

export interface Message {
  id: string;
  parentId?: string | null;
  activeChildId?: string | null;
  childrenIds?: string[];
  role: MessageRole;
  content: string;
  attachments?: Attachment[];
  thinking?: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  isReconnecting?: boolean;
  artifactId?: string;
  createdAt: number;
  isError?: boolean;
  errorText?: string;
  errorDetails?: string;
  sources?: Array<{ title: string; url: string }>;
  isSearchingWeb?: boolean;
  thinkingStartedAt?: number;
  firstTokenAt?: number;
  thinkingMs?: number;
  finishReason?: string;
  memoryUpdated?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  projectId?: string | null;
  messages: Message[];
  rootMessageId?: string | null;
  createdAt: number;
  updatedAt: number;
  starred?: boolean;
  isTypingTitle?: boolean;
  isIncognito?: boolean;
}

export interface ProjectKnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: "text" | "file";
  fileName?: string;
  fileSize?: number;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  knowledge?: ProjectKnowledgeItem[];
  createdAt?: number;
  updatedAt: number;
}

export type ResponseStyle = "Normal" | "Concise" | "Explanatory" | "Formal";

export interface UserPreferences {
  userName?: string;
  profileInstructions: string;
  responseStyle: ResponseStyle;
  theme: "dark" | "light";
  language: "en" | "ar";
  memory_enabled?: boolean;
  sensitive_memory?: boolean;
}
