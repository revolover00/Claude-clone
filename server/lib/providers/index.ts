import { Provider } from './types';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';
import { openRouterProvider } from './openrouter';

export const providers: Record<string, Provider> = {
  gemini: geminiProvider,
  groq: groqProvider,
  openrouter: openRouterProvider,
};

export function getProvider(id: string): Provider | undefined {
  return providers[id];
}
