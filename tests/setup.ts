import { TextEncoder, TextDecoder } from 'text-encoding';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

afterEach(() => {
  cleanup();
});
