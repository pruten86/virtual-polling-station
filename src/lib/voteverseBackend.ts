import { supabase, isSupabaseConfigured, ensureAnonymousAuth } from './supabase';
export { ensureAnonymousAuth };
import { PollStation, Candidate, PollChannelData } from '../types';
import {
  PRESET_POLLS,
  getAllPolls,
  savePoll,
} from '../data/presetPolls';

const STORAGE_KEY_VOTED_PREFIX = 'vps_user_voted_';

/**
 * 1. Initialize anonymous user session on app loading
 */
export async function initVoteverseSession(): Promise<string | null> {
  return await ensureAnonymousAuth();
}

/**
 * 2. Fetch public polls list from Supabase (category <> 'private')
 * Falls back to presetPolls / local storage if network or credentials are absent
 */
export async function fetchVoteversePolls(): Promise<PollStation[]> {
  const localPolls = getAllPolls();

  if (!isSupabaseConfigured || !supabase) {
    return localPolls;
  }

  try {
    // Fetch public/official polls using only actual DB columns (no is_official, access_code, admin_pin)
    const { data: pollsData, error: pollsError } = await supabase
      .from('polls')
      .select('id, title, description, category, max_voters, duration_hours, expires_at, created_at')
      .neq('category', 'private')
      .order('created_at', { ascending: false });

    if (pollsError || !pollsData || pollsData.length === 0) {
      return localPolls;
    }

    const { data: optionsData } = await supabase
      .from('poll_options')
      .select('*')
      .order('symbol_number', { ascending: true });

    const optionsMap: Record<string, Candidate[]> = {};
    if (optionsData) {
      optionsData.forEach((opt: any) => {
        const pollId = opt.poll_id || opt.pollId;
        if (!optionsMap[pollId]) {
          optionsMap[pollId] = [];
        }
        optionsMap[pollId].push({
          id: String(opt.id),
          symbolNumber: Number(opt.symbol_number !== undefined ? opt.symbol_number : opt.symbolNumber) || 1,
          party: opt.party || '',
          title: opt.title || '후보',
          subtitle: opt.subtitle || '',
          badgeColor: opt.badge_color || opt.badgeColor || 'blue',
          accentBg: opt.accent_bg || opt.accentBg || '#3b82f6',
          description: opt.description || '',
          votes: Number(opt.vote_count !== undefined ? opt.vote_count : opt.votes) || 0,
        });
      });
    }

    const officialPresetIds = new Set(PRESET_POLLS.filter((p) => p.isOfficial).map((p) => p.id));

    const remotePolls: PollStation[] = pollsData.map((row: any) => {
      const candidates = (optionsMap[row.id] || []).sort(
        (a, b) => a.symbolNumber - b.symbolNumber
      );
      const pollIdStr = String(row.id);
      const isOfficial = officialPresetIds.has(pollIdStr) || row.category === 'official';
      return {
        id: pollIdStr,
        title: row.title,
        description: row.description || '',
        category: row.category || 'public',
        maxVoters: Number(row.max_voters) || 100,
        createdAt: row.created_at ? row.created_at.split('T')[0] : '2026-11-11',
        isOfficial,
        isCustom: !isOfficial,
        durationHours: Number(row.duration_hours) || 24,
        expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
        candidates: candidates.length > 0 ? candidates : PRESET_POLLS[0].candidates,
      };
    });

    // Merge: ensure standard official preset polls are preserved
    const remoteIds = new Set(remotePolls.map((p) => p.id));
    const merged = [...remotePolls];
    PRESET_POLLS.forEach((preset) => {
      if (!remoteIds.has(preset.id)) {
        merged.push(preset);
      }
    });

    return merged;
  } catch (err) {
    console.warn('[Voteverse fetchPolls error, using local fallback]', err);
    return localPolls;
  }
}

/**
 * Fetch authoritative candidate vote counts from Supabase poll_options table
 */
export async function fetchPollTalliesFromDB(
  pollId: string,
  baseCandidates: Candidate[]
): Promise<Candidate[] | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('poll_options')
      .select('id, vote_count')
      .eq('poll_id', pollId);

    if (error || !data) {
      return null;
    }

    const countsMap = new Map<string, number>();
    data.forEach((row: any) => {
      countsMap.set(String(row.id), Number(row.vote_count) || 0);
    });

    return baseCandidates.map((c) => ({
      ...c,
      votes: countsMap.has(c.id) ? countsMap.get(c.id)! : c.votes,
    }));
  } catch (err) {
    console.warn('[fetchPollTalliesFromDB error]', err);
    return null;
  }
}

