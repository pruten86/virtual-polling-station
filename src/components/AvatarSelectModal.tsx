import React, { useState, useEffect, useMemo } from 'react';
import {
  AvatarType,
  AVATAR_TYPES,
  AVATAR_META,
  AVATAR_STORAGE_KEY,
  normalizeAvatarType,
  PollStation,
  Candidate,
  ResultVisibility,
  normalizeResultVisibility,
  isPhotoPollCandidates,
} from '../types';
import { sounds } from '../sound';
import { AvatarIllustration } from './AvatarIllustration';
import { CandidateThumbnail } from './CandidateThumbnail';
import {
  generateRandomNickname,
  getAllPolls,
  savePoll,
  deletePoll,
  savePollAsync,
  deletePollAsync,
  fetchPollsAsync,
  BETA_DISCLAIMER_TEXT,
  checkPoliticalContent,
  formatRemainingTime,
  isPollExpired,
  isPollPermanent,
  computeOfficialStationNumber,
  formatClosedDateTimeKorean,
  formatScheduledDeadlineKorean,
  getPollWinnerSummary,
} from '../data/presetPolls';
import {
  fetchVoteversePolls,
  subscribeAllPollsRealtime,
  subscribeLobbyPresenceCounts,
  subscribePollsMetaRealtime,
  unlockPollAdminSession,
  isPollOwnerOrAdmin,
  findPrivatePollByAccessCode,
} from '../lib/voteverseBackend';
import { CreatePollModal, PollDurationSelector, ResultVisibilitySelector } from './CreatePollModal';
import {
  Sparkles,
  Dices,
  Vote,
  Lock,
  Unlock,
  PlusCircle,
  Copy,
  Check,
  Users,
  ChevronRight,
  ShieldCheck,
  Plus,
  Trash2,
  AlertTriangle,
  Clock,
  Layers,
  Pencil,
  X,
  BarChart3,
  Award,
  Trophy,
} from 'lucide-react';

const COMPACT_AVATAR_LABELS: Record<AvatarType, string> = {
  male_1: '머스타드',
  male_2: '민트남',
  male_3: '안경남',
  female_1: '단발녀',
  female_2: '묶음녀',
  female_3: '긴머리',
};

interface AvatarSelectModalProps {
  initialPollId?: string | null;
  currentAvatarType?: AvatarType;
  externalPolls?: PollStation[];
  onPollsUpdated?: (polls: PollStation[]) => void;
  onOpenResultsDirect?: (poll: PollStation, openOfficialDocs?: boolean) => void;
  onEnter: (nickname: string, avatarType: AvatarType, selectedPoll: PollStation) => void;
}

