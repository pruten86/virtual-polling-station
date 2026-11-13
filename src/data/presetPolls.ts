import { PollStation, Candidate, PollChannelData } from '../types';
import { supabase, isSupabaseConfigured, ensureAnonymousAuth, GuestbookEntry } from '../lib/supabase';

const ADJECTIVES = [
  '소신 있는',
  '진지한',
  '배고픈',
  '칼퇴를 꿈꾸는',
  '민주적인',
  '공정한',
  '설레는',
  '행복한',
  '신중한',
  '정의로운',
  '열정적인',
  '당당한',
  '새벽투표러',
  '눈부신',
  '현명한',
  '용기 있는',
];

const NOUNS = [
  '위원장',
  '상임위원',
  '부위원장',
  '간사',
  '반장',
  '유권자',
  '주권자',
  '한표러',
  '참정권자',
  '점심위원',
  '민주시민',
  '투표왕',
  '기표소 암행어사',
  '투표함 파수꾼',
  '의사결정자',
  '행동하는시민',
  '희망의한표',
];

export const BETA_DISCLAIMER_TEXT =
  '※ [BETA] 본 서비스는 일상 의사결정 및 투표 절차 체험용 모의투표 웹앱이며, 실제 공직선거나 여론조사와 무관합니다.';

export const FORBIDDEN_POLITICAL_KEYWORDS = [
  // 1. 역대 대한민국 대통령
  '이승만',
  '윤보선',
  '박정희',
  '최규하',
  '전두환',
  '노태우',
  '김영삼',
  '김대중',
  '노무현',
  '이명박',
  '박근혜',
  '문재인',
  '윤석열',

  // 2. 국민의힘 주요 지도부 및 당대표급 인사
  '한동훈',
  '추경호',
  '황우여',
  '정진석',
  '권성동',
  '주호영',
  '인요한',
  '장동혁',
  '김재원',
  '김민전',
  '진종오',
  '윤상현',
  '권영세',
  '배현진',
  '김기현',
  '오세훈',
  '홍준표',
  '안철수',
  '유승민',
  '원희룡',
  '나경원',

  // 3. 야당 주요 지도부 및 유력 정치인
  '이재명',
  '박찬대',
  '김민석',
  '전현희',
  '한언석',
  '천하람',
  '허은아',
  '황운하',
  '신장식',
  '정청래',
  '추미애',
  '김동연',
  '우원식',
  '조국',
  '이준석',
  '용혜인',
  '김재연',
  '김건희',
  '한덕수',

  // 4. 직책 / 선거
  '대통령',
  '국회의원',
  '도지사',
  '시장',
  '구청장',
  '군수',
  '장관',
  '총리',
  '비례대표',
  '공천',
  '선거',
  '대선',
  '총선',
  '지선',
  '보궐',
  '출마',
  '선거운동',
  '공직선거',
  '국회',
  '청와대',
  '용산',
  '정치인',

  // 5. 정당 / 진영
  '민주당',
  '국민의힘',
  '조국혁신당',
  '개혁신당',
  '진보당',
  '정의당',
  '기본소득당',
  '보수',
  '진보',
  '좌파',
  '우파',
  '여당',
  '야당',
  '정당',

  // 6. 민감 정치 이슈
  '탄핵',
  '지지율',
  '여론조사',
  '특검',
  '구속',
  '계엄',
  '하야',
  '정권',
  '비대위',
  '당대표',
  '원내대표',
  '비상계엄',
];

export function checkPoliticalContent(texts: string[]): { hasForbidden: boolean; keyword?: string } {
  const combined = texts.join(' ').toLowerCase();
  const stripped = combined.replace(/[\s\-_.,/]+/g, '');

  for (const keyword of FORBIDDEN_POLITICAL_KEYWORDS) {
    const kw = keyword.toLowerCase();
    const kwStripped = kw.replace(/[\s\-_.,/]+/g, '');
    if (combined.includes(kw) || (kwStripped.length >= 2 && stripped.includes(kwStripped))) {
      return { hasForbidden: true, keyword };
    }
  }
  return { hasForbidden: false };
}

