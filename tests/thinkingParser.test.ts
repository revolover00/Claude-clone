import { describe, it, expect } from 'vitest';
import { parseThinkingStages } from '../src/utils/thinkingStages';

describe('parseThinkingStages', () => {
  it('parses stages correctly', () => {
    const text = "**Planning**\n\nI need to plan.\n\n**Executing**\n\nExecuting now.";
    const stages = parseThinkingStages(text);
    expect(stages.length).toBe(2);
    expect(stages[0].title).toBe('Planning');
    expect(stages[0].done).toBe(true); 
    expect(stages[1].title).toBe('Executing');
    expect(stages[1].done).toBe(false);
  });

  it('handles initial thinking text', () => {
    const text = "Initial thinking.\n\n**Planning**\n\nPlan body.";
    const stages = parseThinkingStages(text);
    expect(stages.length).toBe(2);
    expect(stages[0].title).toBe('Thinking');
    expect(stages[0].done).toBe(true);
    expect(stages[1].title).toBe('Planning');
  });
});