export const AvatarSelectModal: React.FC<AvatarSelectModalProps> = ({
  initialPollId,
  currentAvatarType,
  externalPolls,
  onPollsUpdated,
  onOpenResultsDirect,
  onEnter,
}) => {
  // 1. Nickname state with auto-generation & 6-variant avatar selection with legacy fallback
  const [nickname, setNickname] = useState<string>(() => generateRandomNickname());
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>(() => {
    if (currentAvatarType) return normalizeAvatarType(currentAvatarType);
    try {
      return normalizeAvatarType(localStorage.getItem(AVATAR_STORAGE_KEY));
    } catch {
      return 'male_1';
    }
  });

  useEffect(() => {
    if (currentAvatarType) {
      setSelectedAvatar(normalizeAvatarType(currentAvatarType));
    }
  }, [currentAvatarType]);

  // 2. Polls & Tabs
  const [polls, setPolls] = useState<PollStation[]>(() =>
    externalPolls && externalPolls.length > 0 ? externalPolls : getAllPolls()
  );
  const [activeTab, setActiveTab] = useState<'public' | 'private' | 'create'>('public');

  // Set of unlocked private poll IDs
  const [unlockedPrivatePollIds, setUnlockedPrivatePollIds] = useState<Set<string>>(() => new Set());

  // Sync if parent passes updated polls
  useEffect(() => {
    if (externalPolls && externalPolls.length > 0) {
      setPolls(externalPolls);
    }
  }, [externalPolls]);

  // Live per-poll concurrent visitor counts via Supabase Lobby Presence
  const [livePresenceCounts, setLivePresenceCounts] = useState<Record<string, number>>({});

  // Periodic tick for live countdown timer, DB fetch on lobby open, and global poll_options Realtime subscription
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    let isMounted = true;

    // Fetch all polls & fresh poll_options vote_counts from Supabase whenever Lobby opens
    fetchVoteversePolls().then((fetched) => {
      if (isMounted && fetched && fetched.length > 0) {
        setPolls(fetched);
        onPollsUpdated?.(fetched);
      }
    });

    // Subscribe to live public.poll_options updates across all polls while Lobby is open
    const unsubscribeAll = subscribeAllPollsRealtime(({ pollId, optionId, votes }) => {
      if (!isMounted) return;
      setPolls((prev) => {
        const next = prev.map((p) => {
          if (p.id !== pollId) return p;
          return {
            ...p,
            candidates: p.candidates.map((c) => (c.id === optionId ? { ...c, votes } : c)),
          };
        });
        queueMicrotask(() => {
          if (isMounted) onPollsUpdated?.(next);
        });
        return next;
      });
    });

    // Subscribe to live per-poll visitor presence counts across the platform
    const unsubscribeLobbyPresence = subscribeLobbyPresenceCounts((counts) => {
      if (isMounted) {
        setLivePresenceCounts(counts);
      }
    });

    // Subscribe to immediate poll close / expires_at updates
    const unsubscribeMeta = subscribePollsMetaRealtime((pollId, expiresAt) => {
      if (!isMounted) return;
      setPolls((prev) => {
        const next = prev.map((p) => (p.id === pollId ? { ...p, expiresAt } : p));
        queueMicrotask(() => {
          if (isMounted) onPollsUpdated?.(next);
        });
        return next;
      });
    });

    // Keep ticking every second to refresh remaining countdowns (NEVER delete/hide expired polls)
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => {
      isMounted = false;
      unsubscribeAll();
      unsubscribeLobbyPresence();
      unsubscribeMeta();
      clearInterval(timer);
    };
  }, [onPollsUpdated]);

  // Selected Poll
  const [selectedPollId, setSelectedPollId] = useState<string>(() => {
    if (initialPollId) {
      const match = getAllPolls().find((p) => p.id === initialPollId);
      if (match) return match.id;
    }
    return 'poll-lunch';
  });

  // Keep selectedPollId synced when initialPollId (e.g. ?poll=ID) resolves asynchronously from DB
  useEffect(() => {
    if (!initialPollId) return;
    const match = polls.find((p) => p.id === initialPollId);
    if (match) {
      setSelectedPollId(match.id);
      if (match.category === 'private') {
        setActiveTab((prev) => (prev === 'create' ? prev : 'private'));
      }
    }
  }, [initialPollId, polls]);

  // Private Code Tab Input
  const [privateCode, setPrivateCode] = useState<string>('');
  const [privateCodeError, setPrivateCodeError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin PIN Auth Modal (for Edit / Delete)
  const [adminAuthModal, setAdminAuthModal] = useState<{
    type: 'delete' | 'edit';
    poll: PollStation;
  } | null>(null);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState<string | null>(null);

  // Edit Poll Modal State
  const [editingPoll, setEditingPoll] = useState<PollStation | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editMaxVoters, setEditMaxVoters] = useState(100);
  const [editDurationHours, setEditDurationHours] = useState(24);
  const [editDurationTouched, setEditDurationTouched] = useState(false);
  const [editResultVisibility, setEditResultVisibility] = useState<ResultVisibility>('realtime');
  const [editChoices, setEditChoices] = useState<Array<{ title: string; subtitle: string; party: string }>>([]);
  const [editError, setEditError] = useState<string | null>(null);

  // Private Access Code Prompt Modal (for entering locked private poll)
  const [accessCodeModalPoll, setAccessCodeModalPoll] = useState<PollStation | null>(null);
  const [accessCodeInput, setAccessCodeInput] = useState('');
  const [accessCodeModalError, setAccessCodeModalError] = useState<string | null>(null);

  // Political Warning Popup Modal (triggered on enter/submit attempt)
  const [politicalAlertModal, setPoliticalAlertModal] = useState<{
    detectedKeyword: string;
  } | null>(null);

  // Real-time Political Keyword Validation for Edit Form
  const editPoliticalCheck = useMemo(() => {
    if (!editingPoll) return { hasForbidden: false };
    const textsToCheck = [
      editTitle,
      editDesc,
      ...editChoices.map((c) => `${c.title} ${c.party} ${c.subtitle}`),
    ];
    return checkPoliticalContent(textsToCheck);
  }, [editingPoll, editTitle, editDesc, editChoices]);

  // Randomize nickname
  const handleRollNickname = () => {
    sounds.playClick();
    const newName = generateRandomNickname();
    setNickname(newName);
  };

  // Copy share link with clean origin resolution
  const handleCopyLink = (pollId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    sounds.playClick();
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('poll', pollId);
    navigator.clipboard.writeText(url.toString());
    setCopiedId(pollId);
    setTimeout(() => {
      setCopiedId((prev) => (prev === pollId ? null : prev));
    }, 2500);
  };

  // Add choice in edit form (up to 10)
  const handleAddEditChoice = () => {
    if (editChoices.length >= 10) return;
    sounds.playClick();
    const nextNum = editChoices.length + 1;
    setEditChoices([...editChoices, { title: `선택지 ${nextNum}`, subtitle: `상세 설명`, party: `기호 ${nextNum}번` }]);
  };

  // Remove choice in edit form (minimum 2)
  const handleRemoveEditChoice = (idx: number) => {
    if (editChoices.length <= 2) return;
    sounds.playClick();
    setEditChoices(editChoices.filter((_, i) => i !== idx));
  };

  // Join private poll with participant code (supports cross-device Supabase lookup)
  const handleJoinPrivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrivateCodeError(null);
    const code = privateCode.trim();
    if (!code) {
      setPrivateCodeError('4자리 코드를 입력해주세요.');
      return;
    }

    let matched = polls.find(
      (p) => p.category === 'private' && (p.accessCode === code || p.id === code)
    );

    if (!matched) {
      const remotePrivate = await findPrivatePollByAccessCode(code);
      if (remotePrivate) {
        matched = remotePrivate;
        setPolls((prev) => {
          const next = [remotePrivate, ...prev.filter((p) => p.id !== remotePrivate.id)];
          onPollsUpdated?.(next);
          return next;
        });
      }
    }

    if (matched) {
      sounds.playClick();
      setUnlockedPrivatePollIds((prev) => new Set(prev).add(matched!.id));
      setSelectedPollId(matched.id);
      setPrivateCodeError(null);
      setPrivateCode('');
    } else {
      setPrivateCodeError('입장 코드가 일치하는 비공개 투표소를 찾을 수 없습니다.');
    }
  };

  // Verify PIN for Admin Actions (Delete or Edit)
  const handleAdminPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAuthModal) return;

    const targetPoll = adminAuthModal.poll;
    const inputPin = adminPinInput.trim();
    const correctPin = targetPoll.adminPin;

    const isAuthorized = correctPin
      ? inputPin === correctPin
      : isPollOwnerOrAdmin(targetPoll);

    if (isAuthorized) {
      sounds.playClick();
      unlockPollAdminSession(targetPoll.id);

      if (adminAuthModal.type === 'delete') {
        deletePollAsync(targetPoll.id);
        setPolls((prev) => prev.filter((p) => p.id !== targetPoll.id));
        if (selectedPollId === targetPoll.id) {
          setSelectedPollId('poll-lunch');
        }
        setAdminAuthModal(null);
        setAdminPinInput('');
        setAdminPinError(null);
      } else {
        // Open edit form modal
        setAdminAuthModal(null);
        setAdminPinInput('');
        setAdminPinError(null);

        setEditingPoll(targetPoll);
        setEditTitle(targetPoll.title);
        setEditDesc(targetPoll.description);
        setEditMaxVoters(targetPoll.maxVoters || 100);
        setEditDurationHours(targetPoll.durationHours || 24);
        setEditDurationTouched(false);
        setEditResultVisibility(normalizeResultVisibility(targetPoll.resultVisibility));
        setEditChoices(
          targetPoll.candidates.map((c) => ({
            title: c.title,
            subtitle: c.subtitle,
            party: c.party,
          }))
        );
        setEditError(null);
      }
    } else {
      sounds.playClick();
      setAdminPinError('개설자 관리 비밀번호가 일치하지 않습니다.');
    }
  };

  // Handle Edit Poll Submission
  const handleEditPollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoll) return;

    if (!editTitle.trim()) return;

    // Political and Real Election Keyword Check
    if (editPoliticalCheck.hasForbidden) {
      sounds.playClick();
      setEditError(
        `⚠️ 민감한 정치인 성명 또는 정치 키워드('${editPoliticalCheck.keyword}')는 사용할 수 없습니다. 일상·모임 주제로 작성해 주세요.`
      );
      setPoliticalAlertModal({
        detectedKeyword: editPoliticalCheck.keyword || '정치·선거',
      });
      return;
    }

    sounds.playClick();
    const colors = ['rose', 'blue', 'emerald', 'amber', 'purple', 'indigo', 'teal', 'orange', 'cyan', 'pink'];
    const hexes = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#ec4899'];

    const updatedCandidates: Candidate[] = editChoices.map((c, idx) => {
      const existingCandidate = editingPoll.candidates[idx];
      return {
        id: existingCandidate ? existingCandidate.id : `${editingPoll.id}-c${idx + 1}`,
        symbolNumber: idx + 1,
        party: c.party.trim() || `기호 ${idx + 1}번`,
        title: c.title.trim() || `후보 ${idx + 1}`,
        subtitle: c.subtitle.trim() || '선택지 설명',
        badgeColor: colors[idx % colors.length],
        accentBg: hexes[idx % hexes.length],
        description: c.subtitle.trim() || '',
        votes: existingCandidate ? existingCandidate.votes : 0,
        ...(existingCandidate?.imageUrl ? { imageUrl: existingCandidate.imageUrl } : {}),
        ...(existingCandidate?.imageCrop ? { imageCrop: existingCandidate.imageCrop } : {}),
      };
    });

    const updatedExpiresAt = editDurationTouched
      ? Date.now() + editDurationHours * 3600 * 1000
      : editingPoll.expiresAt;

    if (updatedExpiresAt && updatedExpiresAt > Date.now()) {
      try {
        const raw = localStorage.getItem('vps_closed_polls_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && editingPoll.id in parsed) {
            delete parsed[editingPoll.id];
            localStorage.setItem('vps_closed_polls_v1', JSON.stringify(parsed));
          }
        }
      } catch {
        // ignore
      }
    }

    const updatedPoll: PollStation = {
      ...editingPoll,
      title: editTitle.trim(),
      description: editDesc.trim(),
      maxVoters: Math.max(2, Math.min(100, Number(editMaxVoters) || 100)),
      durationHours: editDurationHours,
      expiresAt: updatedExpiresAt,
      resultVisibility: editResultVisibility,
      candidates: updatedCandidates,
    };

    savePollAsync(updatedPoll);
    setPolls((prev) => {
      const next = prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p));
      queueMicrotask(() => {
        onPollsUpdated?.(next);
      });
      return next;
    });
    setEditingPoll(null);
    setEditDurationTouched(false);
  };

  // Verify participant access code for private poll entrance
  const handleVerifyAccessCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessCodeModalPoll) return;

    const inputCode = accessCodeInput.trim();
    if (inputCode === accessCodeModalPoll.accessCode) {
      sounds.playClick();
      setUnlockedPrivatePollIds((prev) => new Set(prev).add(accessCodeModalPoll.id));
      const target = accessCodeModalPoll;
      setAccessCodeModalPoll(null);
      setAccessCodeInput('');
      setAccessCodeModalError(null);

      // Proceed to enter
      const finalName = nickname.trim() || '행복한 유권자';
      onEnter(finalName, selectedAvatar, target);
    } else {
      sounds.playClick();
      setAccessCodeModalError('입장 코드가 일치하지 않습니다.');
    }
  };

  // Final submit to enter 3D station
  const handleFinalEnter = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = nickname.trim() || '행복한 유권자';
    const targetPoll = polls.find((p) => p.id === selectedPollId) || polls[0];

    // If private and not yet unlocked, require 4-digit participant accessCode first!
    if (targetPoll.category === 'private' && !unlockedPrivatePollIds.has(targetPoll.id)) {
      sounds.playClick();
      setAccessCodeModalPoll(targetPoll);
      setAccessCodeInput('');
      setAccessCodeModalError(null);
      return;
    }

    sounds.playClick();
    onEnter(finalName, selectedAvatar, targetPoll);
  };

  const selectedPoll = polls.find((p) => p.id === selectedPollId) || polls[0];

  // Compute stats for selected poll
  let isSelectedPollFull = false;
  let selectedPollDisplayTotal = 0;
  let selectedPollCapacity = selectedPoll.maxVoters || 100;
  let selectedPollChannelLabel = '';

  const selectedLiveCount = livePresenceCounts[selectedPoll.id] || 0;
  if (selectedPoll.isOfficial) {
    const dbTotal = selectedPoll.candidates.reduce((s, c) => s + (Number(c.votes) || 0), 0);
    const activeChannelIndex = computeOfficialStationNumber(dbTotal, selectedLiveCount);
    const channelVotes = dbTotal % 100;
    selectedPollDisplayTotal = dbTotal;
    selectedPollChannelLabel = `제${activeChannelIndex}투표소 • ${channelVotes} / 100명 (누적 ${dbTotal}명)`;
    isSelectedPollFull = false;
  } else {
    selectedPollDisplayTotal = selectedPoll.candidates.reduce((s, c) => s + (Number(c.votes) || 0), 0);
    selectedPollCapacity = selectedPoll.maxVoters || 100;
    isSelectedPollFull = selectedPollDisplayTotal >= selectedPollCapacity;
  }

  const isSelectedPrivateLocked =
    selectedPoll.category === 'private' && !unlockedPrivatePollIds.has(selectedPoll.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl px-3 py-3 sm:px-6 sm:py-5 text-slate-100 my-auto">
        {/* Header: 보트버스 (VOTEVERSE) Official Branding */}
        <div className="text-center mb-3 sm:mb-4">
          <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-500/10 border-2 border-rose-500/60 text-rose-500 mb-1.5 shadow-lg shadow-rose-950/40">
            <svg viewBox="0 0 64 64" className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden="true">
              <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="4.5" />
              <path
                d="M32 15v34M32 32l14-7.5"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white leading-tight">
            보트버스 VOTEVERSE
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 font-medium">
            클릭 대신 발걸음으로, 우리가 만나는 3D 투표 광장
          </p>
        </div>

        {/* 1. Voter Nickname Input with 🎲 Random Button */}
        <div className="mb-3 sm:mb-4 bg-slate-800/60 border border-slate-700/70 rounded-xl px-2.5 py-2 sm:p-3">
          <div className="flex items-center justify-between gap-1 sm:gap-2 flex-nowrap w-full mb-1.5">
            <label className="flex items-center gap-1 sm:gap-2 flex-nowrap min-w-0 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold text-slate-300 tracking-tight whitespace-nowrap shrink-0">
                선거인 닉네임 (성명)
              </span>
              <span className="text-[10px] sm:text-xs text-sky-400 font-normal tracking-tighter sm:tracking-normal whitespace-nowrap shrink-0">
                자동 생성 또는 직접 수정
              </span>
            </label>
            <button
              type="button"
              onClick={handleRollNickname}
              className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[10px] sm:text-xs font-semibold whitespace-nowrap shrink-0 transition active:scale-95 cursor-pointer"
            >
              <Dices className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-300 shrink-0" />
              <span className="whitespace-nowrap">랜덤 닉네임 뽑기</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={nickname}
              maxLength={32}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 배고픈 위원장 #402"
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-600 rounded-lg text-white font-semibold text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
            />
          </div>
        </div>

        {/* 2. Polling Stations Lobby Tabs */}
        <div className="mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Vote className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>참여할 투표소 선택</span>
            </label>
            <span className="text-[11px] text-slate-400 whitespace-normal break-keep break-words leading-snug">
              현재 선택: <strong className="text-white whitespace-normal break-keep break-words">{selectedPoll.title}</strong>
            </span>
          </div>

          {/* Tab Buttons */}
          <div className="grid grid-cols-3 gap-1 sm:gap-1.5 bg-slate-800/80 p-1 rounded-xl mb-3 border border-slate-700/80">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('public');
              }}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                activeTab === 'public'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>열린 광장</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('private');
              }}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                activeTab === 'private'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>코드 입장</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('create');
              }}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 py-2 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>+ 새 투표소</span>
            </button>
          </div>

          {/* Tab 1: Public Polls List */}
          {activeTab === 'public' && (
            <div className="space-y-2.5 max-h-[340px] sm:max-h-72 overflow-y-auto pr-0.5">
              {polls
                .filter((p) => p.category !== 'private')
                .map((poll) => {
                  const isSelected = selectedPollId === poll.id;
                  const isCopied = copiedId === poll.id;
                  const totalVotes = poll.candidates.reduce((s, c) => s + (Number(c.votes) || 0), 0);
                  const liveCount = livePresenceCounts[poll.id] || 0;
                  const isPermanent = isPollPermanent(poll);
                  const isTimeClosed = isPollExpired(poll);
                  const winnerSummary = getPollWinnerSummary(poll.candidates);
                  const closedTimeText = formatClosedDateTimeKorean(poll.expiresAt);

                  let channelBadge = '';
                  let voterDetailText = '';
                  let isFull = false;

                  if (poll.isOfficial) {
                    const activeChannelIndex = computeOfficialStationNumber(totalVotes, liveCount);
                    const channelVotes = totalVotes % 100;
                    channelBadge = `제${activeChannelIndex}투표소`;
                    voterDetailText = `${channelBadge} • ${channelVotes} / 100명 (누적 ${totalVotes}명)`;
                    isFull = false;
                  } else {
                    const maxCap = poll.maxVoters || 100;
                    isFull = totalVotes >= maxCap;
                    voterDetailText = `정원 ${maxCap}명`;
                  }

                  const remainingTimeStr = formatRemainingTime(poll.expiresAt, isPermanent);

                  return (
                    <div
                      key={poll.id}
                      onClick={() => {
                        sounds.playClick();
                        setSelectedPollId(poll.id);
                      }}
                      className={`px-3 py-3.5 sm:p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-400 ring-1 ring-sky-400/40 shadow-sm'
                          : isTimeClosed
                          ? 'bg-slate-800/50 border-slate-700/80 hover:bg-slate-800 hover:border-slate-500'
                          : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      {/* Top Row: Badges + Radio Indicator */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {poll.isOfficial ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                              <Layers className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>공식 ({channelBadge})</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30 whitespace-nowrap shrink-0">
                              사용자 개설
                            </span>
                          )}

                          {isTimeClosed ? (
                            <>
                              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/25 text-rose-200 border border-rose-400/50 whitespace-nowrap shrink-0">
                                🏁 투표 마감 · 개표 완료
                              </span>
                              {poll.expiresAt && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900/90 text-rose-300 border border-rose-500/40 whitespace-nowrap shrink-0">
                                  🕒 {closedTimeText}
                                </span>
                              )}
                            </>
                          ) : isPermanent ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 whitespace-nowrap shrink-0">
                              ♾️ 상시 운영 (기한 제한 없음)
                            </span>
                          ) : isFull ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap shrink-0">
                              정원 마감 (결과 열람 전용)
                            </span>
                          ) : null}

                          {isPhotoPollCandidates(poll.candidates) && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-200 border border-amber-400/45 whitespace-nowrap shrink-0">
                              🖼️ 포토 투표소
                            </span>
                          )}

                          {normalizeResultVisibility(poll.resultVisibility) === 'after_close' && !isTimeClosed && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-200 border border-amber-400/50 whitespace-nowrap shrink-0">
                              🔒 마감 후 공개
                            </span>
                          )}
                        </div>

                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>

                      {/* Full-Width Title & Description (Never truncated) */}
                      <div className="w-full space-y-1">
                        <h3 className="text-xs sm:text-sm font-bold text-white whitespace-normal break-keep break-words leading-snug">
                          {poll.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 whitespace-normal break-keep break-words leading-snug">
                          {poll.description}
                        </p>
                      </div>

                      {/* Photo Poll Full Preview Grid (4-item polls: balanced 4x1, 8-item polls: 4x2 mobile / 8x1 desktop) */}
                      {isPhotoPollCandidates(poll.candidates) && (
                        <div
                          className={
                            poll.candidates.length <= 4
                              ? 'grid grid-cols-4 gap-2 pt-1'
                              : 'grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1'
                          }
                        >
                          {poll.candidates.map((cand) => {
                            const getShortLabel = (title: string): string => {
                              if (title.includes('김치찌개')) return '김치찌개';
                              if (title.includes('돈가스') || title.includes('돈까스')) return '돈가스';
                              if (title.includes('연어') && title.includes('포케')) return '연어포케';
                              if (title.includes('국밥')) return '국밥';
                              if (title.includes('삼겹살')) return '삼겹살';
                              if (title.includes('치킨') || title.includes('치맥')) return '치맥';
                              if (title.includes('모듬회')) return '모듬회';
                              if (title.includes('스테이크')) return '스테이크';
                              return title.split('(')[0].trim() || title;
                            };
                            const shortLabel = getShortLabel(cand.title);
                            return (
                              <div
                                key={cand.id}
                                title={cand.title}
                                className="flex flex-col items-center gap-1 min-w-0"
                              >
                                <CandidateThumbnail
                                  candidate={cand}
                                  className="aspect-square w-full rounded-lg overflow-hidden border border-slate-600/80"
                                />
                                <span
                                  className={`${
                                    poll.candidates.length <= 4
                                      ? 'text-[10.5px] sm:text-xs font-bold text-slate-200'
                                      : 'text-[9.5px] sm:text-[10px] font-semibold text-slate-300'
                                  } leading-tight text-center whitespace-normal break-keep w-full`}
                                >
                                  {shortLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Meta Stats + Action Buttons (Responsive Wrap) */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-0.5">
                        <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold whitespace-nowrap shrink-0">
                            <span>🟢 현재 접속 {liveCount}명</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-200 font-bold whitespace-nowrap shrink-0">
                            <span>🗳️ {poll.isOfficial ? voterDetailText : `누적 투표 ${totalVotes}명`}</span>
                          </span>
                          {!poll.isOfficial && (
                            <span className="text-slate-400 whitespace-nowrap shrink-0">{voterDetailText}</span>
                          )}
                          {!isPermanent && (
                            <span
                              className={`flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 ${
                                isTimeClosed ? 'text-rose-300' : 'text-amber-300/90'
                              }`}
                            >
                              <Clock className="w-3 h-3 shrink-0" />
                              <span>
                                {isTimeClosed
                                  ? closedTimeText
                                  : poll.expiresAt
                                  ? `${remainingTimeStr} (${formatScheduledDeadlineKorean(poll.expiresAt)})`
                                  : remainingTimeStr}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                          {onOpenResultsDirect && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                sounds.playClick();
                                onOpenResultsDirect(poll);
                              }}
                              title="개표결과 및 방명록 바로보기"
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap shrink-0 transition cursor-pointer border ${
                                isTimeClosed
                                  ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white shadow-sm'
                                  : 'bg-slate-700/80 hover:bg-sky-600 border-slate-600 text-slate-200 hover:text-white'
                              }`}
                            >
                              <BarChart3 className="w-3 h-3 shrink-0" />
                              <span>
                                {normalizeResultVisibility(poll.resultVisibility) === 'after_close' && !isTimeClosed
                                  ? '🔒 봉인 현황 · 방명록'
                                  : '개표결과 바로보기'}
                              </span>
                            </button>
                          )}

                          {poll.isCustom && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sounds.playClick();
                                  setAdminAuthModal({ type: 'edit', poll });
                                  setAdminPinInput('');
                                  setAdminPinError(null);
                                }}
                                title="개설자 관리 비밀번호로 수정"
                                className="p-1.5 rounded-lg bg-slate-700/70 hover:bg-sky-600 text-slate-300 hover:text-white transition cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sounds.playClick();
                                  setAdminAuthModal({ type: 'delete', poll });
                                  setAdminPinInput('');
                                  setAdminPinError(null);
                                }}
                                title="개설자 관리 비밀번호로 삭제"
                                className="p-1.5 rounded-lg bg-slate-700/70 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={(e) => handleCopyLink(poll.id, e)}
                            title="투표소 공유 링크 복사"
                            className="p-1.5 rounded-lg bg-slate-700/70 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Closed Poll Final Winner Summary Box + Official Docs PNG Trigger */}
                      {isTimeClosed && (
                        <div className="mt-1 px-2.5 py-2 rounded-lg bg-slate-900/85 border border-emerald-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-start gap-1.5 text-[11px] min-w-0">
                            <Award className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 min-w-0">
                              {winnerSummary.hasVotes ? (
                                <span className="text-emerald-300 font-bold whitespace-normal break-keep break-words leading-snug block">
                                  최종 결과 · {winnerSummary.summaryText}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-semibold whitespace-normal break-keep break-words leading-snug block">
                                  최종 결과 · 투표 없음 (0표)
                                </span>
                              )}
                              {poll.expiresAt && (
                                <span className="text-[10px] text-rose-300/90 font-semibold block">
                                  🕒 {closedTimeText}
                                </span>
                              )}
                            </div>
                          </div>
                          {onOpenResultsDirect ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                sounds.playClick();
                                onOpenResultsDirect(poll, true);
                              }}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-[10px] font-bold whitespace-nowrap transition cursor-pointer shrink-0 self-end sm:self-auto"
                            >
                              <Trophy className="w-3 h-3 text-amber-300 shrink-0" />
                              <span>당선증·공고문 저장</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 shrink-0">
                              후보 {poll.candidates.length}개
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}

          {/* Tab 2: Private Poll Code Entrance */}
          {activeTab === 'private' && (
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
              <form onSubmit={handleJoinPrivate} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-200">
                    모임 전용 비공개 투표소 입장
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  개설자에게 전달받은 4자리 참여 입장 코드를 입력하세요.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={4}
                    value={privateCode}
                    onChange={(e) => setPrivateCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="4자리 숫자 코드 입력 (예: 1234)"
                    className="flex-1 px-3.5 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white font-mono text-sm tracking-widest focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                  >
                    코드 확인
                  </button>
                </div>

                {privateCodeError && (
                  <p className="text-xs text-rose-400 font-semibold">{privateCodeError}</p>
                )}

                {/* List of private polls */}
                <div className="pt-2 border-t border-slate-700/60">
                  <span className="text-[10px] text-slate-400 font-semibold">비공개 투표소 목록:</span>
                  <div className="mt-1 space-y-1">
                    {polls.filter((p) => p.category === 'private').length === 0 ? (
                      <p className="text-[11px] text-slate-500">등록된 비공개 투표소가 없습니다.</p>
                    ) : (
                      polls
                        .filter((p) => p.category === 'private')
                        .map((p) => {
                          const isUnlocked = unlockedPrivatePollIds.has(p.id);
                          const totalVotes = p.candidates.reduce((s, c) => s + (Number(c.votes) || 0), 0);
                          const liveCount = livePresenceCounts[p.id] || 0;
                          const maxCap = p.maxVoters || 100;
                          const isFull = totalVotes >= maxCap;
                          const isTimeClosed = isPollExpired(p);
                          const remainingStr = formatRemainingTime(p.expiresAt, isPollPermanent(p));
                          const closedTimeStr = formatClosedDateTimeKorean(p.expiresAt);
                          const winnerSummary = getPollWinnerSummary(p.candidates);

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                sounds.playClick();
                                setSelectedPollId(p.id);
                              }}
                              className={`px-3 py-3 sm:p-3 rounded-lg border text-xs cursor-pointer transition flex flex-col gap-2 ${
                                selectedPollId === p.id
                                  ? 'bg-amber-950/40 border-amber-400 text-amber-200'
                                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-start gap-2 w-full">
                                {isUnlocked ? (
                                  <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 space-y-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold whitespace-normal break-keep break-words leading-snug">
                                      {p.title}
                                    </span>
                                    {isPhotoPollCandidates(p.candidates) && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-200 border border-amber-400/45 whitespace-nowrap shrink-0">
                                        🖼️ 포토 투표소
                                      </span>
                                    )}
                                  </div>
                                  {isTimeClosed ? (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/25 text-rose-200 border border-rose-400/40 whitespace-nowrap shrink-0">
                                        🏁 투표 마감 · 개표 완료
                                      </span>
                                      {p.expiresAt && (
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/90 text-rose-300 border border-rose-500/35 whitespace-nowrap shrink-0">
                                          🕒 {closedTimeStr}
                                        </span>
                                      )}
                                    </div>
                                  ) : isFull ? (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap shrink-0">
                                      마감
                                    </span>
                                  ) : null}
                                  {normalizeResultVisibility(p.resultVisibility) === 'after_close' && !isTimeClosed && (
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-200 border border-amber-400/45 whitespace-nowrap shrink-0">
                                      🔒 마감 후 공개
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] text-emerald-300 font-bold whitespace-nowrap shrink-0">
                                    🟢 {liveCount}명
                                  </span>
                                  <span className="text-[10px] text-sky-300 font-bold whitespace-nowrap shrink-0">
                                    🗳️ {totalVotes}명
                                  </span>
                                  <span className={`text-[10px] whitespace-nowrap shrink-0 ${isTimeClosed ? 'text-rose-300 font-semibold' : 'text-amber-300/80'}`}>
                                    {isTimeClosed ? closedTimeStr : remainingStr}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {onOpenResultsDirect && isUnlocked && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sounds.playClick();
                                        onOpenResultsDirect(p);
                                      }}
                                      className="px-2 py-1 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                                    >
                                      결과보기
                                    </button>
                                  )}

                                  {p.isCustom && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          sounds.playClick();
                                          setAdminAuthModal({ type: 'edit', poll: p });
                                          setAdminPinInput('');
                                          setAdminPinError(null);
                                        }}
                                        title="개설자 관리 비밀번호로 수정"
                                        className="p-1 rounded bg-slate-700 hover:bg-sky-600 text-slate-300 hover:text-white transition"
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          sounds.playClick();
                                          setAdminAuthModal({ type: 'delete', poll: p });
                                          setAdminPinInput('');
                                          setAdminPinError(null);
                                        }}
                                        title="개설자 관리 비밀번호로 삭제"
                                        className="p-1 rounded bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white transition"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isTimeClosed && isUnlocked && (
                                <div className="px-2 py-1.5 rounded bg-slate-900/80 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="space-y-0.5 min-w-0">
                                    <span className="whitespace-normal break-keep break-words leading-snug block">
                                      🏆 {winnerSummary.summaryText} ({totalVotes}/{maxCap}명 참여)
                                    </span>
                                    {p.expiresAt && (
                                      <span className="text-[9.5px] text-rose-300/90 font-semibold block">
                                        🕒 {closedTimeStr}
                                      </span>
                                    )}
                                  </div>
                                  {onOpenResultsDirect && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        sounds.playClick();
                                        onOpenResultsDirect(p, true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 text-[9px] font-bold transition cursor-pointer whitespace-nowrap shrink-0 self-end sm:self-auto"
                                    >
                                      <Trophy className="w-2.5 h-2.5 shrink-0" />
                                      <span>당선증·공고문</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Create New Poll Station Form (5 One-Click Templates + Smart Party/Slogan Generator) */}
          {activeTab === 'create' && (
            <CreatePollModal
              onCreated={(createdPoll) => {
                setPolls((prev) => {
                  const next = [createdPoll, ...prev.filter((p) => p.id !== createdPoll.id)];
                  onPollsUpdated?.(next);
                  return next;
                });
                setSelectedPollId(createdPoll.id);
                if (createdPoll.category === 'private') {
                  setUnlockedPrivatePollIds((prev) => new Set(prev).add(createdPoll.id));
                }
                setActiveTab(createdPoll.category === 'private' ? 'private' : 'public');
              }}
              onPoliticalAlert={(detectedKeyword) => {
                setPoliticalAlertModal({ detectedKeyword });
              }}
            />
          )}
        </div>

        {/* 3. Avatar Choice Cards (Ultra-Slim 1-Row 6-Column Strip: Male 3 + Female 3) */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
              아바타 선택 (남 3 · 여 3)
            </label>
            <span className="text-[10px] sm:text-[11px] font-semibold text-rose-300 whitespace-nowrap">
              선택됨: {AVATAR_META[selectedAvatar].fullName}
              <span className="hidden sm:inline text-slate-400 font-normal">
                {' '}· {AVATAR_META[selectedAvatar].subtitle}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1 sm:gap-2 w-full">
            {AVATAR_TYPES.map((avatarId) => {
              const isSelected = selectedAvatar === avatarId;
              return (
                <button
                  key={avatarId}
                  type="button"
                  title={`${AVATAR_META[avatarId].fullName} (${AVATAR_META[avatarId].subtitle})`}
                  onClick={() => {
                    sounds.playClick();
                    setSelectedAvatar(avatarId);
                    try {
                      localStorage.setItem(AVATAR_STORAGE_KEY, avatarId);
                    } catch {
                      // ignore storage error
                    }
                  }}
                  className={`relative p-1 sm:p-1.5 rounded-xl flex flex-col items-center justify-center border text-center transition-all cursor-pointer active:scale-[0.97] min-w-0 ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/40 shadow-md shadow-rose-950/30'
                      : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 hover:border-slate-500'
                  }`}
                >
                  {isSelected && (
                    <span
                      className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm z-10"
                      aria-hidden="true"
                    >
                      <Check className="w-2 h-2 sm:w-2.5 sm:h-2.5 stroke-[3]" />
                    </span>
                  )}

                  <div
                    className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full overflow-hidden shrink-0 border-2 transition-transform ${
                      isSelected ? 'border-rose-400 scale-105' : 'border-slate-600/80'
                    }`}
                  >
                    <AvatarIllustration avatarType={avatarId} className="w-full h-full" />
                  </div>

                  <span
                    className={`text-[9px] sm:text-[11px] font-semibold tracking-tighter whitespace-nowrap mt-0.5 leading-tight ${
                      isSelected ? 'text-white font-bold' : 'text-slate-300'
                    }`}
                  >
                    {COMPACT_AVATAR_LABELS[avatarId]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Enter Button */}
        <button
          type="button"
          onClick={handleFinalEnter}
          className={`w-full flex items-center justify-center gap-2 py-3 sm:py-3.5 px-6 rounded-xl text-white font-bold text-sm sm:text-base shadow-xl active:scale-[0.98] transition cursor-pointer ${
            isPollExpired(selectedPoll)
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 shadow-emerald-500/25'
              : 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 shadow-blue-500/25'
          }`}
        >
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span>
            {isSelectedPrivateLocked
              ? '비공개 투표소 입장 (4자리 코드 필요 🔒)'
              : isPollExpired(selectedPoll)
              ? '개표 참관 모드로 입장하기 🏁'
              : isSelectedPollFull
              ? '투표소 입장하기 (정원 마감: 결과 열람 모드)'
              : '선택한 투표소 입장하기'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Selected Poll indicator footer */}
        <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-slate-400 px-1 gap-1.5">
          <div className="flex items-start gap-1.5 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span className="whitespace-normal break-keep break-words leading-snug">
              입장 안건: <strong className="text-slate-200">{selectedPoll.title}</strong>
              <span className="ml-1.5 text-emerald-400 font-semibold inline-block">
                (🟢 현재 접속 {selectedLiveCount}명 ·{' '}
                {selectedPoll.isOfficial
                  ? selectedPollChannelLabel
                  : `🗳️ 누적 ${selectedPollDisplayTotal}명 / ${selectedPollCapacity}명`}
                )
              </span>
              {selectedPoll.category === 'private' && (
                <span className={`ml-1 font-bold inline-block ${isSelectedPrivateLocked ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isSelectedPrivateLocked ? '[비공개: 잠김]' : '[인증완료]'}
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => handleCopyLink(selectedPoll.id, e)}
            className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold whitespace-nowrap shrink-0 cursor-pointer self-end sm:self-auto"
          >
            <Copy className="w-3 h-3 shrink-0" />
            <span>{copiedId === selectedPoll.id ? '링크 복사됨!' : '공유 링크 복사'}</span>
          </button>
        </div>

        {/* Beta Service & Non-Election Disclaimer Box */}
        <div className="mt-3 p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            {BETA_DISCLAIMER_TEXT}
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* Admin PIN Verification Modal (for Edit / Delete)          */}
      {/* ======================================================== */}
      {adminAuthModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100">
            <button
              onClick={() => {
                setAdminAuthModal(null);
                setAdminPinInput('');
                setAdminPinError(null);
              }}
              className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className={`p-2 rounded-xl ${adminAuthModal.type === 'delete' ? 'bg-rose-500/20 text-rose-400' : 'bg-sky-500/20 text-sky-400'}`}>
                {adminAuthModal.type === 'delete' ? <Trash2 className="w-5 h-5" /> : <Pencil className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {adminAuthModal.type === 'delete' ? '투표소 삭제 확인' : '투표소 수정 권한 확인'}
                </h3>
                <p className="text-[11px] text-slate-400 whitespace-normal break-keep break-words leading-snug">
                  {adminAuthModal.poll.title}
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminPinSubmit} className="space-y-3">
              <p className="text-xs text-slate-300">
                개설 시 설정했던 <strong>개설자 관리 비밀번호(4자리)</strong>를 입력하세요.
              </p>

              <div>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  required
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="관리 비밀번호 4자리"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded-lg text-center font-mono text-base font-bold text-white tracking-widest focus:outline-none focus:border-sky-500"
                />
                {adminPinError && (
                  <p className="text-[11px] text-rose-400 font-semibold mt-1">{adminPinError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdminAuthModal(null);
                    setAdminPinInput('');
                    setAdminPinError(null);
                  }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 font-bold text-xs rounded-lg transition cursor-pointer text-white ${
                    adminAuthModal.type === 'delete' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-sky-600 hover:bg-sky-500'
                  }`}
                >
                  {adminAuthModal.type === 'delete' ? '삭제 확인' : '수정창 열기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Edit Poll Modal Form                                      */}
      {/* ======================================================== */}
      {editingPoll && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl text-slate-100 my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingPoll(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Pencil className="w-5 h-5 text-sky-400" />
              <h2 className="text-base sm:text-lg font-bold text-white">투표소 안건 내용 수정</h2>
            </div>

            {/* Real-time Political Keyword Warning Banner */}
            {(editPoliticalCheck.hasForbidden || editError) && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  {editPoliticalCheck.hasForbidden
                    ? `⚠️ 민감한 정치인 성명 또는 정치 키워드('${editPoliticalCheck.keyword}')는 사용할 수 없습니다. 일상·모임 주제로 작성해 주세요.`
                    : editError}
                </span>
              </div>
            )}

            <form onSubmit={handleEditPollSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  안건 제목 *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  안건 상세 설명
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Max Voters */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-2.5 flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-300">
                  최대 참여 인원 (2~100명)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={editMaxVoters}
                    onChange={(e) => setEditMaxVoters(Math.max(2, Math.min(100, Number(e.target.value) || 2)))}
                    className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-center text-xs font-bold text-emerald-400"
                  />
                  <span className="text-xs text-slate-400">명</span>
                </div>
              </div>

              {/* Duration / Deadline Selection with Live Preview */}
              <PollDurationSelector
                durationHours={editDurationHours}
                existingExpiresAt={editingPoll.expiresAt}
                isModified={editDurationTouched}
                onChange={(hrs) => {
                  setEditDurationHours(hrs);
                  setEditDurationTouched(true);
                }}
                onResetToExisting={() => {
                  setEditDurationHours(editingPoll.durationHours || 24);
                  setEditDurationTouched(false);
                }}
              />

              {/* Result Visibility Selection */}
              <ResultVisibilitySelector
                value={editResultVisibility}
                onChange={setEditResultVisibility}
              />

              {/* Choices (2 to 10) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-bold text-slate-300">
                    후보 선택지 목록 ({editChoices.length}/10)
                  </label>
                  {editChoices.length < 10 ? (
                    <button
                      type="button"
                      onClick={handleAddEditChoice}
                      className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold cursor-pointer active:scale-95 transition"
                    >
                      <Plus className="w-3 h-3" /> 선택지 추가
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">최대 10개까지 등록할 수 있습니다</span>
                  )}
                </div>
                <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5">
                  {editChoices.map((c, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center">
                      <span className="w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={c.title}
                        onChange={(e) => {
                          const updated = [...editChoices];
                          updated[idx].title = e.target.value;
                          setEditChoices(updated);
                        }}
                        className="flex-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-white text-xs"
                      />
                      <input
                        type="text"
                        value={c.subtitle}
                        onChange={(e) => {
                          const updated = [...editChoices];
                          updated[idx].subtitle = e.target.value;
                          setEditChoices(updated);
                        }}
                        placeholder="상세 설명"
                        className="flex-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 text-xs hidden sm:block"
                      />
                      {editChoices.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEditChoice(idx)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="선택지 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning above button if forbidden keyword detected */}
              {editPoliticalCheck.hasForbidden && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-300 text-[11px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>민감한 정치인 성명 또는 정치 키워드('{editPoliticalCheck.keyword}')가 포함되어 있어 저장할 수 없습니다.</span>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPoll(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={editPoliticalCheck.hasForbidden || !editTitle.trim()}
                  className={`flex-1 py-2 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 ${
                    editPoliticalCheck.hasForbidden || !editTitle.trim()
                      ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-80'
                      : 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-md active:scale-98'
                  }`}
                >
                  {editPoliticalCheck.hasForbidden
                    ? `수정 불가 ('${editPoliticalCheck.keyword}')`
                    : '수정 내용 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Participant Access Code Prompt Modal (Locked Room)       */}
      {/* ======================================================== */}
      {accessCodeModalPoll && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-sm bg-slate-900 border border-amber-500/50 rounded-2xl p-5 shadow-2xl text-slate-100">
            <button
              onClick={() => {
                setAccessCodeModalPoll(null);
                setAccessCodeInput('');
                setAccessCodeModalError(null);
              }}
              className="absolute top-3.5 right-3.5 p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">비공개 투표소 입장 코드</h3>
                <p className="text-[11px] text-slate-400 whitespace-normal break-keep break-words leading-snug">
                  {accessCodeModalPoll.title}
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyAccessCodeSubmit} className="space-y-3">
              <p className="text-xs text-slate-300">
                본 투표소는 비공개 모임 전용입니다. 개설자에게 전달받은 <strong>참여 입장 코드 (4자리 숫자)</strong>를 입력해주세요.
              </p>

              <div>
                <input
                  type="text"
                  maxLength={4}
                  autoFocus
                  required
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="4자리 숫자 입력"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-600 rounded-lg text-center font-mono text-base font-bold text-amber-300 tracking-widest focus:outline-none focus:border-amber-400"
                />
                {accessCodeModalError && (
                  <p className="text-[11px] text-rose-400 font-semibold mt-1">{accessCodeModalError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessCodeModalPoll(null);
                    setAccessCodeInput('');
                    setAccessCodeModalError(null);
                  }}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  입장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* Political Keyword Alert Popup Modal                      */}
      {/* ======================================================== */}
      {politicalAlertModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border-2 border-rose-500/70 rounded-2xl p-6 shadow-2xl text-slate-100 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <AlertTriangle className="w-7 h-7 text-rose-400" />
            </div>

            <h3 className="text-base sm:text-lg font-black text-white mb-2">
              정치인 성명 및 선거 키워드 사용 제한 안내
            </h3>

            <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl mb-4 text-left space-y-1.5">
              <p className="text-xs font-bold text-rose-200">
                정치적 중립 및 일상 모의투표 목적에 맞지 않는 단어가 포함되어 있습니다.
              </p>
              <p className="text-xs text-slate-300">
                감지된 금칙어:{' '}
                <strong className="text-rose-400 font-mono bg-rose-900/50 px-1.5 py-0.5 rounded">
                  '{politicalAlertModal.detectedKeyword}'
                </strong>
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              ※ [BETA] 본 서비스는 점심 메뉴, 회식 장소, 동아리 취향 조사 등 일상 속 건전한 의사결정 및 투표 절차 체험을 위한 시스템입니다. 민감한 정치인 성명 및 정치·선거 관련 주제는 개설하거나 수정할 수 없습니다.
            </p>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setPoliticalAlertModal(null);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition cursor-pointer active:scale-98"
            >
              확인 및 내용 수정하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