export function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj} ${noun} #${num}`;
}

// 30 days default expiration for official preset polls
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const PRESET_POLLS: PollStation[] = [
  {
    id: 'poll-lunch',
    title: '제1회 오늘 점심 메뉴 모의투표',
    description: '오늘의 점심 메뉴를 민주적이고 공정하게 결정합니다.',
    category: 'public',
    maxVoters: 100,
    createdAt: '2026-11-07',
    isOfficial: true,
    expiresAt: Date.now() + THIRTY_DAYS_MS,
    candidates: [
      {
        id: 'lunch-1',
        symbolNumber: 1,
        party: '얼큰한국물당',
        title: '따끈한 김치찌개 정식',
        subtitle: '돼지고기 듬뿍 + 계란말이 + 솥밥',
        badgeColor: 'rose',
        accentBg: '#f43f5e',
        description: '한국인의 소울푸드! 얼큰하고 진한 국물과 두툼한 돼지고기의 환상 궁합',
        votes: 0,
      },
      {
        id: 'lunch-2',
        symbolNumber: 2,
        party: '바삭한행복당',
        title: '바삭 수제 등심 돈가스',
        subtitle: '겉바속촉 100% 국내산 등심 + 특제 소스',
        badgeColor: 'blue',
        accentBg: '#3b82f6',
        description: '황금빛 튀김옷과 부드러운 육즙의 향연! 남녀노소 사랑받는 점심 1등 메뉴',
        votes: 0,
      },
      {
        id: 'lunch-3',
        symbolNumber: 3,
        party: '건강한선택당',
        title: '아보카도 연어 포케볼',
        subtitle: '신선한 생연어 + 완숙 아보카도 + 현미밥',
        badgeColor: 'emerald',
        accentBg: '#10b981',
        description: '속 편하고 활력 넘치는 한 그릇! 고단백 슈퍼푸드로 채우는 든든한 하루',
        votes: 0,
      },
    ],
  },
  {
    id: 'poll-monday11',
    title: '월요일 11시 출근제 도입 찬반 투표',
    description: '월요병 해소와 업무 몰입 증진을 위한 유연근무 혁신 안건입니다.',
    category: 'public',
    maxVoters: 100,
    createdAt: '2026-11-07',
    isOfficial: true,
    expiresAt: Date.now() + THIRTY_DAYS_MS,
    candidates: [
      {
        id: 'mon-1',
        symbolNumber: 1,
        party: '워라밸혁신당',
        title: '적극 찬성 (11시 출근 시행)',
        subtitle: '충분한 휴식으로 주간 업무 효율 극대화',
        badgeColor: 'blue',
        accentBg: '#3b82f6',
        description: '월요일 출근길 지옥철 회피 및 충분한 재충전으로 생산성을 높입니다.',
        votes: 0,
      },
      {
        id: 'mon-2',
        symbolNumber: 2,
        party: '안정운영당',
        title: '반대 (현행 9시 유지)',
        subtitle: '거래처 협업 및 업무 연속성 유지',
        badgeColor: 'rose',
        accentBg: '#f43f5e',
        description: '외부 고객사 응대 및 주요 주간 회의 일정 조율을 위해 기존 체제를 유지합니다.',
        votes: 0,
      },
      {
        id: 'mon-3',
        symbolNumber: 3,
        party: '단계적도입당',
        title: '1개월 시범 운영 후 재검토',
        subtitle: '데이터 분석 후 부작용 보완 도입',
        badgeColor: 'amber',
        accentBg: '#f59e0b',
        description: '단기 시범 운영을 통해 장단점을 객관적으로 파악하고 보완책을 마련합니다.',
        votes: 0,
      },
    ],
  },
  {
    id: 'poll-dinner',
    title: '연말 팀 회식 메뉴 대격돌',
    description: '한 해 동안 고생한 팀원들의 사기 충전을 위한 최적의 메뉴를 선택합니다.',
    category: 'public',
    maxVoters: 100,
    createdAt: '2026-11-07',
    isOfficial: true,
    expiresAt: Date.now() + THIRTY_DAYS_MS,
    candidates: [
      {
        id: 'din-1',
        symbolNumber: 1,
        party: '육식동행당',
        title: '지글지글 숙성 삼겹살 & 목살',
        subtitle: '특제 멜젓 + 된장찌개 + 볶음밥 마무리',
        badgeColor: 'rose',
        accentBg: '#f43f5e',
        description: '회식의 불패 신화! 고소한 돼지 기름과 갓 구운 김치의 환상적인 조화',
        votes: 0,
      },
      {
        id: 'din-2',
        symbolNumber: 2,
        party: '치맥연합당',
        title: '황금 올리브 치킨 & 수제맥주',
        subtitle: '다양한 시즈닝과 시원한 생맥주 파티',
        badgeColor: 'amber',
        accentBg: '#f59e0b',
        description: '캐주얼하고 활기찬 분위기! 부담 없이 즐기는 겉바속촉 치킨의 향연',
        votes: 0,
      },
      {
        id: 'din-3',
        symbolNumber: 3,
        party: '바다의맛당',
        title: '신선 제철 모듬회 & 매운탕',
        subtitle: '방어/광어/참돔 + 얼큰한 서더리탕',
        badgeColor: 'blue',
        accentBg: '#0284c7',
        description: '깔끔하고 고급스러운 한 상! 싱싱한 제철 활어회로 속 편하고 품격 있는 회식',
        votes: 0,
      },
    ],
  },
];

