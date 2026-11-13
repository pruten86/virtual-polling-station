import { supabase, isSupabaseConfigured, getVoterUUID, ensureAnonymousAuth } from './supabase';
export { ensureAnonymousAuth };
import { PollStation, Candidate, PollChannelData } from '../types';
import {
  PRESET_POLLS,
  getAllPolls,
  savePoll,
  recordOfficialVote,
  recordPollVote,
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
    // Fetch polls that are not private (public or official)
    const { data: pollsData, error: pollsError } = await supabase
      .from('polls')
      .select('*')
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

    const remotePolls: PollStation[] = pollsData.map((row: any) => {
      const candidates = (optionsMap[row.id] || []).sort(
        (a, b) => a.symbolNumber - b.symbolNumber
      );
      return {
        id: String(row.id),
        title: row.title,
        description: row.description || '',
        category: row.category || 'public',
        accessCode: row.access_code || undefined,
        adminPin: row.admin_pin || undefined,
        maxVoters: Number(row.max_voters) || 100,
        createdAt: row.created_at ? row.created_at.split('T')[0] : '2026-11-11',
        isOfficial: Boolean(row.is_official),
        isCustom: !row.is_official,
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
 * 2. Create new poll via supabase.rpc('create_voteverse_poll', { p_poll: pollData })
 */
export async function createVoteversePoll(pollData: PollStation): Promise<{ success: boolean; error?: string }> {
  // Always persist locally first so experience is immediately responsive
  savePoll(pollData);

  if (!isSupabaseConfigured || !supabase) {
    return { success: true };
  }

  const p_poll_payload = {
    id: pollData.id,
    title: pollData.title,
    description: pollData.description,
    category: pollData.category || 'public',
    access_code: pollData.accessCode || null,
    admin_pin: pollData.adminPin || null,
    max_voters: pollData.maxVoters,
    is_official: Boolean(pollData.isOfficial),
    duration_hours: pollData.durationHours || 24,
    expires_at: pollData.expiresAt ? new Date(pollData.expiresAt).toISOString() : null,
    candidates: pollData.candidates.map((c) => ({
      id: c.id,
      symbol_number: c.symbolNumber,
      symbolNumber: c.symbolNumber,
      party: c.party,
      title: c.title,
      subtitle: c.subtitle,
      badge_color: c.badgeColor,
      badgeColor: c.badgeColor,
      accent_bg: c.accentBg,
      accentBg: c.accentBg,
      description: c.description,
      vote_count: c.votes || 0,
      votes: c.votes || 0,
    })),
  };

  try {
    // 1. Primary: Call Supabase RPC as specified in spec
    const { data, error } = await supabase.rpc('create_voteverse_poll', {
      p_poll: p_poll_payload,
    });

    if (!error) {
      console.log('[create_voteverse_poll RPC success]', data);
      return { success: true };
    }

    console.warn('[create_voteverse_poll RPC returned error, attempting direct table insert fallback]', error.message);

    // 2. Resilient fallback: direct tables upsert
    await supabase.from('polls').upsert([
      {
        id: pollData.id,
        title: pollData.title,
        description: pollData.description,
        category: pollData.category,
        access_code: pollData.accessCode || null,
        admin_pin: pollData.adminPin || null,
        max_voters: pollData.maxVoters,
        is_official: Boolean(pollData.isOfficial),
        duration_hours: pollData.durationHours || 24,
        expires_at: pollData.expiresAt ? new Date(pollData.expiresAt).toISOString() : null,
        created_at: new Date().toISOString(),
      },
    ]);

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

    await supabase.from('poll_options').upsert(optionRows);

    return { success: true };
  } catch (err: any) {
    console.warn('[createVoteversePoll error]', err);
    return { success: false, error: err?.message || 'Failed to create poll' };
  }
}

/**
 * Check if current user or browser has already voted for this poll
 */
export async function checkHasVotedVoteverse(pollId: string): Promise<boolean> {
  const voterUuid = getVoterUUID();

  // 1. Check local storage cache
  try {
    if (localStorage.getItem(STORAGE_KEY_VOTED_PREFIX + pollId) === 'true') {
      return true;
    }
  } catch {
    // ignore
  }

  // 2. Query Supabase votes table
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      let query = supabase.from('votes').select('id').eq('poll_id', pollId).limit(1);

      if (userId) {
        query = query.or(`voter_uuid.eq.${voterUuid},user_id.eq.${userId}`);
      } else {
        query = query.eq('voter_uuid', voterUuid);
      }

      const { data, error } = await query;
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
  isOfficial: boolean
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
  // Check local double-voting check first
  const already = await checkHasVotedVoteverse(pollId);
  if (already) {
    return {
      success: false,
      alreadyVoted: true,
      message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)',
      updatedCandidates: currentCandidates,
    };
  }

  // Compute updated candidate counts in memory/local
  let updatedCandidates: Candidate[] = [];
  let officialState: {
    activeChannelIndex: number;
    channelVotes: number;
    totalCumulativeVotes: number;
    allChannels: PollChannelData[];
  } | undefined;

  if (isOfficial) {
    const res = recordOfficialVote(pollId, optionId, currentCandidates);
    updatedCandidates = res.cumulativeCandidates;
    officialState = {
      activeChannelIndex: res.activeChannelIndex,
      channelVotes: res.activeChannelVotes,
      totalCumulativeVotes: res.totalCumulativeVotes,
      allChannels: res.allChannels,
    };
  } else {
    updatedCandidates = recordPollVote(pollId, optionId, currentCandidates);
  }

  // If Supabase is configured, execute RPC
  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Primary: Call the specified RPC
      const { data, error } = await supabase.rpc('cast_voteverse_vote', {
        p_poll_id: pollId,
        p_option_id: optionId,
      });

      if (error) {
        const errorText = (error.message || '') + (error.details || '') + (error.code || '');
        // Check for duplicate voting violation: votes_one_per_user_per_poll or unique constraint (23505)
        const isDuplicateViolation =
          errorText.includes('votes_one_per_user_per_poll') ||
          errorText.includes('23505') ||
          errorText.includes('duplicate key') ||
          errorText.includes('unique') ||
          errorText.includes('already voted');

        if (isDuplicateViolation) {
          try {
            localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
          } catch {
            // ignore
          }
          return {
            success: false,
            alreadyVoted: true,
            message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)',
            updatedCandidates: currentCandidates,
          };
        }

        console.warn('[cast_voteverse_vote RPC fallback]', error.message);

        // Fallback: direct table insert with voter UUID and auth user ID
        const voterUuid = getVoterUUID();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;

        const { error: insertError } = await supabase.from('votes').insert([
          {
            poll_id: pollId,
            option_id: optionId,
            voter_uuid: voterUuid,
            ...(userId ? { user_id: userId } : {}),
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
            } catch {
              // ignore
            }
            return {
              success: false,
              alreadyVoted: true,
              message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)',
              updatedCandidates: currentCandidates,
            };
          }
        }

        // Increment poll_options count
        const target = updatedCandidates.find((c) => c.id === optionId);
        if (target) {
          await supabase
            .from('poll_options')
            .update({ vote_count: target.votes })
            .eq('poll_id', pollId)
            .eq('id', optionId);
        }
      } else {
        console.log('[cast_voteverse_vote RPC success]', data);
      }
    } catch (err: any) {
      console.warn('[castVoteverseVote error, retained local state]', err);
    }
  }

  // Mark local voted flag
  try {
    localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
  } catch {
    // ignore
  }

  return {
    success: true,
    alreadyVoted: false,
    updatedCandidates,
    officialState,
  };
}

