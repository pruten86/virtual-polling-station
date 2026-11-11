import { supabase } from './supabase';

export interface DBPollOption {
  id: string;
  poll_id: string;
  symbol_number: number;
  title: string;
  subtitle?: string;
  party?: string;
  badge_color?: string;
  accent_bg?: string;
  description?: string;
  vote_count: number;
}

export async function ensureAnonymousAuth() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error('Anonymous auth failed:', error);
      return null;
    }
    return data.user;
  } catch (err) {
    console.error('Auth check error:', err);
    return null;
  }
}

export async function fetchPollsWithCandidates() {
  try {
    const { data: polls, error: pollErr } = await supabase
      .from('polls')
      .select('*')
      .neq('category', 'private')
      .order('created_at', { ascending: false });

    if (pollErr || !polls || polls.length === 0) return null;

    const { data: options, error: optErr } = await supabase
      .from('poll_options')
      .select('*')
      .order('symbol_number', { ascending: true });

    if (optErr || !options) return null;

    return polls.map((p) => ({
      ...p,
      candidates: options.filter((o) => o.poll_id === p.id),
    }));
  } catch (err) {
    console.error('fetchPolls error:', err);
    return null;
  }
}

export async function castVote(pollId: string, optionId: string) {
  await ensureAnonymousAuth();
  const { data, error } = await supabase.rpc('cast_voteverse_vote', {
    p_poll_id: pollId,
    p_option_id: optionId,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('votes_one_per_user_per_poll') || msg.includes('unique')) {
      return { success: false, code: 'ALREADY_VOTED', message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)' };
    }
    if (msg.includes('Poll is closed') || msg.includes('Poll has expired')) {
      return { success: false, code: 'POLL_CLOSED', message: '이미 마감된 투표소입니다.' };
    }
    if (msg.includes('capacity')) {
      return { success: false, code: 'CAPACITY_REACHED', message: '투표소 정원이 마감되었습니다.' };
    }
    return { success: false, code: 'ERROR', message: msg };
  }

  return { success: true, data };
}

export async function createPoll(pollPayload: any) {
  await ensureAnonymousAuth();
  const { data, error } = await supabase.rpc('create_voteverse_poll', {
    p_poll: pollPayload,
  });
  if (error) throw error;
  return data as string;
}

export function subscribePollRealtime(
  pollId: string,
  onOptionUpdated: (updatedOption: DBPollOption) => void
) {
  const channel = supabase
    .channel(`poll_realtime_${pollId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'poll_options',
        filter: `poll_id=eq.${pollId}`,
      },
      (payload) => {
        if (payload.new) {
          onOptionUpdated(payload.new as DBPollOption);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
