import {
  supabase,
  isSupabaseConfigured,
  ensureAnonymousAuth,
  getVoterUUID,
  getMultiplayerSessionId as getSupabaseMultiplayerSessionId,
} from './supabase';
export { ensureAnonymousAuth };

let fallbackSessionId: string | null = null;

/**
 * 1-1. Per-tab / per-device unique multiplayer session ID ('mp_' + randomUUID)
 */
export function getMultiplayerSessionId(): string {
  if (typeof window === 'undefined') {
    if (!fallbackSessionId) {
      fallbackSessionId = `mp_${Math.random().toString(36).slice(2, 12)}`;
    }
    return fallbackSessionId;
  }
  return getSupabaseMultiplayerSessionId();
}
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

let presetSeedPromise: Promise<void> | null = null;

/**
 * Ensures a specific poll and all its options exist in Supabase DB without overwriting existing vote_count
 */
export async function ensurePollAndOptionsExist(poll: PollStation): Promise<void> {
  if (!isSupabaseConfigured || !supabase || !poll?.id) return;

  try {
    // 1. Ensure poll row exists (ignoreDuplicates prevents overwriting existing row)
    await supabase
      .from('polls')
      .upsert(
        [
          {
            id: poll.id,
            title: poll.title,
            description: poll.description || '',
            category: poll.category || 'public',
            max_voters: poll.maxVoters || 100,
            duration_hours: poll.durationHours || 720,
            expires_at: poll.expiresAt ? new Date(poll.expiresAt).toISOString() : null,
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'id', ignoreDuplicates: true }
      );

    // 2. Check existing options in DB so we NEVER reset existing vote_count to 0
    const { data: existingOpts } = await supabase
      .from('poll_options')
      .select('id')
      .eq('poll_id', poll.id);

    const existingIds = new Set((existingOpts || []).map((o: any) => String(o.id)));
    const missingOptions = (poll.candidates || [])
      .map((c, idx) => ({ c, idx }))
      .filter(({ c }) => !existingIds.has(c.id))
      .map(({ c, idx }) => ({
        id: c.id,
        poll_id: poll.id,
        symbol_number: idx + 1,
        sort_order: idx + 1,
        party: c.party || `기호 ${idx + 1}번`,
        title: c.title,
        subtitle: c.subtitle || '',
        badge_color: c.badgeColor || 'blue',
        accent_bg: c.accentBg || '#3b82f6',
        vote_count: 0,
      }));

    if (missingOptions.length > 0) {
      await supabase
        .from('poll_options')
        .upsert(missingOptions, { onConflict: 'id', ignoreDuplicates: true });
    }
  } catch (err) {
    console.warn('[ensurePollAndOptionsExist warning]', err);
  }
}

/**
 * Ensures all 3 official PRESET_POLLS and their options exist in Supabase DB, preserving existing vote_count
 */
export async function ensurePresetPollsSeeded(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  if (presetSeedPromise) {
    return presetSeedPromise;
  }

  presetSeedPromise = (async () => {
    try {
      const presetIds = PRESET_POLLS.map((p) => p.id);

      // 1. Check which official preset polls already exist
      const { data: existingPolls } = await supabase
        .from('polls')
        .select('id')
        .in('id', presetIds);
      const existingPollIds = new Set((existingPolls || []).map((p: any) => String(p.id)));

      const missingPolls = PRESET_POLLS.filter((p) => !existingPollIds.has(p.id)).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category || 'public',
        max_voters: p.maxVoters || 100,
        duration_hours: p.durationHours || 720,
        expires_at: p.expiresAt ? new Date(p.expiresAt).toISOString() : null,
        created_at: new Date().toISOString(),
      }));

      if (missingPolls.length > 0) {
        await supabase
          .from('polls')
          .upsert(missingPolls, { onConflict: 'id', ignoreDuplicates: true });
      }

      // 2. Check existing poll_options for all preset polls so we NEVER overwrite vote_count
      const { data: existingOpts } = await supabase
        .from('poll_options')
        .select('id')
        .in('poll_id', presetIds);
      const existingOptIds = new Set((existingOpts || []).map((o: any) => String(o.id)));

      const missingOptions: any[] = [];
      PRESET_POLLS.forEach((p) => {
        p.candidates.forEach((c, idx) => {
          if (!existingOptIds.has(c.id)) {
            missingOptions.push({
              id: c.id,
              poll_id: p.id,
              symbol_number: idx + 1,
              sort_order: idx + 1,
              party: c.party,
              title: c.title,
              subtitle: c.subtitle,
              badge_color: c.badgeColor,
              accent_bg: c.accentBg,
              vote_count: 0,
            });
          }
        });
      });

      if (missingOptions.length > 0) {
        await supabase
          .from('poll_options')
          .upsert(missingOptions, { onConflict: 'id', ignoreDuplicates: true });
      }
    } catch (err) {
      console.warn('[ensurePresetPollsSeeded warning]', err);
    } finally {
      presetSeedPromise = null;
    }
  })();

  return presetSeedPromise;
}

