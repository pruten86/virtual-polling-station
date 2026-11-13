export type AvatarType = 'male' | 'female';

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
  expiresAt?: number; // timestamp in ms (null/undefined means perpetual)
  durationHours?: number; // selected duration in hours
  activeChannelIndex?: number; // current open channel (1, 2, 3...)
  adminPin?: string; // 4-digit creator management PIN
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
