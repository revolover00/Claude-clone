import { TextEncoder } from 'text-encoding';
import { TextDecoder } from 'node:util';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

afterEach(() => {
  cleanup();
});
