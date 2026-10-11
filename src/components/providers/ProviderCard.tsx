import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shared/Card';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { Badge } from '@/components/shared/Badge';

interface ProviderCardProps {
  id: string;
  name: string;
  status: 'disconnected' | 'active' | 'invalid' | 'rate_limited';
  last4?: string;
  lastVerified?: string;
  docsUrl: string;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ id, name, status, last4, lastVerified, docsUrl }) => {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleConnect = async () => {
    // API Call logic
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{name}</CardTitle>
        <Badge variant={status === 'active' ? 'success' : 'secondary'}>{status}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === 'disconnected' && (
          <div className="space-y-2">
            <Input 
              type={showKey ? 'text' : 'password'} 
              placeholder="Paste your API key" 
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={handleConnect}>Connect</Button>
              <Button variant="ghost" onClick={() => setShowKey(!showKey)}>{showKey ? 'Hide' : 'Show'}</Button>
            </div>
          </div>
        )}
        {status === 'active' && (
          <div className="text-sm text-muted-foreground">
            <p>Last 4: ****{last4}</p>
            <p>Verified: {lastVerified}</p>
          </div>
        )}
        <a href={docsUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline">Get a key</a>
      </CardContent>
    </Card>
  );
};