const STORAGE_KEY_POLLS = 'vps_all_polling_stations_v3';
const STORAGE_KEY_TALLIES_PREFIX = 'vps_tally_v3_';
const STORAGE_KEY_CHANNELS_PREFIX = 'vps_channels_v3_';

// Format human-readable remaining time
export function formatRemainingTime(expiresAt?: number): string {
  if (!expiresAt) return '상시 운영';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return '시간 만료 (마감)';

  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 0) {
    return `${days}일 ${hours}시간 남음`;
  }
  if (hours > 0) {
    return `${hours}시간 ${mins}분 남음`;
  }
  if (mins > 0) {
    return `${mins}분 ${secs}초 남음`;
  }
  return `${secs}초 남음`;
}

// Check if a poll is expired
export function isPollExpired(poll: PollStation): boolean {
  if (!poll.expiresAt) return false;
  return Date.now() >= poll.expiresAt;
}

export function getAllPolls(): PollStation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POLLS);
    if (raw) {
      const parsed = JSON.parse(raw) as PollStation[];
      const now = Date.now();
      // Filter out custom polls that have expired
      const validCustom = parsed.filter(
        (p) => p.isCustom && (!p.expiresAt || p.expiresAt > now)
      );

      // Re-persist if any expired custom poll was purged
      if (validCustom.length !== parsed.filter((p) => p.isCustom).length) {
        localStorage.setItem(STORAGE_KEY_POLLS, JSON.stringify(validCustom));
      }

      return [...PRESET_POLLS, ...validCustom];
    }
  } catch {
    // ignore
  }
  return PRESET_POLLS;
}

export function savePoll(poll: PollStation): void {
  const current = getAllPolls();
  const existingIdx = current.findIndex((p) => p.id === poll.id);
  let updated: PollStation[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = poll;
  } else {
    updated = [...current, poll];
  }

  // Only store custom polls to keep preset polls authoritative
  const customOnly = updated.filter((p) => p.isCustom);
  try {
    localStorage.setItem(STORAGE_KEY_POLLS, JSON.stringify(customOnly));
  } catch {
    // ignore
  }
}

