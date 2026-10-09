import { TextEncoder, TextDecoder } from 'text-encoding';

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;
