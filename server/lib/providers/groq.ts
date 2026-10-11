import { Provider, ModelInfo } from './types';

export const groqProvider: Provider = {
  id: 'groq',
  label: 'Groq',
  docsUrl: 'https://console.groq.com/',
  keyHelpUrl: 'https://console.groq.com/keys',
  async validateKey(key: string) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  },
  async listModels(key: string) {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const data = await response.json();
    return data.data.map((m: any) => ({
      provider: 'groq',
      id: m.id,
      displayName: m.id,
      description: null,
      contextLength: m.context_window,
      maxOutputTokens: null,
      inputModalities: ['text'],
      outputModalities: ['text'],
      supportsTools: true,
      supportsReasoning: false,
      supportsVision: false,
      pricing: null,
      isActive: m.active,
      raw: m
    }));
  },
  async streamChat(params: any) {
    return null;
  }
};