export function deletePoll(pollId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_POLLS);
    if (raw) {
      const parsed = JSON.parse(raw) as PollStation[];
      const filtered = parsed.filter((p) => p.id !== pollId);
      localStorage.setItem(STORAGE_KEY_POLLS, JSON.stringify(filtered));
    }
    localStorage.removeItem(STORAGE_KEY_TALLIES_PREFIX + pollId);
    localStorage.removeItem(STORAGE_KEY_CHANNELS_PREFIX + pollId);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Official Polls: 100-voter Channel System ("온라인 갓바위" 방식 자동 증설)
// ---------------------------------------------------------------------------

export function getOfficialChannels(pollId: string, candidates: Candidate[]): PollChannelData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHANNELS_PREFIX + pollId);
    if (raw) {
      const parsed = JSON.parse(raw) as PollChannelData[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // Initial channel 1 with 0 votes
  const initialVotes: Record<string, number> = {};
  candidates.forEach((c) => {
    initialVotes[c.id] = 0;
  });

  return [
    {
      channelIndex: 1,
      votes: initialVotes,
      totalVotes: 0,
    },
  ];
}

export function saveOfficialChannels(pollId: string, channels: PollChannelData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CHANNELS_PREFIX + pollId, JSON.stringify(channels));
  } catch {
    // ignore
  }
}

export function getActiveOfficialChannel(
  pollId: string,
  candidates: Candidate[]
): {
  activeChannelIndex: number;
  channelVotes: number;
  totalCumulativeVotes: number;
  channelData: PollChannelData;
  allChannels: PollChannelData[];
  cumulativeCandidates: Candidate[];
} {
  const channels = getOfficialChannels(pollId, candidates);

  // Find the first channel that has < 100 votes
  let activeChannel = channels.find((ch) => ch.totalVotes < 100);

  if (!activeChannel) {
    // All existing channels are full! Automatically spawn next channel
    const nextIndex = channels.length + 1;
    const initialVotes: Record<string, number> = {};
    candidates.forEach((c) => {
      initialVotes[c.id] = 0;
    });

    activeChannel = {
      channelIndex: nextIndex,
      votes: initialVotes,
      totalVotes: 0,
    };
    channels.push(activeChannel);
    saveOfficialChannels(pollId, channels);
  }

  // Calculate cumulative votes across all channels
  const cumulativeMap: Record<string, number> = {};
  candidates.forEach((c) => {
    cumulativeMap[c.id] = 0;
  });

  let totalCumulativeVotes = 0;
  channels.forEach((ch) => {
    Object.entries(ch.votes).forEach(([cId, count]) => {
      cumulativeMap[cId] = (cumulativeMap[cId] || 0) + count;
      totalCumulativeVotes += count;
    });
  });

  const cumulativeCandidates = candidates.map((c) => ({
    ...c,
    votes: cumulativeMap[c.id] || 0,
  }));

  return {
    activeChannelIndex: activeChannel.channelIndex,
    channelVotes: activeChannel.totalVotes,
    totalCumulativeVotes,
    channelData: activeChannel,
    allChannels: channels,
    cumulativeCandidates,
  };
}

