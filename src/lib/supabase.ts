import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://argsvpgtsvrdjsksuvnv.supabase.co';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseUrl =
  rawUrl &&
  typeof rawUrl === 'string' &&
  rawUrl.trim().startsWith('https://') &&
  !rawUrl.includes('your-project-id')
    ? rawUrl.trim()
    : DEFAULT_SUPABASE_URL;

// Support either VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY
const rawKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  '';
const supabaseKey =
  typeof rawKey === 'string' &&
  rawKey.trim() !== '' &&
  rawKey !== 'your-anon-key' &&
  rawKey !== 'your-publishable-key'
    ? rawKey.trim()
    : '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('https://') &&
  supabaseKey
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

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns a persistent unique UUID for this browser/device (safe fallback when anonymous auth is delayed/disabled)
 */
export function getVoterUUID(): string {
  const KEY = 'voter_browser_uuid_v1';
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
  } catch {
    // ignore in restricted storage
  }
  if (!id || !UUID_REGEX.test(id)) {
    id = generateUuidV4();
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // ignore in incognito if restricted
    }
  }
  return id;
}

/**
 * Returns a unique per-tab/per-window ID via sessionStorage for 100% distinct multiplayer Presence avatars
 */
export function getMultiplayerSessionId(): string {
  const KEY = 'voteverse_multiplayer_tab_id_v1';
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = `peer_${generateUuidV4()}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `peer_${generateUuidV4()}`;
  }
}

export interface GuestbookEntry {
  id: string;
  pollId: string;
  nickname: string;
  message: string;
  createdAt: string;
}

