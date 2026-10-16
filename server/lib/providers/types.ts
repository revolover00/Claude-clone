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
  pricing: { inputPerMTok: number; outputPerMTok: number; currency: string } | null;
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