/**
 * 2. Fetch public polls list from Supabase (category <> 'private')
 * Seeds official preset polls first, reads live poll_options counts, and falls back gracefully
 */
export async function fetchVoteversePolls(): Promise<PollStation[]> {
  const localPolls = getAllPolls();

  if (!isSupabaseConfigured || !supabase) {
    return localPolls;
  }

  try {
    // Ensure all 3 official preset polls & options exist in DB without overwriting vote_count
    await ensurePresetPollsSeeded();

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
          symbolNumber:
            Number(opt.symbol_number ?? opt.sort_order ?? opt.symbolNumber) || 1,
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

    // Merge: ensure standard official preset polls + local custom private polls are preserved with DB option counts
    const remoteIds = new Set(remotePolls.map((p) => p.id));
    const merged = [...remotePolls];
    PRESET_POLLS.forEach((preset) => {
      if (!remoteIds.has(preset.id)) {
        const dbCands = optionsMap[preset.id];
        merged.push({
          ...preset,
          candidates: dbCands && dbCands.length > 0 ? dbCands : preset.candidates,
        });
      }
    });
    localPolls
      .filter((p) => p.category === 'private' && !remoteIds.has(p.id))
      .forEach((priv) => {
        const dbCands = optionsMap[priv.id];
        merged.push({
          ...priv,
          candidates: dbCands && dbCands.length > 0 ? dbCands : priv.candidates,
        });
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

  // Best-effort anonymous auth (do not block creation if anonymous auth is delayed/disabled)
  const authUserId = await ensureAnonymousAuth();

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
      sort_order: c.symbolNumber,
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
    let rpcError: any = null;
    if (authUserId) {
      const { data, error } = await supabase.rpc('create_voteverse_poll', {
        p_poll: p_poll_payload,
      });
      if (!error) {
        console.log('[create_voteverse_poll RPC success]', data);
        savePoll(pollData);
        return { success: true };
      }
      rpcError = error;
    }

    const rpcMsg = (rpcError?.message || '') + (rpcError?.code || '');
    const canFallbackDirect =
      !authUserId ||
      rpcError?.code === 'PGRST202' ||
      rpcMsg.includes('Could not find the function') ||
      rpcMsg.includes('not authenticated') ||
      rpcMsg.includes('auth');

    if (canFallbackDirect) {
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
        sort_order: c.symbolNumber,
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

    return { success: false, error: rpcError?.message || '투표소 생성 DB 저장에 실패했습니다.' };
  } catch (err: any) {
    console.warn('[createVoteversePoll error]', err);
    return { success: false, error: err?.message || '투표소 생성 중 네트워크 오류가 발생했습니다.' };
  }
}

/**
 * Clears localStorage vote & certificate records for a specific poll
 */
export function clearLocalVoteCache(pollId: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY_VOTED_PREFIX + pollId);
    localStorage.removeItem(`vps_last_option_${pollId}`);
    localStorage.removeItem(`vps_cert_${pollId}`);
    localStorage.removeItem(`voteverse_cert_${pollId}`);
    localStorage.removeItem(`vps_vote_timestamp_${pollId}`);

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        k.includes(pollId) &&
        (k.startsWith('vps_user_voted_') ||
          k.startsWith('vps_last_option_') ||
          k.startsWith('vps_cert_') ||
          k.startsWith('voteverse_cert_') ||
          k.startsWith('vps_vote_'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore in restricted storage
  }
}

/**
 * Collects all possible voter IDs (anonymous auth UID + fallback browser UUID + any revote UUIDs)
 */
async function collectCurrentVoterIds(pollId?: string): Promise<string[]> {
  const ids = new Set<string>();
  const authUid = await ensureAnonymousAuth();
  if (authUid) ids.add(authUid);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        ids.add(sessionData.session.user.id);
      }
    } catch {
      // ignore
    }
  }

  const browserUuid = getVoterUUID();
  if (browserUuid) ids.add(browserUuid);

  if (pollId) {
    try {
      const raw = localStorage.getItem(`vps_revote_uuids_${pollId}`);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id) => {
            if (typeof id === 'string' && id) ids.add(id);
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(ids);
}

/**
 * Check if current user/browser has already voted for this poll (using votes.voter_id)
 * Automatically clears stale localStorage cache when DB shows no vote or 0 total votes
 */
export async function checkHasVotedVoteverse(pollId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      const voterIds = await collectCurrentVoterIds(pollId);

      const { data, error } = await supabase
        .from('votes')
        .select('id')
        .eq('poll_id', pollId)
        .in('voter_id', voterIds)
        .limit(1);

      if (!error && data) {
        if (data.length > 0) {
          try {
            localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
          } catch {
            // ignore
          }
          return true;
        }
        clearLocalVoteCache(pollId);
        return false;
      }

      // If votes SELECT is blocked by RLS, check if poll_options total is 0 (DB wiped)
      const { data: optsData } = await supabase
        .from('poll_options')
        .select('vote_count')
        .eq('poll_id', pollId);
      if (optsData) {
        const total = optsData.reduce((s: number, r: any) => s + (Number(r.vote_count) || 0), 0);
        if (total === 0) {
          clearLocalVoteCache(pollId);
          return false;
        }
      }
    } catch (err) {
      console.warn('[checkHasVotedVoteverse error]', err);
    }
  }

  // Fallback to localStorage cache only when offline or DB query unavailable
  try {
    return localStorage.getItem(STORAGE_KEY_VOTED_PREFIX + pollId) === 'true';
  } catch {
    return false;
  }
}