export function recordOfficialVote(
  pollId: string,
  candidateId: string,
  candidates: Candidate[]
): {
  activeChannelIndex: number;
  activeChannelVotes: number;
  totalCumulativeVotes: number;
  cumulativeCandidates: Candidate[];
  allChannels: PollChannelData[];
} {
  const channels = getOfficialChannels(pollId, candidates);

  // Find the first channel with < 100 votes
  let activeIndex = channels.findIndex((ch) => ch.totalVotes < 100);
  if (activeIndex < 0) {
    // Create new channel
    const newCh: PollChannelData = {
      channelIndex: channels.length + 1,
      votes: {},
      totalVotes: 0,
    };
    candidates.forEach((c) => {
      newCh.votes[c.id] = 0;
    });
    channels.push(newCh);
    activeIndex = channels.length - 1;
  }

  const currentCh = channels[activeIndex];
  currentCh.votes[candidateId] = (currentCh.votes[candidateId] || 0) + 1;
  currentCh.totalVotes = Object.values(currentCh.votes).reduce((s, v) => s + v, 0);

  // If this vote just made the channel reach 100, prepare the next channel right away
  if (currentCh.totalVotes >= 100) {
    const nextIndex = currentCh.channelIndex + 1;
    const initialVotes: Record<string, number> = {};
    candidates.forEach((c) => {
      initialVotes[c.id] = 0;
    });
    channels.push({
      channelIndex: nextIndex,
      votes: initialVotes,
      totalVotes: 0,
    });
  }

  saveOfficialChannels(pollId, channels);

  // Compute updated cumulative tallies
  const cumulativeMap: Record<string, number> = {};
  candidates.forEach((c) => {
    cumulativeMap[c.id] = 0;
  });

  let totalCumulative = 0;
  channels.forEach((ch) => {
    Object.entries(ch.votes).forEach(([cId, count]) => {
      cumulativeMap[cId] = (cumulativeMap[cId] || 0) + count;
      totalCumulative += count;
    });
  });

  const cumulativeCandidates = candidates.map((c) => ({
    ...c,
    votes: cumulativeMap[c.id] || 0,
  }));

  // Find new active channel
  const newActive = channels.find((ch) => ch.totalVotes < 100) || channels[channels.length - 1];

  return {
    activeChannelIndex: newActive.channelIndex,
    activeChannelVotes: newActive.totalVotes,
    totalCumulativeVotes: totalCumulative,
    cumulativeCandidates,
    allChannels: channels,
  };
}

// ---------------------------------------------------------------------------
// Custom Poll Tallies
// ---------------------------------------------------------------------------

export function getPollTallies(poll: PollStation): Candidate[] {
  if (poll.isOfficial) {
    const activeInfo = getActiveOfficialChannel(poll.id, poll.candidates);
    return activeInfo.cumulativeCandidates;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_TALLIES_PREFIX + poll.id);
    if (raw) {
      const savedVotes = JSON.parse(raw) as Record<string, number>;
      return poll.candidates.map((c) => ({
        ...c,
        votes: savedVotes[c.id] !== undefined ? savedVotes[c.id] : 0,
      }));
    }
  } catch {
    // ignore
  }
  return poll.candidates.map((c) => ({ ...c, votes: 0 }));
}

export function recordPollVote(
  pollId: string,
  candidateId: string,
  currentCandidates: Candidate[]
): Candidate[] {
  const updated = currentCandidates.map((c) => (c.id === candidateId ? { ...c, votes: c.votes + 1 } : c));
  const tallyMap: Record<string, number> = {};
  updated.forEach((c) => {
    tallyMap[c.id] = c.votes;
  });

  try {
    localStorage.setItem(STORAGE_KEY_TALLIES_PREFIX + pollId, JSON.stringify(tallyMap));
  } catch {
    // ignore
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Supabase Async Realtime & Duplicate Prevention Functions
// ---------------------------------------------------------------------------

const STORAGE_KEY_VOTED_PREFIX = 'vps_user_voted_';
const STORAGE_KEY_GUESTBOOK_PREFIX = 'vps_guestbook_';

/**
 * Check if the current browser/device has already cast a vote for this poll
 */
export async function checkHasVoted(pollId: string): Promise<boolean> {
  // 1. Check local storage cache first
  try {
    if (localStorage.getItem(STORAGE_KEY_VOTED_PREFIX + pollId) === 'true') {
      return true;
    }
  } catch {
    // ignore
  }

  // 2. Query Supabase votes table if configured (using voter_id = auth.uid())
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
      console.warn('[Supabase checkHasVoted error, fallback to local]', err);
    }
  }

  return false;
}

/**
 * Record a vote with duplicate prevention, official channel expansion, and Supabase sync
 */
