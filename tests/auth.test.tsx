import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginView from '../src/components/views/LoginView';
import { supabase } from '../src/utils/supabaseClient';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../src/context/ToastContext';

vi.mock('../src/utils/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      signInWithOAuth: vi.fn(),
      resend: vi.fn(),
    },
  },
}));

vi.mock('../src/context/ToastContext', () => ({
  ToastProvider: ({ children }: any) => children,
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('Auth Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects already registered email during signup', async () => {
    (supabase.auth.signUp as any).mockResolvedValue({
      data: { user: { identities: [] } },
      error: null,
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <LoginView />
        </ToastProvider>
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText(/Don't have an account\? Sign up/i));
    fireEvent.change(screen.getByPlaceholderText(/Email address/i), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByText(/Create Account/i));

    await waitFor(() => {
      expect(screen.getByText(/Sign In/i)).toBeDefined();
    });
  });
});
