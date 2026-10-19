import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importLocalChatsToSupabase } from '../src/utils/supabaseImport';
import { supabase } from '../src/utils/supabaseClient';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

vi.mock('../src/utils/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  },
}));

describe('importLocalChatsToSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('runs only once even if called concurrently', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'claude_clone_conversations_v3') return JSON.stringify([{ id: '1', title: 'test', messages: [] }]);
      return null;
    });
    
    await Promise.all([
      importLocalChatsToSupabase('user1'),
      importLocalChatsToSupabase('user1'),
    ]);
    
    expect(supabase.from).toHaveBeenCalledTimes(1); 
  });
  
  it('does nothing if already imported', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === 'claude-clone:imported:user1') return 'true';
      if (key === 'claude_clone_conversations_v3') return JSON.stringify([{ id: '1', title: 'test', messages: [] }]);
      return null;
    });
    
    await importLocalChatsToSupabase('user1');
    
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