/**
 * 2. Create new poll strictly persisted to Supabase DB
 */
export async function createVoteversePoll(pollData: PollStation): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase 데이터베이스가 연결되어 있지 않습니다.' };
  }

  const userId = await ensureAnonymousAuth();
  if (!userId) {
    return { success: false, error: '익명 인증 세션을 확인할 수 없어 투표소를 생성할 수 없습니다.' };
  }

  const p_poll_payload: Record<string, any> = {
    id: pollData.id,
    title: pollData.title,
    description: pollData.description,
    category: pollData.category || 'public',
    max_voters: pollData.maxVoters,
    duration_hours: pollData.durationHours || 24,
    expires_at: pollData.expiresAt ? new Date(pollData.expiresAt).toISOString() : null,
    candidates: pollData.candidates.map((c) => ({
      id: c.id,
      symbol_number: c.symbolNumber,
      party: c.party,
      title: c.title,
      subtitle: c.subtitle,
      badge_color: c.badgeColor,
      accent_bg: c.accentBg,
      vote_count: c.votes || 0,
    })),
  };

  if (pollData.accessCode) {
    p_poll_payload.access_code = pollData.accessCode;
  }
  if (pollData.adminPin) {
    p_poll_payload.admin_pin = pollData.adminPin;
  }

  try {
    // 1. Primary: Call Supabase RPC
    const { data, error } = await supabase.rpc('create_voteverse_poll', {
      p_poll: p_poll_payload,
    });

    if (!error) {
      console.log('[create_voteverse_poll RPC success]', data);
      savePoll(pollData);
      return { success: true };
    }

    // If RPC function is not deployed in schema cache, try direct table insert using valid columns only
    if (error.code === 'PGRST202' || (error.message || '').includes('Could not find the function')) {
      const { error: pollError } = await supabase.from('polls').upsert([
        {
          id: pollData.id,
          title: pollData.title,
          description: pollData.description,
          category: pollData.category,
          max_voters: pollData.maxVoters,
          duration_hours: pollData.durationHours || 24,
          expires_at: pollData.expiresAt ? new Date(pollData.expiresAt).toISOString() : null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (pollError) {
        return { success: false, error: `투표소 DB 저장 실패: ${pollError.message}` };
      }

      const optionRows = pollData.candidates.map((c) => ({
        id: c.id,
        poll_id: pollData.id,
        symbol_number: c.symbolNumber,
        party: c.party,
        title: c.title,
        subtitle: c.subtitle,
        badge_color: c.badgeColor,
        accent_bg: c.accentBg,
        vote_count: c.votes || 0,
      }));

      const { error: optError } = await supabase.from('poll_options').upsert(optionRows);
      if (optError) {
        return { success: false, error: `후보자 DB 저장 실패: ${optError.message}` };
      }

      savePoll(pollData);
      return { success: true };
    }

    return { success: false, error: error.message || '투표소 생성 DB 저장에 실패했습니다.' };
  } catch (err: any) {
    console.warn('[createVoteversePoll error]', err);
    return { success: false, error: err?.message || '투표소 생성 중 네트워크 오류가 발생했습니다.' };
  }
}

/**
 * Check if current authenticated user has already voted for this poll (using votes.voter_id)
 */
export async function checkHasVotedVoteverse(pollId: string): Promise<boolean> {
  // 1. Check local storage cache
  try {
    if (localStorage.getItem(STORAGE_KEY_VOTED_PREFIX + pollId) === 'true') {
      return true;
    }
  } catch {
    // ignore
  }

  // 2. Query Supabase votes table using voter_id = authenticated user.id
  if (isSupabaseConfigured && supabase) {
    try {
      const userId = await ensureAnonymousAuth();
      if (!userId) return false;

      const { data, error } = await supabase
        .from('votes')
        .select('id')
        .eq('poll_id', pollId)
        .eq('voter_id', userId)
        .limit(1);

      if (!error && data && data.length > 0) {
        try {
          localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
        } catch {
          // ignore
        }
        return true;
      }
    } catch (err) {
      console.warn('[checkHasVotedVoteverse error]', err);
    }
  }

  return false;
}

/**
 * 3. Cast vote via supabase.rpc('cast_voteverse_vote', { p_poll_id: pollId, p_option_id: optionId })
 * Detects duplicate vote via votes_one_per_user_per_poll unique constraint or error
 */
export async function castVoteverseVote(
  pollId: string,
  optionId: string,
  currentCandidates: Candidate[],
  _isOfficial: boolean
): Promise<{
  success: boolean;
  alreadyVoted?: boolean;
  message?: string;
  updatedCandidates: Candidate[];
  officialState?: {
    activeChannelIndex: number;
    channelVotes: number;
    totalCumulativeVotes: number;
    allChannels: PollChannelData[];
  };
}> {
  const res = await castVote(pollId, optionId);
  if (!res.success) {
    return {
      success: false,
      alreadyVoted: res.alreadyVoted,
      message: res.message,
      updatedCandidates: currentCandidates,
    };
  }

  const fresh = (await fetchPollTalliesFromDB(pollId, currentCandidates)) || currentCandidates;
  return {
    success: true,
    alreadyVoted: false,
    updatedCandidates: fresh,
  };
}

/**
 * Strict castVote helper: calls cast_voteverse_vote RPC and ONLY returns success
 * when the vote is genuinely recorded in Supabase DB (no fake offline success fallback)
 */
export async function castVote(
  pollId: string,
  candidateId: string
): Promise<{ success: boolean; message: string; alreadyVoted?: boolean }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      message: 'Supabase 데이터베이스가 연결되지 않아 투표를 기록할 수 없습니다.',
    };
  }

  // 1. Ensure anonymous auth session (provides auth.uid() for voter_id)
  const userId = await ensureAnonymousAuth();
  if (!userId) {
    return {
      success: false,
      message: '익명 인증 세션을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.',
    };
  }

  // 2. Check double voting constraint
  const already = await checkHasVotedVoteverse(pollId);
  if (already) {
    return {
      success: false,
      alreadyVoted: true,
      message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)',
    };
  }

  try {
    const { data, error } = await supabase.rpc('cast_voteverse_vote', {
      p_poll_id: pollId,
      p_option_id: candidateId,
    });

    if (error) {
      const errorText = (error.message || '') + (error.details || '') + (error.code || '');
      const isDuplicateViolation =
        errorText.includes('votes_one_per_user_per_poll') ||
        errorText.includes('23505') ||
        errorText.includes('duplicate key') ||
        errorText.includes('unique') ||
        errorText.includes('already voted');

      if (isDuplicateViolation) {
        try {
          localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
        } catch {}
        return {
          success: false,
          alreadyVoted: true,
          message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)',
        };
      }

      const isClosed =
        errorText.includes('closed') ||
        errorText.includes('expired') ||
        errorText.includes('마감') ||
        errorText.includes('capacity');
      if (isClosed) {
        return {
          success: false,
          message: '투표가 마감되었거나 정원에 도달하여 투표를 진행할 수 없습니다.',
        };
      }

      // Only attempt direct votes insert with voter_id if RPC function does not exist
      if (error.code === 'PGRST202' || (error.message || '').includes('Could not find the function')) {
        const { error: insertError } = await supabase.from('votes').insert([
          {
            poll_id: pollId,
            option_id: candidateId,
            voter_id: userId,
          },
        ]);

        if (insertError) {
          const insertMsg = insertError.message || '';
          if (
            insertMsg.includes('votes_one_per_user_per_poll') ||
            insertMsg.includes('23505') ||
            insertMsg.includes('duplicate key')
          ) {
            try {
              localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
            } catch {}
            return {
              success: false,
              alreadyVoted: true,
              message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)',
            };
          }
          return {
            success: false,
            message: `투표 DB 저장에 실패했습니다: ${insertError.message}`,
          };
        }

        // Update vote_count on poll_options
        const { data: optData } = await supabase
          .from('poll_options')
          .select('vote_count')
          .eq('poll_id', pollId)
          .eq('id', candidateId)
          .single();
        const currentCount = optData ? (Number(optData.vote_count) || 0) : 0;
        const { error: updateError } = await supabase
          .from('poll_options')
          .update({ vote_count: currentCount + 1 })
          .eq('poll_id', pollId)
          .eq('id', candidateId);

        if (updateError) {
          return {
            success: false,
            message: `득표수 DB 갱신에 실패했습니다: ${updateError.message}`,
          };
        }
      } else {
        return {
          success: false,
          message: `투표 저장에 실패했습니다: ${error.message}`,
        };
      }
    } else {
      console.log('[castVote RPC success]', data);
    }

    // Only mark local voted flag after DB write succeeded
    try {
      localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
    } catch {}

    return {
      success: true,
      message: '투표함에 투표용지가 성공적으로 투입되었습니다!',
    };
  } catch (err: any) {
    console.warn('[castVote exception]', err);
    return {
      success: false,
      message: '네트워크 오류로 투표가 DB에 저장되지 않았습니다. 다시 시도해주세요.',
    };
  }
}

