export interface FallbackModel {
  id: string;
  slug: string;
  display_name: string;
  description: string;
  provider: string;
  api_model_id: string;
  kind: "chat" | "light" | "embedding";
  supports_thinking: boolean;
  supports_tools: boolean;
  supports_search: boolean;
  supports_vision: boolean;
  max_output_tokens: number | null;
  enabled: boolean;
  is_default: boolean;
  sort_order: number;
}

export const FALLBACK_MODELS: FallbackModel[] = [
  {
    id: "gemini-3-8-flash",
    slug: "gemini-3-8-flash",
    display_name: "Gemini 3.8 Flash",
    description: "Fast and highly balanced intelligence, ideal for general chat and multimodal tasks.",
    provider: "google",
    api_model_id: "gemini-3.8-flash",
    kind: "chat",
    supports_thinking: true,
    supports_tools: false,
    supports_search: true,
    supports_vision: true,
    max_output_tokens: null,
    enabled: true,
    is_default: true,
    sort_order: 1,
  },
  {
    id: "gemini-3-1-pro",
    slug: "gemini-3-1-pro",
    display_name: "Gemini 3.1 Pro Preview",
    description: "State-of-the-art capability for complex tasks and deep reasoning.",
    provider: "google",
    api_model_id: "gemini-3.1-pro-preview",
    kind: "chat",
    supports_thinking: true,
    supports_tools: true,
    supports_search: true,
    supports_vision: true,
    max_output_tokens: null,
    enabled: true,
    is_default: false,
    sort_order: 2,
  },
  {
    id: "gemini-3-1-flash-lite",
    slug: "gemini-3-1-flash-lite",
    display_name: "Gemini 3.1 Flash Lite",
    description: "Incredible speed and low latency for quick conversations and summaries.",
    provider: "google",
    api_model_id: "gemini-3.1-flash-lite",
    kind: "chat",
    supports_thinking: true,
    supports_tools: false,
    supports_search: false,
    supports_vision: true,
    max_output_tokens: null,
    enabled: true,
    is_default: false,
    sort_order: 3,
  },
  {
    id: "gemini-embedding-2",
    slug: "gemini-embedding-2",
    display_name: "Gemini Embedding 2",
    description: "Multimodal embeddings for text, images, audio, video, and documents.",
    provider: "google",
    api_model_id: "gemini-embedding-2",
    kind: "embedding",
    supports_thinking: false,
    supports_tools: false,
    supports_search: false,
    supports_vision: false,
    max_output_tokens: null,
    enabled: true,
    is_default: false,
    sort_order: 4,
  },
];
