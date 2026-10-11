import { Provider, ModelInfo } from './types';
import { GoogleGenAI } from '@google/genai';

export const geminiProvider: Provider = {
  id: 'gemini',
  label: 'Google AI Studio',
  docsUrl: 'https://aistudio.google.com/',
  keyHelpUrl: 'https://aistudio.google.com/app/apikey',
  async validateKey(key: string) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      await ai.models.list();
      return true;
    } catch {
      return false;
    }
  },
  async listModels(key: string) {
    const ai = new GoogleGenAI({ apiKey: key });
    const models = await ai.models.list();
    return models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => ({
        provider: 'gemini',
        id: m.name!,
        displayName: m.displayName!,
        description: m.description || null,
        contextLength: m.inputTokenLimit || null,
        maxOutputTokens: m.outputTokenLimit || null,
        inputModalities: ['text'],
        outputModalities: ['text'],
        supportsTools: !!m.supportedGenerationMethods?.includes('functionCalling'),
        supportsReasoning: false,
        supportsVision: !!m.supportedGenerationMethods?.includes('generateContent'),
        pricing: null,
        isActive: true,
        raw: m
      }));
  },
  async streamChat(params: any) {
    // Implement streaming chat
    return null;
  }
};
