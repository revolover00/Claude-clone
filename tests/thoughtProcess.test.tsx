import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ThoughtProcess from '../src/components/chat/ThoughtProcess';

describe('ThoughtProcess', () => {
  it('renders 4 timeline nodes for 4 stages', async () => {
    const thoughts = "**Stage 1**\n\nBody 1\n\n**Stage 2**\n\nBody 2\n\n**Stage 3**\n\nBody 3\n\n**Stage 4**\n\nBody 4";
    render(<ThoughtProcess isThinking={true} thoughts={thoughts} hasAnswerToken={false} />);
    
    // Toggle to expand
    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Check for timeline nodes
    await waitFor(async () => {
      expect(await screen.findByText(/Stage 1/i)).toBeDefined();
      expect(await screen.findByText(/Stage 2/i)).toBeDefined();
      expect(await screen.findByText(/Stage 3/i)).toBeDefined();
      expect(await screen.findByText(/Stage 4/i)).toBeDefined();
    });
  });
});