/**
 * Resets the current user's vote for the given poll in Supabase public.votes,
 * syncs poll_options.vote_count, and deletes all localStorage vote/certificate records.
 */
export async function resetMyVote(
  pollId: string,
  previousOptionId?: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  let cachedLastOption: string | null = null;
  let wasLocallyVoted = false;
  try {
    cachedLastOption = localStorage.getItem(`vps_last_option_${pollId}`);
    wasLocallyVoted = localStorage.getItem(STORAGE_KEY_VOTED_PREFIX + pollId) === 'true';
  } catch {
    // ignore
  }
  const fallbackOptionId = previousOptionId || cachedLastOption || undefined;

  // Always clear localStorage vote completion & certificate data
  clearLocalVoteCache(pollId);

  if (!isSupabaseConfigured || !supabase) {
    return { success: true, deletedCount: 0 };
  }

  try {
    const voterIds = await collectCurrentVoterIds(pollId);
    if (voterIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // 1. Inspect existing vote rows for this user & poll before deletion
    const { data: existingVotes, error: selectErr } = await supabase
      .from('votes')
      .select('id, option_id')
      .eq('poll_id', pollId)
      .in('voter_id', voterIds);

    const beforeOptionCounts = new Map<string, number>();
    const optionDeltas = new Map<string, number>();

    if (existingVotes && existingVotes.length > 0) {
      existingVotes.forEach((v: any) => {
        if (v.option_id) {
          const optId = String(v.option_id);
          optionDeltas.set(optId, (optionDeltas.get(optId) || 0) + 1);
        }
      });
    } else if (selectErr && wasLocallyVoted && fallbackOptionId) {
      // RLS blocked SELECT on votes, but local record confirms user voted for fallbackOptionId
      optionDeltas.set(fallbackOptionId, 1);
    }

    const optionIdsToCheck = Array.from(
      new Set([...optionDeltas.keys(), ...(fallbackOptionId ? [fallbackOptionId] : [])])
    );

    if (optionIdsToCheck.length > 0) {
      const { data: beforeOpts } = await supabase
        .from('poll_options')
        .select('id, vote_count')
        .eq('poll_id', pollId)
        .in('id', optionIdsToCheck);
      beforeOpts?.forEach((o: any) => {
        beforeOptionCounts.set(String(o.id), Number(o.vote_count) || 0);
      });
    }

    // 2. Delete vote row(s) from public.votes for this poll_id & voter_id(s)
    let deletedList: any[] = [];
    let deleteError: any = null;

    const delWithSelect = await supabase
      .from('votes')
      .delete()
      .eq('poll_id', pollId)
      .in('voter_id', voterIds)
      .select('id, option_id');

    if (delWithSelect.error) {
      // Retry plain delete in case RLS allows DELETE without RETURNING/SELECT
      const plainDel = await supabase
        .from('votes')
        .delete()
        .eq('poll_id', pollId)
        .in('voter_id', voterIds);
      deleteError = plainDel.error;
    } else {
      deletedList = delWithSelect.data || [];
    }

    if (deleteError) {
      console.warn('[resetMyVote delete error]', deleteError.message);
      return {
        success: false,
        deletedCount: 0,
        error: deleteError.message,
      };
    }

    if (deletedList.length > 0) {
      // Use exact deleted rows as authoritative delta
      optionDeltas.clear();
      deletedList.forEach((v: any) => {
        if (v.option_id) {
          const optId = String(v.option_id);
          optionDeltas.set(optId, (optionDeltas.get(optId) || 0) + 1);
        }
      });
    }

    const deletedCount = deletedList.length || (existingVotes ? existingVotes.length : 0);

    // 3. Sync poll_options.vote_count with remaining votes (decrement if DB trigger didn't already)
    for (const [optId, delta] of optionDeltas.entries()) {
      const { data: afterOpt } = await supabase
        .from('poll_options')
        .select('vote_count')
        .eq('poll_id', pollId)
        .eq('id', optId)
        .single();

      if (afterOpt) {
        const afterCount = Number(afterOpt.vote_count) || 0;
        const beforeCount = beforeOptionCounts.get(optId);
        if ((beforeCount === undefined || afterCount >= beforeCount) && afterCount > 0) {
          const nextCount = Math.max(0, afterCount - delta);
          await supabase
            .from('poll_options')
            .update({ vote_count: nextCount })
            .eq('poll_id', pollId)
            .eq('id', optId);
        }
      }
    }

    return { success: true, deletedCount };
  } catch (err: any) {
    console.warn('[resetMyVote exception]', err);
    return {
      success: false,
      deletedCount: 0,
      error: err?.message || '투표 초기화 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 3. Cast vote wrapper (allows re-voting by replacing any existing vote)
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
      alreadyVoted: false,
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
 * Cast vote (supports unlimited re-voting):
 * a) Ensures poll and options exist in Supabase polls & poll_options (preserving existing vote_count)
 * b) Deletes any existing vote by the current voter (auth.uid & localStorage UUIDs) in public.votes
 * c) Inserts the new vote row (poll_id, option_id, voter_id) and updates poll_options.vote_count
 * d) Selects fresh vote_count list from public.poll_options and returns it for immediate UI/lobby sync
 */