/**
 * Standard subscribePollRealtime helper:
 * Subscribes strictly to Supabase DB postgres_changes on poll_options (no broadcast +1)
 */
export function subscribePollRealtime(
  pollId: string,
  onUpdate: (data: { optionId: string; votes: number }) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const channelName = `realtime_poll_sub_${pollId}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'poll_options',
        filter: `poll_id=eq.${pollId}`,
      },
      (payload: any) => {
        const row = payload.new;
        if (row && row.id) {
          onUpdate({
            optionId: String(row.id),
            votes: Number(row.vote_count !== undefined ? row.vote_count : row.votes) || 0,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}

/**
 * Multiplayer Room Types and Synchronization
 */
export interface RemotePlayer {
  userId: string;
  nickname: string;
  avatarType: 'male' | 'female';
  x: number;
  z: number;
  rotY: number;
  isMoving?: boolean;
}

export interface PlayerMovePayload {
  userId: string;
  x: number;
  z: number;
  rotY: number;
  isMoving: boolean;
}

export interface VoteCastPayload {
  userId: string;
  nickname: string;
  candidateId: string;
}

export interface MultiplayerRoomHandle {
  channel: any;
  sendMove: (x: number, z: number, rotY: number, isMoving: boolean) => void;
  updatePresence: (x: number, z: number, rotY: number, isMoving: boolean) => void;
  broadcastVote: (nickname: string, candidateId: string) => void;
  leave: () => void;
}

/**
 * Connect to polling station room using Supabase Presence & Broadcast
 * Synchronizes connected players and actions without extra SQL tables
 */
export function joinMultiplayerRoom(
  pollId: string,
  localPlayer: {
    userId: string;
    nickname: string;
    avatarType: 'male' | 'female';
    x: number;
    z: number;
    rotY: number;
  },
  callbacks: {
    onPresenceSync: (players: RemotePlayer[]) => void;
    onPlayerMove: (payload: PlayerMovePayload) => void;
    onVoteCast: (payload: VoteCastPayload) => void;
  }
): MultiplayerRoomHandle {
  if (!isSupabaseConfigured || !supabase) {
    return {
      channel: null,
      sendMove: () => {},
      updatePresence: () => {},
      broadcastVote: () => {},
      leave: () => {},
    };
  }

  let isSubscribed = false;
  const roomChannelName = `voteverse_room_${pollId}`;
  const channel = supabase.channel(roomChannelName, {
    config: {
      presence: { key: localPlayer.userId },
    },
  });

  const parsePresenceState = () => {
    const state = channel.presenceState();
    const remotePlayers: RemotePlayer[] = [];

    Object.entries(state).forEach(([key, items]: [string, any]) => {
      if (key === localPlayer.userId) return;
      if (Array.isArray(items) && items.length > 0) {
        const latest = items[items.length - 1];
        if (latest) {
          remotePlayers.push({
            userId: latest.userId || key,
            nickname: latest.nickname || '선거인',
            avatarType: latest.avatarType === 'female' ? 'female' : 'male',
            x: typeof latest.x === 'number' ? latest.x : -6.5,
            z: typeof latest.z === 'number' ? latest.z : 0.5,
            rotY: typeof latest.rotY === 'number' ? latest.rotY : 0,
            isMoving: Boolean(latest.isMoving),
          });
        }
      }
    });

    callbacks.onPresenceSync(remotePlayers);
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      parsePresenceState();
    })
    .on('presence', { event: 'join' }, () => {
      parsePresenceState();
    })
    .on('presence', { event: 'leave' }, () => {
      parsePresenceState();
    })
    .on('broadcast', { event: 'player_move' }, ({ payload }: any) => {
      if (payload && payload.userId && payload.userId !== localPlayer.userId) {
        callbacks.onPlayerMove(payload);
      }
    })
    .on('broadcast', { event: 'vote_cast' }, ({ payload }: any) => {
      if (payload) {
        callbacks.onVoteCast(payload);
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        try {
          await channel.track({
            userId: localPlayer.userId,
            nickname: localPlayer.nickname,
            avatarType: localPlayer.avatarType,
            x: localPlayer.x,
            z: localPlayer.z,
            rotY: localPlayer.rotY,
            isMoving: false,
          });
        } catch (err) {
          console.warn('[Supabase presence track error]', err);
        }
      }
    });

  return {
    channel,
    sendMove: (x: number, z: number, rotY: number, isMoving: boolean) => {
      if (!isSubscribed) return;
      try {
        channel.send({
          type: 'broadcast',
          event: 'player_move',
          payload: {
            userId: localPlayer.userId,
            x,
            z,
            rotY,
            isMoving,
          },
        });
      } catch {
        // silent fail on network glitch
      }
    },
    updatePresence: (x: number, z: number, rotY: number, isMoving: boolean) => {
      if (!isSubscribed) return;
      try {
        channel.track({
          userId: localPlayer.userId,
          nickname: localPlayer.nickname,
          avatarType: localPlayer.avatarType,
          x,
          z,
          rotY,
          isMoving,
        });
      } catch {
        // silent fail
      }
    },
    broadcastVote: (nickname: string, candidateId: string) => {
      if (!isSubscribed) return;
      try {
        channel.send({
          type: 'broadcast',
          event: 'vote_cast',
          payload: {
            userId: localPlayer.userId,
            nickname,
            candidateId,
          },
        });
      } catch {
        // silent fail
      }
    },
    leave: () => {
      isSubscribed = false;
      try {
        channel.untrack();
      } catch {}
      supabase?.removeChannel(channel);
    },
  };
}

/**
 * ---------------------------------------------------------------------------
 * Guestbook DB & Realtime Integration (public.guestbook)
 * ---------------------------------------------------------------------------
 */
export interface GuestbookMessage {
  id: string;
  poll_id: string;
  user_id?: string;
  display_name: string;
  message: string;
  created_at: string;
}

/**
 * Fetch guestbook entries from public.guestbook ordered by created_at DESC
 */
export async function fetchGuestbook(pollId: string): Promise<GuestbookMessage[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('guestbook')
      .select('id, poll_id, display_name, message, created_at')
      .eq('poll_id', pollId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('[fetchGuestbook error]', error.message);
      return [];
    }

    if (!data) return [];

    return data.map((row: any) => ({
      id: String(row.id),
      poll_id: row.poll_id || pollId,
      display_name: row.display_name || '선거인',
      message: row.message || '',
      created_at: row.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('[fetchGuestbook exception]', err);
    return [];
  }
}

/**
 * Post a new guestbook entry to public.guestbook after ensuring anonymous auth
 */
export async function postGuestbookMessage(
  pollId: string,
  displayName: string,
  message: string
): Promise<{ success: boolean; data?: GuestbookMessage; error?: string }> {
  const trimmedMsg = message.trim();
  const trimmedName = (displayName || '선거인').trim();
  if (!trimmedMsg) {
    return { success: false, error: '내용을 입력해 주세요.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase DB가 연결되어 있지 않습니다.' };
  }

  try {
    let userId = await ensureAnonymousAuth();
    if (!userId) {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    }

    if (!userId) {
      return { success: false, error: '익명 인증 세션을 확인할 수 없습니다.' };
    }

    const { data, error } = await supabase
      .from('guestbook')
      .insert([
        {
          poll_id: pollId,
          user_id: userId,
          display_name: trimmedName,
          message: trimmedMsg,
        },
      ])
      .select('id, poll_id, user_id, display_name, message, created_at')
      .single();

    if (error) {
      console.warn('[postGuestbookMessage insert error]', error.message);
      return { success: false, error: error.message };
    }

    const created: GuestbookMessage = data
      ? {
          id: String(data.id),
          poll_id: data.poll_id || pollId,
          user_id: data.user_id || userId,
          display_name: data.display_name || trimmedName,
          message: data.message || trimmedMsg,
          created_at: data.created_at || new Date().toISOString(),
        }
      : {
          id: 'gb_' + Date.now().toString(36),
          poll_id: pollId,
          user_id: userId,
          display_name: trimmedName,
          message: trimmedMsg,
          created_at: new Date().toISOString(),
        };

    return { success: true, data: created };
  } catch (err: any) {
    console.warn('[postGuestbookMessage exception]', err);
    return { success: false, error: err?.message || '방명록 등록 중 오류가 발생했습니다.' };
  }
}

/**
 * Subscribe to real-time INSERT events on public.guestbook for a specific poll
 */
export function subscribeGuestbookRealtime(
  pollId: string,
  onNewMessage: (entry: GuestbookMessage) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const channelName = `realtime_guestbook_${pollId}_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'guestbook',
        filter: `poll_id=eq.${pollId}`,
      },
      (payload: any) => {
        const row = payload.new;
        if (row && row.id && (!row.poll_id || row.poll_id === pollId)) {
          onNewMessage({
            id: String(row.id),
            poll_id: row.poll_id || pollId,
            user_id: row.user_id,
            display_name: row.display_name || '선거인',
            message: row.message || '',
            created_at: row.created_at || new Date().toISOString(),
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
}


