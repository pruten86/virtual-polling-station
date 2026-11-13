import React, { useState, useEffect, useMemo } from 'react';
import { AvatarType, PollStation, Candidate } from '../types';
import { sounds } from '../sound';
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
  getActiveOfficialChannel,
  formatRemainingTime,
} from '../data/presetPolls';
import {
  fetchVoteversePolls,
  createVoteversePoll,
} from '../lib/voteverseBackend';
import {
  UserCheck,
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
  Sliders,
  Clock,
  Layers,
  KeyRound,
  Pencil,
  X,
} from 'lucide-react';

interface AvatarSelectModalProps {
  initialPollId?: string | null;
  onEnter: (nickname: string, avatarType: AvatarType, selectedPoll: PollStation) => void;
}

const DURATION_OPTIONS = [
  { hours: 1, label: '1시간' },
  { hours: 3, label: '3시간' },
  { hours: 6, label: '6시간' },
  { hours: 12, label: '12시간' },
  { hours: 24, label: '24시간' },
];

export const AvatarSelectModal: React.FC<AvatarSelectModalProps> = ({
  initialPollId,
  onEnter,
}) => {
  // 1. Nickname state with auto-generation
  const [nickname, setNickname] = useState<string>(() => generateRandomNickname());
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>('male');

  // 2. Polls & Tabs
  const [polls, setPolls] = useState<PollStation[]>(() => getAllPolls());
  const [activeTab, setActiveTab] = useState<'public' | 'private' | 'create'>('public');

  // Set of unlocked private poll IDs
  const [unlockedPrivatePollIds, setUnlockedPrivatePollIds] = useState<Set<string>>(() => new Set());

  // Periodic tick for live countdown timer & auto-purge of expired polls
  const [, setTick] = useState<number>(0);
  useEffect(() => {
    // Initial fetch from Supabase (category <> 'private')
    fetchVoteversePolls().then((fetched) => {
      if (fetched && fetched.length > 0) {
        setPolls(fetched);
      }
    });

    const timer = setInterval(() => {
      setTick((t) => t + 1);
      const now = Date.now();
      setPolls((prev) => prev.filter((p) => !p.expiresAt || p.expiresAt > now));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Selected Poll
  const [selectedPollId, setSelectedPollId] = useState<string>(() => {
    if (initialPollId) {
      const match = getAllPolls().find((p) => p.id === initialPollId);
      if (match) return match.id;
    }
    return 'poll-lunch';
  });

  // Private Code Tab Input
  const [privateCode, setPrivateCode] = useState<string>('');
  const [privateCodeError, setPrivateCodeError] = useState<string | null>(null);

  // Create New Poll Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPrivateCreate, setIsPrivateCreate] = useState(false);
  const [newPasscode, setNewPasscode] = useState(''); // Participant Access Code (4 digits)
  const [newAdminPin, setNewAdminPin] = useState(''); // Creator Admin PIN (4 digits)
  const [newMaxVoters, setNewMaxVoters] = useState<number>(100);
  const [selectedDurationHours, setSelectedDurationHours] = useState<number>(24);
  const [forbiddenKeywordError, setForbiddenKeywordError] = useState<string | null>(null);

  const [newChoices, setNewChoices] = useState<Array<{ title: string; subtitle: string; party: string }>>([
    { title: '선택지 1', subtitle: '첫 번째 대안', party: '기호 1번' },
    { title: '선택지 2', subtitle: '두 번째 대안', party: '기호 2번' },
    { title: '선택지 3', subtitle: '세 번째 대안', party: '기호 3번' },
  ]);

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

  // Real-time Political Keyword Validation for Create Form
  const createPoliticalCheck = useMemo(() => {
    const textsToCheck = [
      newTitle,
      newDesc,
      ...newChoices.map((c) => `${c.title} ${c.party} ${c.subtitle}`),
    ];
    return checkPoliticalContent(textsToCheck);
  }, [newTitle, newDesc, newChoices]);

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

  // Add choice in creation form (up to 10)
  const handleAddChoice = () => {
    if (newChoices.length >= 10) return;
    sounds.playClick();
    const nextNum = newChoices.length + 1;
    setNewChoices([...newChoices, { title: `선택지 ${nextNum}`, subtitle: `상세 설명`, party: `기호 ${nextNum}번` }]);
  };

  // Remove choice (minimum 2)
  const handleRemoveChoice = (idx: number) => {
    if (newChoices.length <= 2) return;
    sounds.playClick();
    setNewChoices(newChoices.filter((_, i) => i !== idx));
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

  // Handle Create Poll Submission with Admin PIN, Political Filter, Max Voters & Timer
  const handleCreatePollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForbiddenKeywordError(null);

    if (!newTitle.trim()) return;

    // Check creator Admin PIN (must be 4 digits)
    const cleanAdminPin = newAdminPin.trim();
    if (!/^\d{4}$/.test(cleanAdminPin)) {
      sounds.playClick();
      setForbiddenKeywordError('개설자 관리 비밀번호 4자리(숫자)를 정확히 입력해주세요.');
      return;
    }

    // Check participant access code if private
    if (isPrivateCreate) {
      const cleanPasscode = newPasscode.trim();
      if (!/^\d{4}$/.test(cleanPasscode)) {
        sounds.playClick();
        setForbiddenKeywordError('참여자용 4자리 비밀 입장코드를 정확히 입력해주세요.');
        return;
      }
    }

    // Political and Real Election Keyword Check
    if (createPoliticalCheck.hasForbidden) {
      sounds.playClick();
      setForbiddenKeywordError(
        `⚠️ 민감한 정치인 성명 또는 정치 키워드('${createPoliticalCheck.keyword}')는 사용할 수 없습니다. 일상·모임 주제로 작성해 주세요.`
      );
      setPoliticalAlertModal({
        detectedKeyword: createPoliticalCheck.keyword || '정치·선거',
      });
      return;
    }

    sounds.playClick();
    const newId = `custom-${Date.now().toString(36)}`;
    const colors = ['rose', 'blue', 'emerald', 'amber', 'purple', 'indigo', 'teal', 'orange', 'cyan', 'pink'];
    const hexes = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1', '#14b8a6', '#f97316', '#06b6d4', '#ec4899'];

    const formattedCandidates: Candidate[] = newChoices.map((c, idx) => ({
      id: `${newId}-c${idx + 1}`,
      symbolNumber: idx + 1,
      party: c.party.trim() || `기호 ${idx + 1}번`,
      title: c.title.trim() || `후보 ${idx + 1}`,
      subtitle: c.subtitle.trim() || '선택지 설명',
      badgeColor: colors[idx % colors.length],
      accentBg: hexes[idx % hexes.length],
      description: c.subtitle.trim() || '',
      votes: 0,
    }));

    const finalCapacity = Math.max(2, Math.min(100, Number(newMaxVoters) || 100));
    const expiresAt = Date.now() + selectedDurationHours * 3600 * 1000;

    const createdPoll: PollStation = {
      id: newId,
      title: newTitle.trim(),
      description: newDesc.trim() || '참여형 자유 투표 안건',
      category: isPrivateCreate ? 'private' : 'public',
      accessCode: isPrivateCreate ? newPasscode.trim() : undefined,
      adminPin: cleanAdminPin,
      maxVoters: finalCapacity,
      candidates: formattedCandidates,
      createdAt: new Date().toISOString().split('T')[0],
      isCustom: true,
      durationHours: selectedDurationHours,
      expiresAt,
    };

    const res = await createVoteversePoll(createdPoll);
    if (!res.success) {
      sounds.playWarning();
      setForbiddenKeywordError(res.error || '투표소 DB 저장에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    setPolls((prev) => [createdPoll, ...prev.filter((p) => p.id !== createdPoll.id)]);
    setSelectedPollId(createdPoll.id);

    // Creator is automatically authorized for their own newly created private room
    if (isPrivateCreate) {
      setUnlockedPrivatePollIds((prev) => new Set(prev).add(createdPoll.id));
    }

    setActiveTab(isPrivateCreate ? 'private' : 'public');

    // Reset create fields
    setNewTitle('');
    setNewDesc('');
    setIsPrivateCreate(false);
    setNewPasscode('');
    setNewAdminPin('');
    setNewMaxVoters(100);
    setSelectedDurationHours(24);
    setForbiddenKeywordError(null);
  };

  // Join private poll with participant code
  const handleJoinPrivate = (e: React.FormEvent) => {
    e.preventDefault();
    setPrivateCodeError(null);
    const code = privateCode.trim();
    if (!code) {
      setPrivateCodeError('4자리 코드를 입력해주세요.');
      return;
    }

    const matched = polls.find(
      (p) => p.category === 'private' && (p.accessCode === code || p.id === code)
    );

    if (matched) {
      sounds.playClick();
      setUnlockedPrivatePollIds((prev) => new Set(prev).add(matched.id));
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

    const inputPin = adminPinInput.trim();
    const correctPin = adminAuthModal.poll.adminPin;

    if (!correctPin || inputPin === correctPin) {
      sounds.playClick();
      const targetPoll = adminAuthModal.poll;

      if (adminAuthModal.type === 'delete') {
        deletePollAsync(targetPoll.id);
        const updatedPolls = getAllPolls();
        setPolls(updatedPolls);
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
      };
    });

    const updatedPoll: PollStation = {
      ...editingPoll,
      title: editTitle.trim(),
      description: editDesc.trim(),
      maxVoters: Math.max(2, Math.min(100, Number(editMaxVoters) || 100)),
      durationHours: editDurationHours,
      candidates: updatedCandidates,
    };

    savePollAsync(updatedPoll);
    setPolls(getAllPolls());
    setEditingPoll(null);
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

  if (selectedPoll.isOfficial) {
    const chInfo = getActiveOfficialChannel(selectedPoll.id, selectedPoll.candidates);
    selectedPollDisplayTotal = chInfo.totalCumulativeVotes;
    selectedPollChannelLabel = `제${chInfo.activeChannelIndex}투표소 • ${chInfo.channelVotes} / 100명 (누적 ${chInfo.totalCumulativeVotes}명)`;
    isSelectedPollFull = false;
  } else {
    selectedPollDisplayTotal = selectedPoll.candidates.reduce((s, c) => s + c.votes, 0);
    selectedPollCapacity = selectedPoll.maxVoters || 100;
    isSelectedPollFull = selectedPollDisplayTotal >= selectedPollCapacity;
  }

  const isSelectedPrivateLocked =
    selectedPoll.category === 'private' && !unlockedPrivatePollIds.has(selectedPoll.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-7 text-slate-100 my-auto">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400 mb-2 shadow-inner">
            <UserCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            3D 가상 투표소 로비 & 아바타 선택
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            원하는 투표 안건을 선택하고 나만의 유권자 아바타로 입장하세요.
          </p>
        </div>

        {/* 1. Voter Nickname Input with 🎲 Random Button */}
        <div className="mb-5 bg-slate-800/60 border border-slate-700/70 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>선거인 닉네임 (성명)</span>
              <span className="text-[10px] text-sky-400 font-normal">자동 생성 또는 직접 수정</span>
            </label>
            <button
              type="button"
              onClick={handleRollNickname}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition active:scale-95 cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5 text-sky-300" />
              <span>랜덤 닉네임 뽑기</span>
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={nickname}
              maxLength={32}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 배고픈 위원장 #402"
              className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-600 rounded-lg text-white font-semibold text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
            />
          </div>
        </div>

        {/* 2. Polling Stations Lobby Tabs */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Vote className="w-4 h-4 text-emerald-400" />
              <span>참여할 투표소 선택</span>
            </label>
            <span className="text-[11px] text-slate-400">
              현재 선택: <strong className="text-white truncate max-w-[140px] inline-block align-bottom">{selectedPoll.title}</strong>
            </span>
          </div>

          {/* Tab Buttons */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-800/80 p-1 rounded-xl mb-3 border border-slate-700/80">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('public');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'public'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>열린 광장</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('private');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'private'
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>코드 입장</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('create');
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ 새 투표소</span>
            </button>
          </div>

          {/* Tab 1: Public Polls List */}
          {activeTab === 'public' && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {polls
                .filter((p) => p.category !== 'private')
                .map((poll) => {
                  const isSelected = selectedPollId === poll.id;
                  const isCopied = copiedId === poll.id;

                  let channelBadge = '';
                  let voterInfoText = '';
                  let isFull = false;

                  if (poll.isOfficial) {
                    const chData = getActiveOfficialChannel(poll.id, poll.candidates);
                    channelBadge = `제${chData.activeChannelIndex}투표소`;
                    voterInfoText = `${channelBadge} • ${chData.channelVotes} / 100명 (누적 ${chData.totalCumulativeVotes}명)`;
                    isFull = false;
                  } else {
                    const totalVotes = poll.candidates.reduce((s, c) => s + c.votes, 0);
                    const maxCap = poll.maxVoters || 100;
                    isFull = totalVotes >= maxCap;
                    voterInfoText = `참여: ${totalVotes} / ${maxCap}명`;
                  }

                  const remainingTimeStr = formatRemainingTime(poll.expiresAt);

                  return (
                    <div
                      key={poll.id}
                      onClick={() => {
                        sounds.playClick();
                        setSelectedPollId(poll.id);
                      }}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-950/60 border-sky-400 ring-1 ring-sky-400/40 shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          {poll.isOfficial ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 flex items-center gap-1">
                              <Layers className="w-3 h-3 text-sky-400" />
                              <span>공식 채널형 ({channelBadge})</span>
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                              사용자 개설
                            </span>
                          )}

                          {isFull && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              정원 마감 (결과 열람 전용)
                            </span>
                          )}

                          <span className="text-xs font-bold text-white truncate">{poll.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{poll.description}</p>
                        <div className="flex items-center gap-2.5 mt-1 text-[10px] text-slate-400 flex-wrap">
                          <span>후보 {poll.candidates.length}개</span>
                          <span>•</span>
                          <span className={isFull ? 'text-rose-400 font-bold' : 'text-slate-300 font-medium'}>
                            {voterInfoText}
                          </span>
                          <span>•</span>
                          <span className="text-amber-300/90 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{remainingTimeStr}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Custom Poll Edit & Delete Buttons */}
                        {poll.isCustom && (
                          <div className="flex items-center gap-1 mr-1">
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

                        {/* Copy Link Button */}
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

                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-sky-400 bg-sky-500 text-white' : 'border-slate-600'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
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
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
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
                          const totalVotes = p.candidates.reduce((s, c) => s + c.votes, 0);
                          const maxCap = p.maxVoters || 100;
                          const isFull = totalVotes >= maxCap;
                          const remainingStr = formatRemainingTime(p.expiresAt);

                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                sounds.playClick();
                                setSelectedPollId(p.id);
                              }}
                              className={`p-2.5 rounded-lg border text-xs flex justify-between items-center cursor-pointer transition ${
                                selectedPollId === p.id
                                  ? 'bg-amber-950/40 border-amber-400 text-amber-200'
                                  : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate flex-1 pr-2">
                                {isUnlocked ? (
                                  <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                )}
                                <span className="truncate font-semibold">{p.title}</span>
                                {isFull && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    마감
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-amber-300/80">
                                  {remainingStr}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {totalVotes}/{maxCap}명
                                </span>

                                {/* Creator Admin Action Buttons */}
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
                          );
                        })
                    )}
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Create New Poll Station Form */}
          {activeTab === 'create' && (
            <form
              onSubmit={handleCreatePollSubmit}
              className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-3 max-h-64 overflow-y-auto"
            >
              {/* Forbidden Political Keyword Real-time Warning Banner */}
              {(createPoliticalCheck.hasForbidden || forbiddenKeywordError) && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs font-semibold animate-in fade-in duration-150">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    {createPoliticalCheck.hasForbidden
                      ? `⚠️ 민감한 정치인 성명 또는 정치 키워드('${createPoliticalCheck.keyword}')는 사용할 수 없습니다. 일상·모임 주제로 작성해 주세요.`
                      : forbiddenKeywordError}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  새 안건 제목 *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="예: 금요일 조기 퇴근 vs 자율 출퇴근제"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  안건 상세 설명
                </label>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="예: 이번 분기 팀 조직문화 개선을 위한 모의투표"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* 1. Creator Admin PIN setting (4 digits - mandatory) */}
              <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                    <span>개설자 관리 비밀번호 (숫자 4자리) *</span>
                  </label>
                  <span className="text-[10px] text-amber-400 font-bold">수정/삭제 권한 보호</span>
                </div>
                <input
                  type="password"
                  required
                  maxLength={4}
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="개설자 전용 4자리 숫자 (예: 1234)"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-white font-mono text-xs tracking-widest focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-slate-400">
                  ※ 투표소를 개설한 본인이 나중에 안건 내용을 수정하거나 즉시 삭제할 때 확인하는 비밀번호입니다.
                </p>
              </div>

              {/* 2. Maximum Voters Capacity Setting (2 to 100) */}
              <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                    <span>최대 참여 인원 (정원 설정)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={2}
                      max={100}
                      value={newMaxVoters}
                      onChange={(e) => {
                        const val = Math.max(2, Math.min(100, Number(e.target.value) || 2));
                        setNewMaxVoters(val);
                      }}
                      className="w-14 px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-center text-xs font-bold text-emerald-400"
                    />
                    <span className="text-xs text-slate-400 font-semibold">명</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={2}
                    max={100}
                    value={newMaxVoters}
                    onChange={(e) => setNewMaxVoters(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Quick Capacity Buttons */}
                <div className="flex gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 self-center mr-1">빠른 선택:</span>
                  {[10, 30, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNewMaxVoters(num)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                        newMaxVoters === num
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {num}명
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Duration / Timer Selection (5 Steps: 1h, 3h, 6h, 12h, 24h) */}
              <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>투표소 유지 시간 (만료 시 자동 삭제)</span>
                  </label>
                  <span className="text-xs font-bold text-amber-400">{selectedDurationHours}시간</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 pt-1">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.hours}
                      type="button"
                      onClick={() => setSelectedDurationHours(opt.hours)}
                      className={`py-1 rounded text-center text-xs font-bold transition cursor-pointer border ${
                        selectedDurationHours === opt.hours
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  설정한 시간이 지나면 투표소가 자동으로 마감 및 삭제되어 목록에서 정리됩니다.
                </p>
              </div>

              {/* Choices (2 to 10) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-300">
                    후보 선택지 ({newChoices.length}/10)
                  </label>
                  {newChoices.length < 10 ? (
                    <button
                      type="button"
                      onClick={handleAddChoice}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer active:scale-95 transition"
                    >
                      <Plus className="w-3 h-3" /> 선택지 추가
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">최대 10개까지 등록할 수 있습니다</span>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5">
                  {newChoices.map((choice, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center">
                      <span className="w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0 text-slate-300">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        required
                        value={choice.title}
                        onChange={(e) => {
                          const updated = [...newChoices];
                          updated[idx].title = e.target.value;
                          setNewChoices(updated);
                        }}
                        placeholder={`선택지 ${idx + 1} 제목`}
                        className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-md text-white text-xs"
                      />
                      <input
                        type="text"
                        value={choice.subtitle}
                        onChange={(e) => {
                          const updated = [...newChoices];
                          updated[idx].subtitle = e.target.value;
                          setNewChoices(updated);
                        }}
                        placeholder="상세 설명"
                        className="flex-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-md text-slate-300 text-xs hidden sm:block"
                      />
                      {newChoices.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveChoice(idx)}
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

              {/* Private Code Option Toggle */}
              <div className="pt-2 border-t border-slate-700/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-semibold">
                    <input
                      type="checkbox"
                      checked={isPrivateCreate}
                      onChange={(e) => setIsPrivateCreate(e.target.checked)}
                      className="rounded text-emerald-500"
                    />
                    <span>비공개 투표소 (참여자 4자리 입장코드 필요)</span>
                  </label>

                  {isPrivateCreate && (
                    <input
                      type="text"
                      maxLength={4}
                      required
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                      placeholder="입장코드 (예: 7788)"
                      className="w-28 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-center text-xs font-mono font-bold text-amber-300 tracking-widest"
                    />
                  )}
                </div>
                {isPrivateCreate && (
                  <p className="text-[10px] text-amber-300/80">
                    ※ 참여 입장코드는 참가자들에게 전달하는 번호이며, 안건 수정/삭제 비밀번호(관리 PIN)와 분리 운영됩니다.
                  </p>
                )}
              </div>

              {/* Warning above button if forbidden keyword detected */}
              {createPoliticalCheck.hasForbidden && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-rose-950/80 border border-rose-500/60 text-rose-300 text-[11px] font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>민감한 정치인 성명 또는 정치 키워드('{createPoliticalCheck.keyword}')가 포함되어 있어 개설할 수 없습니다.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={createPoliticalCheck.hasForbidden || !newTitle.trim()}
                className={`w-full py-2.5 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 ${
                  createPoliticalCheck.hasForbidden || !newTitle.trim()
                    ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-80'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-900/30 active:scale-98'
                }`}
              >
                {createPoliticalCheck.hasForbidden
                  ? `개설 불가 (금칙어 '${createPoliticalCheck.keyword}' 감지)`
                  : '새 투표소 개설 완료'}
              </button>
            </form>
          )}
        </div>

        {/* 3. Avatar Choice Cards */}
        <div className="mb-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            아바타 선택 (Character Choice)
          </label>
          <div className="grid grid-cols-2 gap-3">
            {/* Option A: Male */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setSelectedAvatar('male');
              }}
              className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedAvatar === 'male'
                  ? 'bg-sky-950/60 border-sky-400 ring-2 ring-sky-500/30'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-sky-400/40 flex items-center justify-center shrink-0 relative overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-[#ffdfc4] relative -top-1">
                  <div className="absolute -top-1 inset-x-0 h-3 bg-[#221f1e] rounded-t-full" />
                </div>
                <div className="absolute bottom-0 w-8 h-4 bg-[#1e3a8a] rounded-t-md" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">성인 남성 아바타</p>
                <p className="text-[11px] text-slate-400">네이비 셔츠 · 단정 숏컷</p>
              </div>
            </button>

            {/* Option B: Female */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setSelectedAvatar('female');
              }}
              className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                selectedAvatar === 'female'
                  ? 'bg-amber-950/50 border-amber-400 ring-2 ring-amber-500/30'
                  : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-amber-400/40 flex items-center justify-center shrink-0 relative overflow-hidden">
                <div className="w-6 h-6 rounded-full bg-[#ffdfc4] relative -top-1">
                  <div className="absolute -top-1 -inset-x-1 h-4 bg-[#3d271d] rounded-t-full" />
                </div>
                <div className="absolute bottom-0 w-8 h-4 bg-[#d6bba2] rounded-t-md" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">성인 여성 아바타</p>
                <p className="text-[11px] text-slate-400">베이지 니트 · 볼륨 단발</p>
              </div>
            </button>
          </div>
        </div>

        {/* 4. Enter Button */}
        <button
          type="button"
          onClick={handleFinalEnter}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-blue-500/25 active:scale-[0.98] transition cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-amber-300" />
          <span>
            {isSelectedPrivateLocked
              ? '비공개 투표소 입장 (4자리 코드 필요 🔒)'
              : isSelectedPollFull
              ? '투표소 입장하기 (정원 마감: 결과 열람 모드)'
              : '선택한 투표소 입장하기'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Selected Poll indicator footer */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 px-1">
          <div className="flex items-center gap-1.5 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">
              입장 안건: <strong className="text-slate-200">{selectedPoll.title}</strong>
              <span className="ml-1.5 text-emerald-400 font-semibold">
                ({selectedPoll.isOfficial ? selectedPollChannelLabel : `${selectedPollDisplayTotal} / ${selectedPollCapacity}명`})
              </span>
              {selectedPoll.category === 'private' && (
                <span className={`ml-1 font-bold ${isSelectedPrivateLocked ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isSelectedPrivateLocked ? '[비공개: 잠김]' : '[인증완료]'}
                </span>
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => handleCopyLink(selectedPoll.id, e)}
            className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-semibold shrink-0 cursor-pointer"
          >
            <Copy className="w-3 h-3" />
            <span>{copiedId === selectedPoll.id ? '링크 복사됨!' : '공유 링크 복사'}</span>
          </button>
        </div>

        {/* Beta Service & Non-Election Disclaimer Box */}
        <div className="mt-4 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
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
                <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
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
                <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
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