export async function castVote(
  pollId: string,
  candidateId: string,
  pollData?: PollStation
): Promise<{
  success: boolean;
  message: string;
  alreadyVoted?: boolean;
  tallies?: Record<string, number>;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      message: 'Supabase 데이터베이스가 연결되지 않아 투표를 기록할 수 없습니다.',
    };
  }

  // 1. Ensure anonymous auth session; fallback to persistent localStorage UUID if delayed/unavailable
  const authUserId = await ensureAnonymousAuth();
  const voterId = authUserId || getVoterUUID();

  try {
    // a) Ensure current poll & candidates exist in public.polls and public.poll_options
    const resolvedPoll =
      pollData ||
      getAllPolls().find((p) => p.id === pollId) ||
      PRESET_POLLS.find((p) => p.id === pollId);
    if (resolvedPoll) {
      await ensurePollAndOptionsExist(resolvedPoll);
    } else {
      await ensurePresetPollsSeeded();
    }

    // b) Remove any existing prior vote for this user on this poll (and decrement old option vote_count if needed)
    await resetMyVote(pollId);
    const voterIds = await collectCurrentVoterIds(pollId);
    if (voterIds.length > 0) {
      await supabase.from('votes').delete().eq('poll_id', pollId).in('voter_id', voterIds);
    }

    // Snapshot candidate vote_count right before insert (trigger-safe)
    const { data: beforeOptData } = await supabase
      .from('poll_options')
      .select('vote_count')
      .eq('poll_id', pollId)
      .eq('id', candidateId)
      .single();
    const beforeCount = beforeOptData ? Number(beforeOptData.vote_count) || 0 : 0;

    // c) Insert new vote row directly into public.votes
    let activeVoterId = voterId;
    let insertErr = (
      await supabase.from('votes').insert([
        {
          poll_id: pollId,
          option_id: candidateId,
          voter_id: activeVoterId,
        },
      ])
    ).error;

    // Handle duplicate key (e.g. 23505 if RLS prevented earlier DELETE) by deleting/upserting or rotating revote UUID
    if (insertErr) {
      const errText = (insertErr.message || '') + (insertErr.code || '');
      const isDuplicate =
        errText.includes('23505') ||
        errText.includes('duplicate') ||
        errText.includes('unique') ||
        errText.includes('votes_one_per_user_per_poll');

      if (isDuplicate) {
        await supabase.from('votes').delete().eq('poll_id', pollId).eq('voter_id', activeVoterId);

        const retryInsert = await supabase.from('votes').insert([
          {
            poll_id: pollId,
            option_id: candidateId,
            voter_id: activeVoterId,
          },
        ]);

        if (!retryInsert.error) {
          insertErr = null;
        } else {
          const upsertRes = await supabase
            .from('votes')
            .upsert(
              [
                {
                  poll_id: pollId,
                  option_id: candidateId,
                  voter_id: activeVoterId,
                },
              ],
              { onConflict: 'poll_id,voter_id' }
            );

          if (!upsertRes.error) {
            insertErr = null;
          } else {
            // Last-resort fallback if RLS forbids both DELETE and UPDATE on public.votes
            const revoteUuid =
              typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `revote-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            const fallbackRes = await supabase.from('votes').insert([
              {
                poll_id: pollId,
                option_id: candidateId,
                voter_id: revoteUuid,
              },
            ]);
            insertErr = fallbackRes.error;
            if (!insertErr) {
              activeVoterId = revoteUuid;
              try {
                const raw = localStorage.getItem(`vps_revote_uuids_${pollId}`);
                const prevArr = raw ? JSON.parse(raw) : [];
                const nextArr = Array.isArray(prevArr) ? [...prevArr, revoteUuid] : [revoteUuid];
                localStorage.setItem(`vps_revote_uuids_${pollId}`, JSON.stringify(nextArr.slice(-10)));
              } catch {}
            }
          }
        }
      }
    }

    if (insertErr) {
      return {
        success: false,
        message: `투표 DB 저장에 실패했습니다: ${insertErr.message}`,
      };
    }

    // Increment poll_options.vote_count if a DB trigger didn't already increment it
    const { data: afterOptData } = await supabase
      .from('poll_options')
      .select('vote_count')
      .eq('poll_id', pollId)
      .eq('id', candidateId)
      .single();
    const afterCount = afterOptData ? Number(afterOptData.vote_count) || 0 : beforeCount;

    if (afterCount <= beforeCount) {
      const { error: updateError } = await supabase
        .from('poll_options')
        .update({ vote_count: afterCount + 1 })
        .eq('poll_id', pollId)
        .eq('id', candidateId);

      if (updateError) {
        return {
          success: false,
          message: `득표수 DB 갱신에 실패했습니다: ${updateError.message}`,
        };
      }
    }

    try {
      localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
      localStorage.setItem(`vps_last_option_${pollId}`, candidateId);
    } catch {}

    // d) Immediately SELECT latest vote_count list for this poll_id from public.poll_options
    const tallies: Record<string, number> = {};
    const { data: latestOptions } = await supabase
      .from('poll_options')
      .select('id, vote_count')
      .eq('poll_id', pollId);

    if (latestOptions) {
      latestOptions.forEach((row: any) => {
        tallies[String(row.id)] = Number(row.vote_count) || 0;
      });
    }

    return {
      success: true,
      message: '투표함에 투표용지가 성공적으로 투입되었습니다!',
      tallies,
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
        event: '*',
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
 * Subscribes to ALL public.poll_options changes across every poll in real time
 * (used to keep Lobby cards and global allPolls state synchronized live)
 */
export function subscribeAllPollsRealtime(
  onOptionUpdate: (data: { pollId: string; optionId: string; votes: number }) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const channelName = `realtime_all_polls_${Math.random().toString(36).substring(2, 7)}`;
  const channel = supabase.channel(channelName);

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'poll_options',
      },
      (payload: any) => {
        const row = payload.new;
        if (row && row.id && row.poll_id) {
          onOptionUpdate({
            pollId: String(row.poll_id),
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
  nickname?: string;
  avatarType?: 'male' | 'female';
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
  isSubscribed: () => boolean;
  sendPlayerState: (state: {
    nickname: string;
    avatarType: 'male' | 'female';
    x: number;
    z: number;
    rotY: number;
    isMoving: boolean;
  }) => void;
  sendMove: (
    x: number,
    z: number,
    rotY: number,
    isMoving: boolean,
    nickname?: string,
    avatarType?: 'male' | 'female'
  ) => void;
  updatePresence: (
    x: number,
    z: number,
    rotY: number,
    isMoving: boolean,
    nickname?: string,
    avatarType?: 'male' | 'female'
  ) => void;
  broadcastVote: (nickname: string, candidateId: string) => void;
  leave: () => void;
}

/**
 * Connect to polling station room using unified Supabase Presence & Broadcast
 * Channel name: voteverse_room_${pollId}
 * Emits initial track + player_state on SUBSCRIBED, and routes presence & player_state/player_move into onPeerState
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
    onPeerState: (peer: RemotePlayer) => void;
    onPeerLeave?: (userId: string) => void;
    onPresenceCount?: (count: number) => void;
    onVoteCast: (payload: VoteCastPayload) => void;
  }
): MultiplayerRoomHandle {
  if (!isSupabaseConfigured || !supabase) {
    return {
      channel: null,
      isSubscribed: () => false,
      sendPlayerState: () => {},
      sendMove: () => {},
      updatePresence: () => {},
      broadcastVote: () => {},
      leave: () => {},
    };
  }

  let subscribed = false;
  const roomChannelName = `voteverse_room_${pollId}`;
  const channel = supabase.channel(roomChannelName, {
    config: {
      broadcast: { self: false },
      presence: { key: localPlayer.userId },
    },
  });

  const normalizePeer = (raw: any, fallbackKey?: string): RemotePlayer | null => {
    if (!raw && !fallbackKey) return null;
    const userId = String(raw?.userId || fallbackKey || '').trim();
    if (!userId || userId === localPlayer.userId) return null;
    return {
      userId,
      nickname: typeof raw?.nickname === 'string' && raw.nickname.trim() ? raw.nickname : '선거인',
      avatarType: raw?.avatarType === 'female' ? 'female' : 'male',
      x: typeof raw?.x === 'number' && !Number.isNaN(raw.x) ? raw.x : -6.5,
      z: typeof raw?.z === 'number' && !Number.isNaN(raw.z) ? raw.z : 0.5,
      rotY: typeof raw?.rotY === 'number' && !Number.isNaN(raw.rotY) ? raw.rotY : 0,
      isMoving: Boolean(raw?.isMoving),
    };
  };

  const syncPresencePeers = () => {
    const state = channel.presenceState();
    const activeIds = new Set<string>();

    Object.entries(state).forEach(([key, items]: [string, any]) => {
      if (key === localPlayer.userId) return;
      if (Array.isArray(items) && items.length > 0) {
        const latest = items[items.length - 1];
        const peer = normalizePeer(latest, key);
        if (peer) {
          activeIds.add(peer.userId);
          callbacks.onPeerState(peer);
        }
      }
    });

    callbacks.onPresenceCount?.(activeIds.size + 1);
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      syncPresencePeers();
    })
    .on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
      if (Array.isArray(newPresences)) {
        newPresences.forEach((item: any) => {
          const peer = normalizePeer(item, key);
          if (peer) callbacks.onPeerState(peer);
        });
      }
      syncPresencePeers();
    })
    .on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
      const state = channel.presenceState();
      if (Array.isArray(leftPresences) && leftPresences.length > 0) {
        leftPresences.forEach((item: any) => {
          const leftId = String(item?.userId || key || '').trim();
          if (leftId && leftId !== localPlayer.userId && !state[leftId]) {
            callbacks.onPeerLeave?.(leftId);
          }
        });
      } else if (key && key !== localPlayer.userId && !state[key]) {
        callbacks.onPeerLeave?.(String(key));
      }
      syncPresencePeers();
    })
    .on('broadcast', { event: 'player_state' }, ({ payload }: any) => {
      const peer = normalizePeer(payload);
      if (peer) {
        callbacks.onPeerState(peer);
      }
    })
    .on('broadcast', { event: 'player_move' }, ({ payload }: any) => {
      const peer = normalizePeer(payload);
      if (peer) {
        callbacks.onPeerState(peer);
      }
    })
    .on('broadcast', { event: 'player_leave' }, ({ payload }: any) => {
      const leftId = String(payload?.userId || '').trim();
      if (leftId && leftId !== localPlayer.userId) {
        callbacks.onPeerLeave?.(leftId);
      }
    })
    .on('broadcast', { event: 'vote_cast' }, ({ payload }: any) => {
      if (payload) {
        callbacks.onVoteCast(payload);
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        subscribed = true;
        const initialPayload = {
          userId: localPlayer.userId,
          nickname: localPlayer.nickname,
          avatarType: localPlayer.avatarType,
          x: localPlayer.x,
          z: localPlayer.z,
          rotY: localPlayer.rotY,
          isMoving: false,
        };

        try {
          await channel.track(initialPayload);
        } catch (err) {
          console.warn('[Supabase presence track error]', err);
        }

        try {
          await channel.send({
            type: 'broadcast',
            event: 'player_state',
            payload: initialPayload,
          });
        } catch (err) {
          console.warn('[Supabase initial broadcast error]', err);
        }
      }
    });

  const sendStateBroadcast = (
    event: 'player_state' | 'player_move',
    state: {
      nickname?: string;
      avatarType?: 'male' | 'female';
      x: number;
      z: number;
      rotY: number;
      isMoving: boolean;
    }
  ) => {
    if (!subscribed) return;
    try {
      channel.send({
        type: 'broadcast',
        event,
        payload: {
          userId: localPlayer.userId,
          nickname: state.nickname || localPlayer.nickname,
          avatarType: state.avatarType || localPlayer.avatarType,
          x: state.x,
          z: state.z,
          rotY: state.rotY,
          isMoving: state.isMoving,
        },
      });
    } catch {
      // silent fail on network glitch
    }
  };

  return {
    channel,
    isSubscribed: () => subscribed,
    sendPlayerState: (state) => {
      sendStateBroadcast('player_state', state);
    },
    sendMove: (x, z, rotY, isMoving, nickname, avatarType) => {
      sendStateBroadcast('player_state', {
        nickname: nickname || localPlayer.nickname,
        avatarType: avatarType || localPlayer.avatarType,
        x,
        z,
        rotY,
        isMoving,
      });
    },
    updatePresence: (x, z, rotY, isMoving, nickname, avatarType) => {
      if (!subscribed) return;
      try {
        channel.track({
          userId: localPlayer.userId,
          nickname: nickname || localPlayer.nickname,
          avatarType: avatarType || localPlayer.avatarType,
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
      if (!subscribed) return;
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
      if (subscribed) {
        try {
          channel.send({
            type: 'broadcast',
            event: 'player_leave',
            payload: { userId: localPlayer.userId },
          });
        } catch {}
      }
      subscribed = false;
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
    let userId: string | null = await ensureAnonymousAuth();
    if (!userId) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        userId = userData?.user?.id || null;
      } catch {
        userId = null;
      }
    }

    const { data, error } = await supabase
      .from('guestbook')
      .insert([
        {
          poll_id: pollId,
          user_id: userId || null,
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
          user_id: data.user_id ?? undefined,
          display_name: data.display_name || trimmedName,
          message: data.message || trimmedMsg,
          created_at: data.created_at || new Date().toISOString(),
        }
      : {
          id: 'gb_' + Date.now().toString(36),
          poll_id: pollId,
          user_id: userId || undefined,
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


