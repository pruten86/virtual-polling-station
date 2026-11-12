import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
// Support both VITE_SUPABASE_PUBLISHABLE_KEY (standard) and VITE_SUPABASE_ANON_KEY (legacy)
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project-id') &&
  supabaseKey !== 'your-anon-key' &&
  supabaseKey !== 'your-publishable-key'
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Automatically ensures an anonymous auth session is active for multiplayer voting
 */
export async function ensureAnonymousAuth(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.warn('[Supabase getSession warning]', sessionError.message);
    }
    if (session?.user) {
      return session.user.id;
    }

    const { data, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      console.warn('[Supabase anonymous auth warning]', signInError.message);
      return null;
    }
    return data.user?.id || null;
  } catch (err) {
    console.warn('[Supabase auth init failed]', err);
    return null;
  }
}

/**
 * Returns a persistent unique identifier for this browser/device to prevent double-voting
 */
export function getVoterUUID(): string {
  const KEY = 'voter_browser_uuid_v1';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = 'voter_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // ignore in incognito if restricted
    }
  }
  return id;
}

export interface GuestbookEntry {
  id: string;
  pollId: string;
  nickname: string;
  message: string;
  createdAt: string;
}
