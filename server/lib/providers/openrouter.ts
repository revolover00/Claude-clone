import { Provider, ModelInfo } from './types';

export const openRouterProvider: Provider = {
  id: 'openrouter',
  label: 'OpenRouter',
  docsUrl: 'https://openrouter.ai/',
  keyHelpUrl: 'https://openrouter.ai/keys',
  async validateKey(key: string) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  },
  async listModels(key: string) {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const data = await response.json();
    return data.data.map((m: any) => ({
      provider: 'openrouter',
      id: m.id,
      displayName: m.name,
      description: m.description,
      contextLength: m.context_length,
      maxOutputTokens: m.top_provider.max_completion_tokens,
      inputModalities: [],
      outputModalities: [],
      supportsTools: m.supported_parameters.includes('tools'),
      supportsReasoning: m.supported_parameters.includes('reasoning'),
      supportsVision: false,
      pricing: { inputPerMTok: parseFloat(m.pricing.prompt) * 1000000, outputPerMTok: parseFloat(m.pricing.completion) * 1000000, currency: 'USD' },
      isActive: true,
      raw: m
    }));
  },
  async streamChat(params: any) {
    return null;
  }
};
