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
  raw: any;
}

export interface Provider {
  id: string;
  label: string;
  docsUrl: string;
  keyHelpUrl: string;
  validateKey(key: string): Promise<boolean>;
  listModels(key: string): Promise<ModelInfo[]>;
  streamChat(params: any): Promise<any>;
}
