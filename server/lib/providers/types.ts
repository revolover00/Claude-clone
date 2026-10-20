export interface ModelInfo {
  provider: string;
  id: string;
  displayName: string;
  description: string | null;
  contextLength: number | null;
  maxOutputTokens: number | null;
  inputModalities: string[];
  outputModalities: string[];
  supportsTools: boolean;
  supportsReasoning: boolean;
  supportsVision: boolean;
  /** Structured JSON output (response_format / structured_outputs). */
  supportsJson?: boolean;
  pricing: { inputPerMTok: number; outputPerMTok: number; currency: string } | null;
  /** Release date (ISO date) when the provider reports one. */
  releasedAt?: string | null;
  /** API-reported expiration date, when present. */
  expiresAt?: string | null;
  /** Owning organization (Groq owned_by, OpenRouter vendor …). */
  ownedBy?: string | null;
  isActive: boolean;
  /** Catalog classification: chat, embedding, image, audio, video, rerank, moderation, other. */
  kind?: string;
  raw: any;
}

export interface ValidationResult {
  valid: boolean;
  status?: number;
  code?: string;
  message?: string;
}

export interface ProviderStreamParams {
  modelId: string;
  apiKey: string;
  messages: any[];
  config?: any;
  res: any;
  abortSignal?: AbortSignal;
  thinkingPlan?: { level: string; reason?: string };
  /** Idle watchdog + connect timeout overrides in ms (ops/test knob). */
  idleTimeoutMs?: number;
  connectTimeoutMs?: number;
  /** Priority-ordered fallback keys; when present the transport rotates past quota/auth failures. */
  apiKeys?: Array<{ id?: string; label?: string; key: string }>;
  onKeyFailure?: (id: string, code: "KEY_INVALID" | "CREDITS_EXHAUSTED" | "RATE_LIMITED") => Promise<void> | void;
  /** Optional MCP tool declarations (Gemini-style schema; normalized by the shared transport). */
  externalTools?: Array<Record<string, any>>;
  executeToolCall?: (call: { name: string; args: Record<string, any> }) => Promise<{ result: string; skillName?: string; toolError?: boolean } | null>;
}

export interface Provider {
  id: string;
  label: string;
  docsUrl: string;
  keyHelpUrl: string;
  validateKey(key: string): Promise<ValidationResult>;
  listModels(key: string): Promise<ModelInfo[]>;
  streamChat(params: ProviderStreamParams): Promise<any>;
}