/**
 * Standard castVote helper: calls cast_voteverse_vote RPC
 * Returns message and duplicate flag for UI handling
 */
export async function castVote(
  pollId: string,
  candidateId: string
): Promise<{ success: boolean; message: string; alreadyVoted?: boolean }> {
  // 1. Check double voting constraint locally & DB
  const already = await checkHasVotedVoteverse(pollId);
  if (already) {
    return {
      success: false,
      alreadyVoted: true,
      message: '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)',
    };
  }

  if (isSupabaseConfigured && supabase) {
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

        // Fallback: direct table insert with voter UUID
        const voterUuid = getVoterUUID();
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData?.session?.user?.id;

        const { error: insertError } = await supabase.from('votes').insert([
          {
            poll_id: pollId,
            option_id: candidateId,
            voter_uuid: voterUuid,
            ...(userId ? { user_id: userId } : {}),
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
        }

        // Update vote_count on poll_options
        try {
          const { data: optData } = await supabase
            .from('poll_options')
            .select('vote_count')
            .eq('poll_id', pollId)
            .eq('id', candidateId)
            .single();
          const currentCount = optData ? (Number(optData.vote_count) || 0) : 0;
          await supabase
            .from('poll_options')
            .update({ vote_count: currentCount + 1 })
            .eq('poll_id', pollId)
            .eq('id', candidateId);
        } catch {}
      } else {
        console.log('[castVote RPC success]', data);
      }
    } catch (err: any) {
      console.warn('[castVote RPC error]', err);
    }
  }

  // Mark local voted flag
  try {
    localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
  } catch {}

  return {
    success: true,
    message: '투표함에 투표용지가 성공적으로 투입되었습니다!',
  };
}

/**
 * Standard subscribePollRealtime helper:
 * Subscribes to poll_options changes and invokes callback with updated candidate vote count
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
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'poll_options',
      },
      (payload: any) => {
        const row = payload.new;
        if (row && row.id && (row.poll_id === pollId || !row.poll_id)) {
          onUpdate({
            optionId: String(row.id),
            votes: Number(row.vote_count !== undefined ? row.vote_count : row.votes) || 0,
          });
        }
      }
    )
    .on('broadcast', { event: 'vote_cast' }, ({ payload }: any) => {
      if (payload && payload.candidateId) {
        onUpdate({
          optionId: String(payload.candidateId),
          votes: -1, // signal increment
        });
      }
    })
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
      broadcastVote: () => {},
      leave: () => {},
    };
  }

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
      } catch (err) {
        // silent fail on network glitch
      }
    },
    broadcastVote: (nickname: string, candidateId: string) => {
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
      } catch (err) {
        // silent fail
      }
    },
    leave: () => {
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


