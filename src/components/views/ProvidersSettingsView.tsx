import React from 'react';
import { ProviderCard } from './ProviderCard';

export const ProvidersSettingsView: React.FC = () => {
  const providers = [
    { id: 'gemini', name: 'Google AI Studio', status: 'active', last4: '1234', lastVerified: '10m ago', docsUrl: 'https://aistudio.google.com/' },
    { id: 'groq', name: 'Groq', status: 'disconnected', docsUrl: 'https://console.groq.com/' },
    { id: 'openrouter', name: 'OpenRouter', status: 'disconnected', docsUrl: 'https://openrouter.ai/' },
  ];

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Providers</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map(p => (
          <ProviderCard key={p.id} {...(p as any)} />
        ))}
      </div>
    </div>
  );
};
