export type AvatarType =
  | 'male_1'
  | 'male_2'
  | 'male_3'
  | 'female_1'
  | 'female_2'
  | 'female_3';

export const AVATAR_TYPES: readonly AvatarType[] = [
  'male_1',
  'male_2',
  'male_3',
  'female_1',
  'female_2',
  'female_3',
] as const;

export interface AvatarMeta {
  id: AvatarType;
  gender: 'male' | 'female';
  shortName: string;
  fullName: string;
  subtitle: string;
  hairColor: string;
  topColor: string;
  pantsColor: string;
  accentColor: string;
  bgSoft: string;
  hasGlasses?: boolean;
}

export const AVATAR_META: Record<AvatarType, AvatarMeta> = {
  male_1: {
    id: 'male_1',
    gender: 'male',
    shortName: '머스타드남',
    fullName: '따뜻한 머스타드남',
    subtitle: '머스타드 니트 · 숏컷',
    hairColor: '#4A3428',
    topColor: '#E8B84B',
    pantsColor: '#6B5443',
    accentColor: '#D19D32',
    bgSoft: '#FDF3D7',
  },
  male_2: {
    id: 'male_2',
    gender: 'male',
    shortName: '민트남',
    fullName: '산뜻한 민트남',
    subtitle: '세이지 민트 · 가르마',
    hairColor: '#2B1F1B',
    topColor: '#7BC4A4',
    pantsColor: '#455A75',
    accentColor: '#5DA686',
    bgSoft: '#E3F5EC',
  },
  male_3: {
    id: 'male_3',
    gender: 'male',
    shortName: '안경남',
    fullName: '댄디 안경남',
    subtitle: '블루 가디건 · 뿔테',
    hairColor: '#3A2820',
    topColor: '#6C93B8',
    pantsColor: '#4A4E57',
    accentColor: '#FAF3E7',
    bgSoft: '#E5EFF8',
    hasGlasses: true,
  },
  female_1: {
    id: 'female_1',
    gender: 'female',
    shortName: '단발녀',
    fullName: '포근한 단발녀',
    subtitle: '피치 코랄 · 단발',
    hairColor: '#4E3529',
    topColor: '#F09684',
    pantsColor: '#D8C9B8',
    accentColor: '#F6E2A4',
    bgSoft: '#FCEAE6',
  },
  female_2: {
    id: 'female_2',
    gender: 'female',
    shortName: '묶음녀',
    fullName: '상큼한 묶음머리녀',
    subtitle: '버터 조끼 · 로우번',
    hairColor: '#362219',
    topColor: '#F2D16B',
    pantsColor: '#6F727A',
    accentColor: '#FFFDF8',
    bgSoft: '#FDF5DB',
  },
  female_3: {
    id: 'female_3',
    gender: 'female',
    shortName: '긴머리녀',
    fullName: '차분한 긴머리녀',
    subtitle: '라벤더 · 긴생머리',
    hairColor: '#3F281E',
    topColor: '#B49BD6',
    pantsColor: '#B49BD6',
    accentColor: '#5B3E2E',
    bgSoft: '#F1EBF9',
  },
};

export const AVATAR_STORAGE_KEY = 'vps_avatar_type_v1';

/**
 * Normalizes legacy ('male' | 'female') or unknown values into valid 6-variant AvatarType
 */
export function normalizeAvatarType(raw: unknown): AvatarType {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (
      trimmed === 'male_1' ||
      trimmed === 'male_2' ||
      trimmed === 'male_3' ||
      trimmed === 'female_1' ||
      trimmed === 'female_2' ||
      trimmed === 'female_3'
    ) {
      return trimmed;
    }
    if (trimmed === 'female') return 'female_1';
    if (trimmed === 'male') return 'male_1';
  }
  return 'male_1';
}

export interface Candidate {
  id: string;
  symbolNumber: number;
  party: string;
  title: string;
  subtitle: string;
  badgeColor: string;
  accentBg: string;
  description: string;
  votes: number;
}

export type StationZone = 'desk' | 'booth' | 'box' | 'billboard' | 'exit';

export interface PollChannelData {
  channelIndex: number;
  votes: Record<string, number>;
  totalVotes: number;
}

export interface PollStation {
  id: string;
  title: string;
  description: string;
  category: 'public' | 'private' | 'custom';
  accessCode?: string; // 4-digit code if private
  maxVoters?: number; // Per-channel or custom capacity (default 100)
  candidates: Candidate[]; // 2 to 10 choices
  createdAt: string;
  isCustom?: boolean;
  isOfficial?: boolean;
  isPermanent?: boolean; // perpetual official poll (e.g. poll-lunch)
  expiresAt?: number; // timestamp in ms (null/undefined means perpetual)
  durationHours?: number; // selected duration in hours
  activeChannelIndex?: number; // current open channel (1, 2, 3...)
  adminPin?: string; // 4-digit creator management PIN
  ownerId?: string; // creator userId / voter UUID
}

export interface PollingStationState {
  hasEntered: boolean;
  nickname: string;
  avatarType: AvatarType;
  hasBallot: boolean;
  signatureDataUrl: string | null;
  hasStamped: boolean;
  selectedCandidateId: string | null;
  hasVoted: boolean;
  voteTimestamp: string | null;
  currentZoneNear: StationZone | null;
  currentPoll: PollStation;
}