export async function recordVoteAsync(
  pollId: string,
  candidateId: string,
  currentCandidates: Candidate[],
  isOfficial: boolean
): Promise<{
  success: boolean;
  alreadyVoted?: boolean;
  updatedCandidates: Candidate[];
  officialState?: {
    activeChannelIndex: number;
    channelVotes: number;
    totalCumulativeVotes: number;
    allChannels: PollChannelData[];
  };
}> {
  // Check duplicate vote
  const already = await checkHasVoted(pollId);
  if (already) {
    return {
      success: false,
      alreadyVoted: true,
      updatedCandidates: currentCandidates,
    };
  }

  // Mark in local storage immediately
  try {
    localStorage.setItem(STORAGE_KEY_VOTED_PREFIX + pollId, 'true');
  } catch {
    // ignore
  }

  // 1. Process in local data layer
  let updatedCandidates: Candidate[] = [];
  let officialState: {
    activeChannelIndex: number;
    channelVotes: number;
    totalCumulativeVotes: number;
    allChannels: PollChannelData[];
  } | undefined;

  if (isOfficial) {
    const res = recordOfficialVote(pollId, candidateId, currentCandidates);
    updatedCandidates = res.cumulativeCandidates;
    officialState = {
      activeChannelIndex: res.activeChannelIndex,
      channelVotes: res.activeChannelVotes,
      totalCumulativeVotes: res.totalCumulativeVotes,
      allChannels: res.allChannels,
    };
  } else {
    updatedCandidates = recordPollVote(pollId, candidateId, currentCandidates);
  }

  // 2. Persist to Supabase if configured (using voter_id = auth.uid())
  if (isSupabaseConfigured && supabase) {
    try {
      const userId = await ensureAnonymousAuth();
      if (userId) {
        await supabase.from('votes').insert([
          {
            poll_id: pollId,
            option_id: candidateId,
            voter_id: userId,
          },
        ]);

        const targetCandidate = updatedCandidates.find((c) => c.id === candidateId);
        if (targetCandidate) {
          await supabase
            .from('poll_options')
            .update({ vote_count: targetCandidate.votes })
            .eq('poll_id', pollId)
            .eq('id', candidateId);
        }
      }
    } catch (err) {
      console.warn('[Supabase recordVoteAsync error, local state retained]', err);
    }
  }

  return {
    success: true,
    alreadyVoted: false,
    updatedCandidates,
    officialState,
  };
}

/**
 * Async fetch polls merging Supabase and local/presets
 */
export async function fetchPollsAsync(): Promise<PollStation[]> {
  const localPolls = getAllPolls();

  if (!isSupabaseConfigured || !supabase) {
    return localPolls;
  }

  try {
    const { data: pollsData, error: pollsError } = await supabase
      .from('polls')
      .select('id, title, description, category, max_voters, duration_hours, expires_at, created_at')
      .order('created_at', { ascending: false });

    if (pollsError || !pollsData || pollsData.length === 0) {
      return localPolls;
    }

    const { data: optionsData } = await supabase.from('poll_options').select('*');

    const optionsMap: Record<string, Candidate[]> = {};
    if (optionsData) {
      optionsData.forEach((opt: any) => {
        if (!optionsMap[opt.poll_id]) {
          optionsMap[opt.poll_id] = [];
        }
        optionsMap[opt.poll_id].push({
          id: opt.id,
          symbolNumber: opt.symbol_number,
          party: opt.party || '',
          title: opt.title,
          subtitle: opt.subtitle || '',
          badgeColor: opt.badge_color || 'blue',
          accentBg: opt.accent_bg || '#3b82f6',
          description: opt.description || '',
          votes: Number(opt.vote_count) || 0,
        });
      });
    }

    const officialPresetIds = new Set(PRESET_POLLS.filter((p) => p.isOfficial).map((p) => p.id));

    const remotePolls: PollStation[] = pollsData.map((row: any) => {
      const candidates = (optionsMap[row.id] || []).sort(
        (a, b) => a.symbolNumber - b.symbolNumber
      );
      const isOfficial = officialPresetIds.has(String(row.id)) || row.category === 'official';
      return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        category: row.category || 'public',
        maxVoters: Number(row.max_voters) || 100,
        createdAt: row.created_at ? row.created_at.split('T')[0] : '2026-11-08',
        isOfficial,
        isCustom: !isOfficial,
        durationHours: Number(row.duration_hours) || 24,
        expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
        candidates: candidates.length > 0 ? candidates : PRESET_POLLS[0].candidates,
      };
    });

    // Merge: ensure preset polls are present
    const remoteIds = new Set(remotePolls.map((p) => p.id));
    const merged = [...remotePolls];
    PRESET_POLLS.forEach((preset) => {
      if (!remoteIds.has(preset.id)) {
        merged.push(preset);
      }
    });

    return merged;
  } catch (err) {
    console.warn('[Supabase fetchPollsAsync error, fallback to local]', err);
    return localPolls;
  }
}

