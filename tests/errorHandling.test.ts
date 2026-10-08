import { describe, it, expect } from 'vitest';
import { mapGeminiError } from '../server/lib/gemini';
import app from '../api/index';

describe('error mapping', () => {
  it('maps JSON 404 to MODEL_NOT_FOUND', () => {
    const err = { status: 404, message: 'Not found' };
    const result = mapGeminiError(err, 'model-id');
    expect(result.status).toBe(404);
    expect(result.code).toBe('MODEL_NOT_FOUND');
    expect(result.details).toEqual({ requestedModelId: 'model-id' });
  });

  it('maps 429', () => {
    const err = { status: 429, message: 'Rate limit' };
    const result = mapGeminiError(err);
    expect(result.status).toBe(429);
  });

  it('maps 403', () => {
    const err = { status: 403, message: 'Forbidden' };
    const result = mapGeminiError(err);
    expect(result.status).toBe(403);
  });
});

describe('Vercel API export', () => {
  it('exports an express app', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
    expect(app.get).toBeDefined();
    expect(app.post).toBeDefined();
  });
});
