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
  getClosedPollOverrides,
  setClosedPollOverride,
} from '../data/presetPolls';

const STORAGE_KEY_VOTED_PREFIX = 'vps_user_voted_';
const OWNED_POLLS_STORAGE_KEY = 'voteverse_owned_polls';
const ADMIN_UNLOCKED_POLLS_KEY = 'voteverse_admin_unlocked_polls';

export const OFFICIAL_PRESET_POLL_IDS = new Set([
  'poll-lunch',
  'poll-monday11',
  'poll-dinner',
]);

export function isProtectedOfficialPoll(
  poll?: Pick<PollStation, 'id' | 'isOfficial'> | null
): boolean {
  if (!poll) return false;
  return Boolean(poll.isOfficial) || OFFICIAL_PRESET_POLL_IDS.has(poll.id);
}

export function getOwnedPollsMap(): Record<string, { ownerId: string; createdAt: number }> {
  try {
    const raw = localStorage.getItem(OWNED_POLLS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const map: Record<string, { ownerId: string; createdAt: number }> = {};
      parsed.forEach((id) => {
        if (typeof id === 'string' && id) {
          map[id] = { ownerId: getVoterUUID(), createdAt: Date.now() };
        }
      });
      return map;
    }
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function recordOwnedPoll(pollId: string, ownerId?: string | null): void {
  if (!pollId || OFFICIAL_PRESET_POLL_IDS.has(pollId)) return;
  try {
    const map = getOwnedPollsMap();
    map[pollId] = {
      ownerId: ownerId || getVoterUUID(),
      createdAt: Date.now(),
    };
    localStorage.setItem(OWNED_POLLS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function unlockPollAdminSession(pollId: string): void {
  if (!pollId || OFFICIAL_PRESET_POLL_IDS.has(pollId)) return;
  try {
    const raw = sessionStorage.getItem(ADMIN_UNLOCKED_POLLS_KEY);
    const prev: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(prev) ? Array.from(new Set([...prev, pollId])) : [pollId];
    sessionStorage.setItem(ADMIN_UNLOCKED_POLLS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function isPollAdminUnlocked(pollId: string): boolean {
  if (!pollId || OFFICIAL_PRESET_POLL_IDS.has(pollId)) return false;
  try {
    const raw = sessionStorage.getItem(ADMIN_UNLOCKED_POLLS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.includes(pollId);
  } catch {
    return false;
  }
}

export function isPollOwnerOrAdmin(
  poll?: PollStation | null,
  currentAuthUserId?: string | null
): boolean {
  if (!poll || isProtectedOfficialPoll(poll)) {
    return false;
  }

  // 1. Local creator registry check (voteverse_owned_polls)
  const ownedMap = getOwnedPollsMap();
  if (ownedMap[poll.id]) {
    return true;
  }

  // 2. DB / object ownerId check against auth UID or persistent browser UUID
  if (poll.ownerId) {
    const browserUuid = getVoterUUID();
    if (
      (currentAuthUserId && poll.ownerId === currentAuthUserId) ||
      (browserUuid && poll.ownerId === browserUuid)
    ) {
      return true;
    }
  }

  // 3. Session admin PIN unlock check
  if (isPollAdminUnlocked(poll.id)) {
    return true;
  }

  return false;
}

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
            duration_hours: Math.max(1, Math.round(poll.durationHours || 720)),
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
        duration_hours: Math.max(1, Math.round(p.durationHours || 720)),
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

    // Fetch public/official polls; include owner_id if column exists in DB, otherwise fallback cleanly
    let pollsData: any[] | null = null;
    let pollsError: any = null;

    const withOwnerRes = await supabase
      .from('polls')
      .select('id, title, description, category, max_voters, duration_hours, expires_at, created_at, owner_id')
      .neq('category', 'private')
      .order('created_at', { ascending: false });

    if (
      withOwnerRes.error &&
      ((withOwnerRes.error.message || '').includes('owner_id') ||
        withOwnerRes.error.code === '42703' ||
        withOwnerRes.error.code === 'PGRST204')
    ) {
      const baseRes = await supabase
        .from('polls')
        .select('id, title, description, category, max_voters, duration_hours, expires_at, created_at')
        .neq('category', 'private')
        .order('created_at', { ascending: false });
      pollsData = baseRes.data;
      pollsError = baseRes.error;
    } else {
      pollsData = withOwnerRes.data;
      pollsError = withOwnerRes.error;
    }

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
    const closedOverrides = getClosedPollOverrides();
    const localPollsById = new Map(localPolls.map((p) => [p.id, p]));

    const remotePolls: PollStation[] = pollsData.map((row: any) => {
      const candidates = (optionsMap[row.id] || []).sort(
        (a, b) => a.symbolNumber - b.symbolNumber
      );
      const pollIdStr = String(row.id);
      const isOfficial = officialPresetIds.has(pollIdStr) || row.category === 'official';
      const dbExpiresAt = row.expires_at ? new Date(row.expires_at).getTime() : undefined;
      const overrideClosedAt = closedOverrides[pollIdStr];
      const effectiveExpiresAt =
        overrideClosedAt && (!dbExpiresAt || dbExpiresAt > overrideClosedAt)
          ? overrideClosedAt
          : dbExpiresAt;
      const localMatch = localPollsById.get(pollIdStr);

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
        expiresAt: effectiveExpiresAt,
        ownerId: row.owner_id ? String(row.owner_id) : localMatch?.ownerId,
        adminPin: localMatch?.adminPin,
        accessCode: localMatch?.accessCode,
        candidates: candidates.length > 0 ? candidates : PRESET_POLLS[0].candidates,
      };
    });

    // Merge: ensure standard official preset polls + local custom private polls are preserved with DB option counts
    const remoteIds = new Set(remotePolls.map((p) => p.id));
    const merged = [...remotePolls];
    PRESET_POLLS.forEach((preset) => {
      if (!remoteIds.has(preset.id)) {
        const dbCands = optionsMap[preset.id];
        const overrideClosedAt = closedOverrides[preset.id];
        merged.push({
          ...preset,
          expiresAt: overrideClosedAt || preset.expiresAt,
          candidates: dbCands && dbCands.length > 0 ? dbCands : preset.candidates,
        });
      }
    });
    localPolls
      .filter((p) => p.category === 'private' && !remoteIds.has(p.id))
      .forEach((priv) => {
        const dbCands = optionsMap[priv.id];
        const overrideClosedAt = closedOverrides[priv.id];
        merged.push({
          ...priv,
          expiresAt: overrideClosedAt || priv.expiresAt,
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
  const resolvedOwnerId = pollData.ownerId || authUserId || getVoterUUID();
  const pollWithOwner: PollStation = {
    ...pollData,
    ownerId: resolvedOwnerId,
  };

  const p_poll_payload: Record<string, any> = {
    id: pollWithOwner.id,
    title: pollWithOwner.title,
    description: pollWithOwner.description,
    category: pollWithOwner.category || 'public',
    max_voters: pollWithOwner.maxVoters,
    duration_hours: Math.max(1, Math.round(pollWithOwner.durationHours || 24)),
    expires_at: pollWithOwner.expiresAt ? new Date(pollWithOwner.expiresAt).toISOString() : null,
    owner_id: resolvedOwnerId,
    candidates: pollWithOwner.candidates.map((c) => ({
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

  if (pollWithOwner.accessCode) {
    p_poll_payload.access_code = pollWithOwner.accessCode;
  }
  if (pollWithOwner.adminPin) {
    p_poll_payload.admin_pin = pollWithOwner.adminPin;
  }

  try {
    let rpcError: any = null;
    if (authUserId) {
      const { data, error } = await supabase.rpc('create_voteverse_poll', {
        p_poll: p_poll_payload,
      });
      if (!error) {
        console.log('[create_voteverse_poll RPC success]', data);
        recordOwnedPoll(pollWithOwner.id, resolvedOwnerId);
        savePoll(pollWithOwner);
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
      const baseRow: Record<string, any> = {
        id: pollWithOwner.id,
        title: pollWithOwner.title,
        description: pollWithOwner.description,
        category: pollWithOwner.category,
        max_voters: pollWithOwner.maxVoters,
        duration_hours: Math.max(1, Math.round(pollWithOwner.durationHours || 24)),
        expires_at: pollWithOwner.expiresAt ? new Date(pollWithOwner.expiresAt).toISOString() : null,
        created_at: new Date().toISOString(),
      };

      let pollError = (await supabase.from('polls').upsert([{ ...baseRow, owner_id: resolvedOwnerId }])).error;
      if (
        pollError &&
        ((pollError.message || '').includes('owner_id') ||
          pollError.code === '42703' ||
          pollError.code === 'PGRST204')
      ) {
        pollError = (await supabase.from('polls').upsert([baseRow])).error;
      }

      if (pollError) {
        return { success: false, error: `투표소 DB 저장 실패: ${pollError.message}` };
      }

      const optionRows = pollWithOwner.candidates.map((c) => ({
        id: c.id,
        poll_id: pollWithOwner.id,
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

      recordOwnedPoll(pollWithOwner.id, resolvedOwnerId);
      savePoll(pollWithOwner);
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

export interface PlayerStateInput {
  nickname?: string;
  avatarType?: 'male' | 'female';
  x: number;
  z: number;
  rotY: number;
  isMoving: boolean;
}

export interface MultiplayerRoomHandle {
  channel: any;
  isSubscribed: () => boolean;
  sendPlayerState: (state: PlayerStateInput) => void;
  sendMove: {
    (
      x: number,
      z: number,
      rotY: number,
      isMoving: boolean,
      nickname?: string,
      avatarType?: 'male' | 'female'
    ): void;
    (state: PlayerStateInput): void;
  };
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
 * Connect to polling station room using Supabase Presence & Broadcast
 * Channel name: voteverse_room_${pollId}
 * - channel.track() is called ONCE on SUBSCRIBED (never during movement)
 * - All movement & heartbeat sync uses Broadcast 'player_state' exclusively
 * - Ignores spurious Presence 'leave' events; deletes remote avatars only on explicit 'player_leave' broadcast (or timeout in client)
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

    const rawX = Number(raw?.x);
    const rawZ = Number(raw?.z);
    const rawRotY = Number(raw?.rotY);

    // Reject broadcast payloads with invalid/NaN coordinates so avatars never vanish
    if (raw?.x !== undefined && !Number.isFinite(rawX)) return null;
    if (raw?.z !== undefined && !Number.isFinite(rawZ)) return null;

    return {
      userId,
      nickname: typeof raw?.nickname === 'string' && raw.nickname.trim() ? raw.nickname : '선거인',
      avatarType: raw?.avatarType === 'female' ? 'female' : 'male',
      x: Number.isFinite(rawX) ? rawX : -6.5,
      z: Number.isFinite(rawZ) ? rawZ : 0.5,
      rotY: Number.isFinite(rawRotY) ? rawRotY : 0,
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
    .on('presence', { event: 'leave' }, () => {
      // Do NOT call onPeerLeave on Presence leave (Supabase emits leave on track updates/reconnects).
      // Only refresh presence count safely; actual avatar removal is driven by 'player_leave' broadcast or 12s timeout.
      const state = channel.presenceState();
      const activeIds = new Set<string>();
      Object.keys(state).forEach((k) => {
        if (k && k !== localPlayer.userId) activeIds.add(k);
      });
      callbacks.onPresenceCount?.(activeIds.size + 1);
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
        const safeX = Number.isFinite(Number(localPlayer.x)) ? Number(localPlayer.x) : -6.5;
        const safeZ = Number.isFinite(Number(localPlayer.z)) ? Number(localPlayer.z) : 0.5;
        const safeRotY = Number.isFinite(Number(localPlayer.rotY)) ? Number(localPlayer.rotY) : Math.PI;

        const initialPayload = {
          userId: localPlayer.userId,
          nickname: localPlayer.nickname,
          avatarType: localPlayer.avatarType,
          x: safeX,
          z: safeZ,
          rotY: safeRotY,
          isMoving: false,
        };

        // Call channel.track() ONCE on SUBSCRIBED (never during movement)
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

  const sendStateBroadcast = (state: PlayerStateInput) => {
    if (!subscribed) return;
    const x = Number(state.x);
    const z = Number(state.z);
    const rotY = Number(state.rotY);

    // Block NaN coordinates from ever leaving the client
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return;
    }

    try {
      channel.send({
        type: 'broadcast',
        event: 'player_state',
        payload: {
          userId: localPlayer.userId,
          nickname: state.nickname || localPlayer.nickname,
          avatarType: state.avatarType || localPlayer.avatarType,
          x,
          z,
          rotY: Number.isFinite(rotY) ? rotY : 0,
          isMoving: Boolean(state.isMoving),
        },
      });
    } catch {
      // silent fail on network glitch
    }
  };

  return {
    channel,
    isSubscribed: () => subscribed,
    sendPlayerState: (state: PlayerStateInput) => {
      sendStateBroadcast(state);
    },
    sendMove: (
      arg1: number | PlayerStateInput,
      arg2?: number,
      arg3?: number,
      arg4?: boolean,
      arg5?: string,
      arg6?: 'male' | 'female'
    ) => {
      if (typeof arg1 === 'object' && arg1 !== null) {
        sendStateBroadcast(arg1);
      } else {
        sendStateBroadcast({
          x: Number(arg1),
          z: Number(arg2),
          rotY: Number(arg3),
          isMoving: Boolean(arg4),
          nickname: arg5,
          avatarType: arg6,
        });
      }
    },
    // Never call channel.track() during movement; route safely to Broadcast player_state
    updatePresence: (
      x: number,
      z: number,
      rotY: number,
      isMoving: boolean,
      nickname?: string,
      avatarType?: 'male' | 'female'
    ) => {
      sendStateBroadcast({
        x,
        z,
        rotY,
        isMoving,
        nickname,
        avatarType,
      });
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

/**
 * ---------------------------------------------------------------------------
 * Immediate Poll Close & Realtime Poll Metadata Sync
 * ---------------------------------------------------------------------------
 */
export async function closePollNow(
  pollId: string,
  pollData?: PollStation,
  options?: { adminPin?: string }
): Promise<{ success: boolean; expiresAt: number; dbSynced: boolean; error?: string }> {
  // 1. Protect the 3 official preset polls unconditionally
  if (isProtectedOfficialPoll(pollData) || OFFICIAL_PRESET_POLL_IDS.has(pollId)) {
    return {
      success: false,
      expiresAt: pollData?.expiresAt || Date.now(),
      dbSynced: false,
      error: '기본 공식 투표소는 상시 체험 공간이므로 수동으로 마감할 수 없습니다.',
    };
  }

  // 2. Verify creator ownership or matching admin PIN
  const authUid = await ensureAnonymousAuth();
  const resolvedPoll: PollStation =
    pollData ||
    getAllPolls().find((p) => p.id === pollId) ||
    ({ id: pollId, title: '', description: '', category: 'public', candidates: [], createdAt: '' } as PollStation);

  const pinMatched = Boolean(
    options?.adminPin &&
      resolvedPoll.adminPin &&
      options.adminPin.trim() === resolvedPoll.adminPin.trim()
  );
  if (pinMatched) {
    unlockPollAdminSession(pollId);
  }

  const authorized = pinMatched || isPollOwnerOrAdmin(resolvedPoll, authUid);
  if (!authorized) {
    return {
      success: false,
      expiresAt: resolvedPoll.expiresAt || Date.now(),
      dbSynced: false,
      error: '개설자(방장) 또는 관리자 비밀번호 인증을 거친 경우에만 투표를 마감할 수 있습니다.',
    };
  }

  const closedAt = Date.now() - 1000;
  const closedIso = new Date(closedAt).toISOString();

  // Persist locally immediately so UI reflects closed status even offline / RLS-restricted
  setClosedPollOverride(pollId, closedAt);

  if (!isSupabaseConfigured || !supabase) {
    return { success: true, expiresAt: closedAt, dbSynced: false };
  }

  let dbSynced = false;
  let errorMsg: string | undefined;

  try {
    if (pollData) {
      await ensurePollAndOptionsExist(pollData);
    }

    const { error } = await supabase
      .from('polls')
      .update({ expires_at: closedIso })
      .eq('id', pollId);

    if (!error) {
      dbSynced = true;
    } else {
      errorMsg = error.message;
      console.warn('[closePollNow DB update warning]', error.message);
    }

    // Broadcast immediate close event across tabs/clients
    const metaChannel = supabase.channel('voteverse_polls_meta_tx');
    metaChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await metaChannel.send({
            type: 'broadcast',
            event: 'poll_closed',
            payload: { pollId, expiresAt: closedAt },
          });
        } catch {
          // ignore
        } finally {
          setTimeout(() => {
            supabase?.removeChannel(metaChannel);
          }, 500);
        }
      }
    });
  } catch (err: any) {
    errorMsg = err?.message;
    console.warn('[closePollNow exception]', err);
  }

  return { success: true, expiresAt: closedAt, dbSynced, error: errorMsg };
}

export function subscribePollsMetaRealtime(
  onPollClosed: (pollId: string, expiresAt: number) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  const dbChannel = supabase
    .channel(`realtime_polls_meta_${Math.random().toString(36).slice(2, 7)}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'polls',
      },
      (payload: any) => {
        const row = payload.new;
        if (row?.id && row?.expires_at) {
          const ts = new Date(row.expires_at).getTime();
          if (Number.isFinite(ts)) {
            onPollClosed(String(row.id), ts);
          }
        }
      }
    )
    .subscribe();

  const txChannel = supabase
    .channel('voteverse_polls_meta_tx')
    .on('broadcast', { event: 'poll_closed' }, ({ payload }: any) => {
      if (payload?.pollId && Number.isFinite(Number(payload.expiresAt))) {
        setClosedPollOverride(String(payload.pollId), Number(payload.expiresAt));
        onPollClosed(String(payload.pollId), Number(payload.expiresAt));
      }
    })
    .subscribe();

  return () => {
    supabase?.removeChannel(dbChannel);
    supabase?.removeChannel(txChannel);
  };
}

/**
 * ---------------------------------------------------------------------------
 * Global Lobby Presence Index (Per-poll live concurrent visitor counts)
 * Channel: 'voteverse_lobby_index'
 * Managed via shared ref-counted state so mount/unmount ordering never removes an active channel.
 * ---------------------------------------------------------------------------
 */
let lobbyIndexChannel: any = null;
let lobbyIndexSubscribed = false;
let activeTrackPayload: { userId: string; pollId: string } | null = null;
const lobbyPresenceListeners = new Set<(counts: Record<string, number>) => void>();

function computeLobbyCounts(): Record<string, number> {
  if (!lobbyIndexChannel) return {};
  const state = lobbyIndexChannel.presenceState();
  const byPoll: Record<string, Set<string>> = {};

  Object.entries(state).forEach(([key, items]: [string, any]) => {
    if (!Array.isArray(items) || items.length === 0) return;
    const latest = items[items.length - 1];
    const pid = latest?.pollId ? String(latest.pollId) : '';
    const uid = latest?.userId ? String(latest.userId) : key;
    if (pid && uid) {
      if (!byPoll[pid]) {
        byPoll[pid] = new Set<string>();
      }
      byPoll[pid].add(uid);
    }
  });

  const result: Record<string, number> = {};
  Object.entries(byPoll).forEach(([pid, set]) => {
    result[pid] = set.size;
  });
  return result;
}

function notifyLobbyListeners(): void {
  const counts = computeLobbyCounts();
  lobbyPresenceListeners.forEach((cb) => cb(counts));
}

function ensureLobbyIndexChannel(presenceKey?: string): void {
  if (!isSupabaseConfigured || !supabase) return;
  if (lobbyIndexChannel) return;

  lobbyIndexSubscribed = false;
  const channel = supabase.channel('voteverse_lobby_index', {
    config: {
      presence: { key: presenceKey || getMultiplayerSessionId() },
    },
  });
  lobbyIndexChannel = channel;

  channel
    .on('presence', { event: 'sync' }, notifyLobbyListeners)
    .on('presence', { event: 'join' }, notifyLobbyListeners)
    .on('presence', { event: 'leave' }, notifyLobbyListeners)
    .subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        lobbyIndexSubscribed = true;
        if (activeTrackPayload) {
          try {
            await channel.track({
              userId: activeTrackPayload.userId,
              pollId: activeTrackPayload.pollId,
              joinedAt: Date.now(),
            });
          } catch (err) {
            console.warn('[joinLobbyIndexTracker track error]', err);
          }
        }
        notifyLobbyListeners();
      }
    });
}

function cleanupLobbyIndexChannelIfIdle(): void {
  if (activeTrackPayload || lobbyPresenceListeners.size > 0) return;
  if (lobbyIndexChannel) {
    try {
      lobbyIndexChannel.untrack();
    } catch {}
    supabase?.removeChannel(lobbyIndexChannel);
    lobbyIndexChannel = null;
    lobbyIndexSubscribed = false;
  }
}

export function joinLobbyIndexTracker(userId: string, pollId: string): () => void {
  if (!isSupabaseConfigured || !supabase || !userId || !pollId) {
    return () => {};
  }

  activeTrackPayload = { userId, pollId };
  ensureLobbyIndexChannel(userId);

  if (lobbyIndexChannel && lobbyIndexSubscribed) {
    try {
      lobbyIndexChannel.track({
        userId,
        pollId,
        joinedAt: Date.now(),
      });
    } catch (err) {
      console.warn('[joinLobbyIndexTracker immediate track error]', err);
    }
  }

  return () => {
    if (
      activeTrackPayload &&
      activeTrackPayload.userId === userId &&
      activeTrackPayload.pollId === pollId
    ) {
      activeTrackPayload = null;
      if (lobbyIndexChannel && lobbyIndexSubscribed) {
        try {
          lobbyIndexChannel.untrack();
        } catch {}
      }
    }
    cleanupLobbyIndexChannelIfIdle();
  };
}

export function subscribeLobbyPresenceCounts(
  onCountsChange: (counts: Record<string, number>) => void
): () => void {
  if (!isSupabaseConfigured || !supabase) {
    return () => {};
  }

  lobbyPresenceListeners.add(onCountsChange);
  ensureLobbyIndexChannel();

  if (lobbyIndexChannel && lobbyIndexSubscribed) {
    onCountsChange(computeLobbyCounts());
  }

  return () => {
    lobbyPresenceListeners.delete(onCountsChange);
    cleanupLobbyIndexChannelIfIdle();
  };
}



