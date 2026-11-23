import { PollStation, Candidate, PollChannelData, normalizeResultVisibility } from '../types';
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

// Fixed seasonal deadlines for limited-time official polls
const OFFICIAL_MONDAY11_DEADLINE = new Date(2026, 11, 18, 23, 59, 0).getTime();
const OFFICIAL_DINNER_DEADLINE = new Date(2026, 11, 31, 23, 59, 0).getTime();

export const PRESET_POLLS: PollStation[] = [
  {
    id: 'poll-lunch',
    title: '제1회 오늘 점심 메뉴 모의투표',
    description: '오늘의 점심 메뉴를 민주적이고 공정하게 결정합니다.',
    category: 'public',
    maxVoters: 100,
    createdAt: '2026-11-07',
    isOfficial: true,
    isPermanent: true,
    expiresAt: undefined,
    resultVisibility: 'realtime',
    candidates: [
      {
        id: 'poll-lunch-1',
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
        id: 'poll-lunch-2',
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
        id: 'poll-lunch-3',
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
    isPermanent: false,
    expiresAt: OFFICIAL_MONDAY11_DEADLINE,
    resultVisibility: 'realtime',
    candidates: [
      {
        id: 'poll-monday11-1',
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
        id: 'poll-monday11-2',
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
        id: 'poll-monday11-3',
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
    isPermanent: false,
    expiresAt: OFFICIAL_DINNER_DEADLINE,
    candidates: [
      {
        id: 'poll-dinner-1',
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
        id: 'poll-dinner-2',
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
        id: 'poll-dinner-3',
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

export function formatDbOptionSubtitle(
  party?: string | null,
  subtitle?: string | null,
  symbolNumber: number = 1
): string {
  const p = (party || `기호 ${symbolNumber}번`).trim();
  const s = (subtitle || '').trim();
  if (!s || s === p) return p;
  if (s.startsWith(`${p} | `)) return s;
  return `${p} | ${s}`;
}

export function parseOptionPartyAndSubtitle(
  rawParty: unknown,
  rawSubtitle: unknown,
  symbolNumber: number = 1
): { party: string; subtitle: string } {
  const sRaw = typeof rawSubtitle === 'string' ? rawSubtitle.trim() : '';
  const pRaw = typeof rawParty === 'string' ? rawParty.trim() : '';

  if (sRaw.includes(' | ')) {
    const sepIdx = sRaw.indexOf(' | ');
    const left = sRaw.slice(0, sepIdx).trim();
    const right = sRaw.slice(sepIdx + 3).trim();
    return {
      party: pRaw || left || `기호 ${symbolNumber}번`,
      subtitle: right,
    };
  }

  if (pRaw) {
    return {
      party: pRaw,
      subtitle: sRaw === pRaw ? '' : sRaw,
    };
  }

  return {
    party: `기호 ${symbolNumber}번`,
    subtitle: sRaw,
  };
}

export function mergeOfficialPresetCandidates(
  presetPoll: PollStation,
  dbRows: Array<Record<string, any>>
): Candidate[] {
  return presetPoll.candidates.map((c) => {
    // 1. Exact canonical ID match first (only if title matches or DB row title is missing)
    const exactIdRow = dbRows.find(
      (r) =>
        String(r.id) === c.id &&
        (!r.title || String(r.title).trim() === c.title.trim())
    );
    if (exactIdRow) {
      return {
        ...c,
        votes: Number(exactIdRow.vote_count !== undefined ? exactIdRow.vote_count : exactIdRow.votes) || 0,
      };
    }

    // 2. Fallback match by symbol_number + exact candidate title (handles legacy IDs like lunch-1 safely, rejects contaminated rows)
    const symbolAndTitleRow = dbRows.find((r) => {
      const sym = Number(r.symbol_number ?? r.sort_order ?? r.symbolNumber);
      const rowTitle = typeof r.title === 'string' ? r.title.trim() : '';
      return sym === c.symbolNumber && rowTitle === c.title.trim();
    });

    return {
      ...c,
      votes: symbolAndTitleRow
        ? Number(
            symbolAndTitleRow.vote_count !== undefined
              ? symbolAndTitleRow.vote_count
              : symbolAndTitleRow.votes
          ) || 0
        : 0,
    };
  });
}

const STORAGE_KEY_POLLS = 'vps_all_polling_stations_v3';
const STORAGE_KEY_TALLIES_PREFIX = 'vps_tally_v3_';
const STORAGE_KEY_CHANNELS_PREFIX = 'vps_channels_v3_';
const STORAGE_KEY_CLOSED_OVERRIDES = 'vps_closed_polls_v1';

export function getClosedPollOverrides(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLOSED_OVERRIDES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore
  }
  return {};
}

export function setClosedPollOverride(pollId: string, closedAt: number): void {
  try {
    const overrides = getClosedPollOverrides();
    overrides[pollId] = closedAt;
    localStorage.setItem(STORAGE_KEY_CLOSED_OVERRIDES, JSON.stringify(overrides));

    const raw = localStorage.getItem(STORAGE_KEY_POLLS);
    if (raw) {
      const parsed = JSON.parse(raw) as PollStation[];
      const updated = parsed.map((p) => (p.id === pollId ? { ...p, expiresAt: closedAt } : p));
      localStorage.setItem(STORAGE_KEY_POLLS, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }
}

export interface PollWinnerSummary {
  hasVotes: boolean;
  isTie: boolean;
  winners: Candidate[];
  maxVotes: number;
  totalVotes: number;
  percent: number;
  summaryText: string;
}

export function getPollWinnerSummary(candidates: Candidate[]): PollWinnerSummary {
  const totalVotes = candidates.reduce((s, c) => s + (Number(c.votes) || 0), 0);
  if (totalVotes <= 0 || candidates.length === 0) {
    return {
      hasVotes: false,
      isTie: false,
      winners: [],
      maxVotes: 0,
      totalVotes: 0,
      percent: 0,
      summaryText: '투표 없음 (0표)',
    };
  }

  const maxVotes = Math.max(...candidates.map((c) => Number(c.votes) || 0));
  const winners = candidates.filter((c) => (Number(c.votes) || 0) === maxVotes);
  const percent = Math.round((maxVotes / totalVotes) * 100);
  const isTie = winners.length > 1;
  const winnerNames = winners.map((w) => w.title).join(', ');

  return {
    hasVotes: true,
    isTie,
    winners,
    maxVotes,
    totalVotes,
    percent,
    summaryText: isTie
      ? `공동 1위: ${winnerNames} (${maxVotes}표 · ${percent}%)`
      : `1위: ${winnerNames} (${maxVotes}표 · ${percent}%)`,
  };
}

export function isPollPermanent(
  poll?: Pick<PollStation, 'id' | 'isPermanent'> | null
): boolean {
  if (!poll) return false;
  return Boolean(poll.isPermanent) || poll.id === 'poll-lunch';
}

export function computeOfficialStationNumber(
  totalVotes: number,
  onlineCount: number = 0
): number {
  const safeVotes = Math.max(0, Math.floor(Number(totalVotes) || 0));
  const safeOnline = Math.max(0, Math.floor(Number(onlineCount) || 0));
  return Math.max(Math.floor(safeVotes / 100) + 1, Math.floor(safeOnline / 100) + 1);
}

export function formatClosedDateTimeKorean(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '마감 완료';
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}년 ${m}월 ${day}일 ${hh}:${mm} 마감`;
}

export function formatClosedDateTimeDot(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '마감 확정';
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${hh}:${mm} 마감 확정`;
}

export function formatScheduledDeadlineKorean(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '기한 제한 없음';
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}년 ${m}월 ${day}일 ${hh}:${mm} 마감`;
}

// Format human-readable remaining time
export function formatRemainingTime(expiresAt?: number, isPermanent?: boolean): string {
  if (isPermanent || !expiresAt) return '상시 운영 (기한 제한 없음)';
  const diff = expiresAt - Date.now();
  if (diff <= 0) return formatClosedDateTimeKorean(expiresAt);

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

// Check if a poll is expired (permanent polls never expire)
export function isPollExpired(poll: PollStation): boolean {
  if (isPollPermanent(poll)) return false;
  if (!poll.expiresAt) return false;
  return Date.now() >= poll.expiresAt;
}

export function getAllPolls(): PollStation[] {
  const closedOverrides = getClosedPollOverrides();
  const presetsWithOverrides = PRESET_POLLS.map((p) =>
    isPollPermanent(p)
      ? { ...p, isPermanent: true, expiresAt: undefined }
      : closedOverrides[p.id]
      ? { ...p, expiresAt: closedOverrides[p.id] }
      : p
  );

  try {
    const raw = localStorage.getItem(STORAGE_KEY_POLLS);
    if (raw) {
      const parsed = JSON.parse(raw) as PollStation[];
      // Preserve ALL custom polls including expired ones so results remain inspectable in Lobby
      const customPolls = parsed
        .filter((p) => p.isCustom)
        .map((p) => (closedOverrides[p.id] ? { ...p, expiresAt: closedOverrides[p.id] } : p));

      return [...presetsWithOverrides, ...customPolls];
    }
  } catch {
    // ignore
  }
  return presetsWithOverrides;
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
    let pollsData: any[] | null = null;
    let pollsError: any = null;

    const visRes = await supabase
      .from('polls')
      .select('id, title, description, category, max_voters, duration_hours, expires_at, created_at, result_visibility')
      .order('created_at', { ascending: false });

    if (
      visRes.error &&
      (visRes.error.code === '42703' ||
        visRes.error.code === 'PGRST204' ||
        (visRes.error.message || '').includes('result_visibility'))
    ) {
      const baseRes = await supabase
        .from('polls')
        .select('id, title, description, category, max_voters, duration_hours, expires_at, created_at')
        .order('created_at', { ascending: false });
      pollsData = baseRes.data;
      pollsError = baseRes.error;
    } else {
      pollsData = visRes.data;
      pollsError = visRes.error;
    }

    if (pollsError || !pollsData || pollsData.length === 0) {
      return localPolls;
    }

    const { data: optionsData } = await supabase.from('poll_options').select('*');

    const rawOptionsMap: Record<string, any[]> = {};
    const optionsMap: Record<string, Candidate[]> = {};
    if (optionsData) {
      optionsData.forEach((opt: any) => {
        if (!rawOptionsMap[opt.poll_id]) {
          rawOptionsMap[opt.poll_id] = [];
        }
        rawOptionsMap[opt.poll_id].push(opt);

        if (!optionsMap[opt.poll_id]) {
          optionsMap[opt.poll_id] = [];
        }
        const symbolNumber = Number(opt.symbol_number ?? opt.sort_order) || 1;
        const { party, subtitle } = parseOptionPartyAndSubtitle(
          opt.party,
          opt.subtitle,
          symbolNumber
        );
        optionsMap[opt.poll_id].push({
          id: opt.id,
          symbolNumber,
          party,
          title: opt.title,
          subtitle,
          badgeColor: opt.badge_color || 'blue',
          accentBg: opt.accent_bg || '#3b82f6',
          description: opt.description || subtitle || '',
          votes: Number(opt.vote_count) || 0,
        });
      });
    }

    const presetById = new Map(PRESET_POLLS.map((p) => [p.id, p]));
    const localById = new Map(localPolls.map((p) => [p.id, p]));

    const remotePolls: PollStation[] = pollsData.map((row: any) => {
      const rowId = String(row.id);
      const presetMatch = presetById.get(rowId);
      const localMatch = localById.get(rowId);

      if (presetMatch) {
        const mergedOfficialCandidates = mergeOfficialPresetCandidates(
          presetMatch,
          rawOptionsMap[rowId] || []
        );
        return {
          ...presetMatch,
          expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : presetMatch.expiresAt,
          resultVisibility: 'realtime',
          candidates: mergedOfficialCandidates,
        };
      }

      const candidates = (optionsMap[row.id] || []).sort(
        (a, b) => a.symbolNumber - b.symbolNumber
      );
      const isOfficial = row.category === 'official';
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
        resultVisibility: normalizeResultVisibility(
          row.result_visibility ?? localMatch?.resultVisibility
        ),
        candidates: candidates.length > 0 ? candidates : localMatch?.candidates || [],
      };
    });

    // Merge: ensure preset polls are present
    const remoteIds = new Set(remotePolls.map((p) => p.id));
    const merged = [...remotePolls];
    PRESET_POLLS.forEach((preset) => {
      if (!remoteIds.has(preset.id)) {
        merged.push({
          ...preset,
          candidates: mergeOfficialPresetCandidates(preset, rawOptionsMap[preset.id] || []),
        });
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
      // Upsert poll with result_visibility and safe fallback if column doesn't exist yet
      const basePollRow = {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        category: poll.category,
        max_voters: poll.maxVoters,
        duration_hours: Math.max(1, Math.round(poll.durationHours || 24)),
        expires_at: poll.expiresAt ? new Date(poll.expiresAt).toISOString() : null,
        created_at: new Date().toISOString(),
      };
      const { error: pollUpsertErr } = await supabase.from('polls').upsert([
        {
          ...basePollRow,
          result_visibility: normalizeResultVisibility(poll.resultVisibility),
        },
      ]);
      if (
        pollUpsertErr &&
        (pollUpsertErr.code === '42703' ||
          pollUpsertErr.code === 'PGRST204' ||
          (pollUpsertErr.message || '').includes('result_visibility'))
      ) {
        await supabase.from('polls').upsert([basePollRow]);
      }

      // Upsert options preserving party in both party and subtitle
      const optionRowsWithParty = poll.candidates.map((c, idx) => ({
        id: c.id,
        poll_id: poll.id,
        symbol_number: c.symbolNumber || idx + 1,
        sort_order: c.symbolNumber || idx + 1,
        party: c.party || `기호 ${idx + 1}번`,
        title: c.title,
        subtitle: formatDbOptionSubtitle(c.party, c.subtitle || c.description, idx + 1),
        badge_color: c.badgeColor,
        accent_bg: c.accentBg,
        vote_count: c.votes || 0,
      }));

      const { error: optErr } = await supabase.from('poll_options').upsert(optionRowsWithParty);
      if (
        optErr &&
        ((optErr.message || '').includes('party') ||
          optErr.code === '42703' ||
          optErr.code === 'PGRST204')
      ) {
        const optionRowsNoParty = optionRowsWithParty.map(({ party: _p, ...rest }) => rest);
        await supabase.from('poll_options').upsert(optionRowsNoParty);
      }
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