/**
 * Save poll to local storage and Supabase
 */
export async function savePollAsync(poll: PollStation): Promise<void> {
  // Always save locally first
  savePoll(poll);

  if (isSupabaseConfigured && supabase && poll.isCustom) {
    try {
      // Upsert poll using actual DB columns only (no is_official, access_code, admin_pin)
      await supabase.from('polls').upsert([
        {
          id: poll.id,
          title: poll.title,
          description: poll.description,
          category: poll.category,
          max_voters: poll.maxVoters,
          duration_hours: poll.durationHours || 24,
          expires_at: poll.expiresAt ? new Date(poll.expiresAt).toISOString() : null,
          created_at: new Date().toISOString(),
        },
      ]);

      // Upsert options
      const optionRows = poll.candidates.map((c) => ({
        id: c.id,
        poll_id: poll.id,
        symbol_number: c.symbolNumber,
        party: c.party,
        title: c.title,
        subtitle: c.subtitle,
        badge_color: c.badgeColor,
        accent_bg: c.accentBg,
        vote_count: c.votes || 0,
      }));

      await supabase.from('poll_options').upsert(optionRows);
    } catch (err) {
      console.warn('[Supabase savePollAsync error, saved to local]', err);
    }
  }
}

/**
 * Delete poll from local storage and Supabase
 */
export async function deletePollAsync(pollId: string): Promise<void> {
  deletePoll(pollId);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('votes').delete().eq('poll_id', pollId);
      await supabase.from('poll_options').delete().eq('poll_id', pollId);
      await supabase.from('polls').delete().eq('id', pollId);
    } catch (err) {
      console.warn('[Supabase deletePollAsync error]', err);
    }
  }
}

// ---------------------------------------------------------------------------
// Guestbook (유권자 한마디 방명록)
// ---------------------------------------------------------------------------

export async function fetchGuestbookAsync(pollId: string): Promise<GuestbookEntry[]> {
  // 1. Try Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('guestbook')
        .select('id, poll_id, display_name, message, created_at')
        .eq('poll_id', pollId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return data.map((row: any) => ({
          id: String(row.id),
          pollId: row.poll_id || pollId,
          nickname: row.display_name || '선거인',
          message: row.message,
          createdAt: row.created_at,
        }));
      }
    } catch (err) {
      console.warn('[Supabase fetchGuestbookAsync error]', err);
    }
  }

  return [];
}

export async function addGuestbookAsync(
  pollId: string,
  nickname: string,
  message: string
): Promise<GuestbookEntry> {
  const newEntry: GuestbookEntry = {
    id: 'gb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
    pollId,
    nickname,
    message,
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseConfigured && supabase) {
    try {
      const userId = await ensureAnonymousAuth();
      if (userId) {
        await supabase.from('guestbook').insert([
          {
            poll_id: pollId,
            user_id: userId,
            display_name: nickname,
            message,
          },
        ]);
      }
    } catch (err) {
      console.warn('[Supabase addGuestbookAsync error]', err);
    }
  }

  return newEntry;
}
