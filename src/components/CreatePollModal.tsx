import React, { useState, useMemo } from 'react';
import { PollStation, Candidate } from '../types';
import { sounds } from '../sound';
import { checkPoliticalContent } from '../data/presetPolls';
import { createVoteversePoll, ensureAnonymousAuth } from '../lib/voteverseBackend';
import { getVoterUUID } from '../lib/supabase';
import {
  POLL_TEMPLATES,
  PollTemplateId,
  getPartySuggestionsForCandidate,
  generateSmartPartyAndSlogan,
} from '../utils/pollTemplates';
import {
  Dices,
  KeyRound,
  Sliders,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  Wand2,
} from 'lucide-react';

export const DURATION_OPTIONS = [
  { hours: 1 / 60, label: '1분 후 (테스트)', display: '1분 후 마감 (테스트용)' },
  { hours: 3 / 60, label: '3분 후', display: '3분 후 마감' },
  { hours: 1, label: '1시간 후', display: '1시간 후 마감' },
  { hours: 24, label: '1일 후', display: '1일 후 (24시간)' },
  { hours: 168, label: '7일 후', display: '7일 후 (168시간)' },
];

interface DraftChoice {
  title: string;
  party: string;
  subtitle: string;
}

interface CreatePollModalProps {
  onCreated: (createdPoll: PollStation) => void;
  onPoliticalAlert: (detectedKeyword: string) => void;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  onCreated,
  onPoliticalAlert,
}) => {
  const [activeTemplate, setActiveTemplate] = useState<PollTemplateId | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPrivateCreate, setIsPrivateCreate] = useState(false);
  const [newPasscode, setNewPasscode] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [newMaxVoters, setNewMaxVoters] = useState<number>(100);
  const [selectedDurationHours, setSelectedDurationHours] = useState<number>(24);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Per-row & global variation counters for cycling smart recommendations
  const [rowVariations, setRowVariations] = useState<Record<number, number>>({});

  const [newChoices, setNewChoices] = useState<DraftChoice[]>([
    { title: '', party: '', subtitle: '' },
    { title: '', party: '', subtitle: '' },
    { title: '', party: '', subtitle: '' },
  ]);

  const politicalCheck = useMemo(() => {
    const textsToCheck = [
      newTitle,
      newDesc,
      ...newChoices.map((c) => `${c.title} ${c.party} ${c.subtitle}`),
    ];
    return checkPoliticalContent(textsToCheck);
  }, [newTitle, newDesc, newChoices]);

  const handleApplyTemplate = (templateId: PollTemplateId) => {
    const tpl = POLL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    sounds.playClick();
    setActiveTemplate(templateId);
    setNewTitle(tpl.pollTitle);
    setNewDesc(tpl.pollDescription);
    setNewChoices(
      tpl.choices.map((c) => ({
        title: c.title,
        party: c.party,
        subtitle: c.subtitle,
      }))
    );
    setRowVariations({});
    setFormError(null);
  };

  const handleAutoFillRow = (idx: number) => {
    sounds.playClick();
    const nextVar = (rowVariations[idx] || 0) + 1;
    setRowVariations((prev) => ({ ...prev, [idx]: nextVar }));

    setNewChoices((prev) =>
      prev.map((choice, i) => {
        if (i !== idx) return choice;
        const { party, slogan } = generateSmartPartyAndSlogan(
          choice.title,
          activeTemplate,
          idx,
          nextVar
        );
        return {
          ...choice,
          party,
          subtitle: slogan,
        };
      })
    );
  };

  const handleAutoFillAll = () => {
    sounds.playClick();
    const nextVars: Record<number, number> = {};
    setNewChoices((prev) =>
      prev.map((choice, idx) => {
        const v = (rowVariations[idx] || 0) + 1;
        nextVars[idx] = v;
        const { party, slogan } = generateSmartPartyAndSlogan(
          choice.title,
          activeTemplate,
          idx,
          v
        );
        return {
          ...choice,
          party,
          subtitle: slogan,
        };
      })
    );
    setRowVariations(nextVars);
  };

  const handleAddChoice = () => {
    if (newChoices.length >= 10) return;
    sounds.playClick();
    setNewChoices([...newChoices, { title: '', party: '', subtitle: '' }]);
  };

  const handleRemoveChoice = (idx: number) => {
    if (newChoices.length <= 2) return;
    sounds.playClick();
    setNewChoices(newChoices.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (!newTitle.trim()) {
      setFormError('새 안건 제목을 입력해주세요.');
      return;
    }

    const cleanAdminPin = newAdminPin.trim();
    if (!/^\d{4}$/.test(cleanAdminPin)) {
      sounds.playClick();
      setFormError('개설자 관리 비밀번호 4자리(숫자)를 정확히 입력해주세요.');
      return;
    }

    if (isPrivateCreate) {
      const cleanPasscode = newPasscode.trim();
      if (!/^\d{4}$/.test(cleanPasscode)) {
        sounds.playClick();
        setFormError('참여자용 4자리 비밀 입장코드를 정확히 입력해주세요.');
        return;
      }
    }

    if (politicalCheck.hasForbidden) {
      sounds.playClick();
      setFormError(
        `⚠️ 민감한 정치인 성명 또는 정치 키워드('${politicalCheck.keyword}')는 사용할 수 없습니다. 일상·모임 주제로 작성해 주세요.`
      );
      onPoliticalAlert(politicalCheck.keyword || '정치·선거');
      return;
    }

    sounds.playClick();
    setIsSubmitting(true);

    try {
      const newId = `custom-${Date.now().toString(36)}`;
      const colors = [
        'rose',
        'blue',
        'emerald',
        'amber',
        'purple',
        'indigo',
        'teal',
        'orange',
        'cyan',
        'pink',
      ];
      const hexes = [
        '#f43f5e',
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#8b5cf6',
        '#6366f1',
        '#14b8a6',
        '#f97316',
        '#06b6d4',
        '#ec4899',
      ];

      const formattedCandidates: Candidate[] = newChoices.map((c, idx) => {
        const cleanTitle = c.title.trim() || `후보 ${idx + 1}`;
        const smart = generateSmartPartyAndSlogan(cleanTitle, activeTemplate, idx, 0);
        const finalParty = c.party.trim() || smart.party;
        const finalSubtitle = c.subtitle.trim() || smart.slogan;

        return {
          id: `${newId}-c${idx + 1}`,
          symbolNumber: idx + 1,
          party: finalParty,
          title: cleanTitle,
          subtitle: finalSubtitle,
          badgeColor: colors[idx % colors.length],
          accentBg: hexes[idx % hexes.length],
          description: finalSubtitle,
          votes: 0,
        };
      });

      const finalCapacity = Math.max(2, Math.min(100, Number(newMaxVoters) || 100));
      const expiresAt = Date.now() + selectedDurationHours * 3600 * 1000;
      const creatorOwnerId = (await ensureAnonymousAuth()) || getVoterUUID();

      const createdPoll: PollStation = {
        id: newId,
        title: newTitle.trim(),
        description: newDesc.trim() || '참여형 자유 투표 안건',
        category: isPrivateCreate ? 'private' : 'public',
        accessCode: isPrivateCreate ? newPasscode.trim() : undefined,
        adminPin: cleanAdminPin,
        ownerId: creatorOwnerId,
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
        setFormError(res.error || '투표소 DB 저장에 실패했습니다. 다시 시도해주세요.');
        return;
      }

      // Reset fields cleanly
      setActiveTemplate(null);
      setNewTitle('');
      setNewDesc('');
      setIsPrivateCreate(false);
      setNewPasscode('');
      setNewAdminPin('');
      setNewMaxVoters(100);
      setSelectedDurationHours(24);
      setNewChoices([
        { title: '', party: '', subtitle: '' },
        { title: '', party: '', subtitle: '' },
        { title: '', party: '', subtitle: '' },
      ]);
      setRowVariations({});
      setFormError(null);

      onCreated(createdPoll);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3.5 space-y-3 max-h-[52vh] sm:max-h-[430px] overflow-y-auto"
    >
      {/* 1-Click 5 Situation Templates Bar */}
      <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>1클릭 상황별 템플릿 (바로 채우기)</span>
          </span>
          {activeTemplate && (
            <span className="text-[10px] text-sky-300 font-semibold">
              선택됨: {POLL_TEMPLATES.find((t) => t.id === activeTemplate)?.label}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {POLL_TEMPLATES.map((tpl) => {
            const isSelected = activeTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tpl.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer border active:scale-95 ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm shadow-emerald-900/40'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-500'
                }`}
              >
                <span>{tpl.badge}</span>
                <span>{tpl.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Forbidden Political Keyword Real-time Warning Banner */}
      {(politicalCheck.hasForbidden || formError) && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs font-semibold animate-in fade-in duration-150">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            {politicalCheck.hasForbidden
              ? `⚠️ 민감한 정치인 성명 또는 정치 키워드('${politicalCheck.keyword}')는 사용할 수 없습니다. 일상·모임 주제로 작성해 주세요.`
              : formError}
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
          placeholder="예: 금요일 점심 메뉴 대결 또는 위 템플릿을 클릭해보세요!"
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
          placeholder="예: 우리 팀 모두가 만족할 최고의 선택지를 투표로 정합니다."
          className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Choices (2 to 10) with Intelligent Party & Slogan Auto-Generator */}
      <div className="bg-slate-900/50 border border-slate-700/70 rounded-xl p-2.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-[11px] font-bold text-slate-200">
            후보 선택지 ({newChoices.length}/10)
          </label>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoFillAll}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-[11px] font-bold transition cursor-pointer active:scale-95"
            >
              <Dices className="w-3.5 h-3.5 text-sky-300" />
              <span>🎲 전체 정당명·공약 자동 채우기</span>
            </button>

            {newChoices.length < 10 ? (
              <button
                type="button"
                onClick={handleAddChoice}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold cursor-pointer active:scale-95 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 선택지 추가
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-medium">최대 10개</span>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          {newChoices.map((choice, idx) => {
            const suggestions = getPartySuggestionsForCandidate(
              choice.title,
              activeTemplate,
              idx
            );

            return (
              <div
                key={idx}
                className="bg-slate-900/80 border border-slate-700/75 rounded-xl p-2.5 space-y-2"
              >
                {/* Row 1: Symbol + Candidate Title + Party Input + Auto-recommend + Remove */}
                <div className="flex flex-wrap sm:flex-nowrap gap-1.5 items-center">
                  <span className="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center text-[11px] font-extrabold shrink-0 text-white">
                    {idx + 1}
                  </span>

                  <input
                    type="text"
                    required
                    value={choice.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewChoices((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                      );
                    }}
                    placeholder={`후보 ${idx + 1} 이름 (예: 삼겹살, 금요일 저녁)`}
                    className="flex-1 min-w-[140px] px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />

                  <input
                    type="text"
                    value={choice.party}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewChoices((prev) =>
                        prev.map((item, i) => (i === idx ? { ...item, party: val } : item))
                      );
                    }}
                    placeholder="정당명 (비우면 자동생성)"
                    className="w-32 sm:w-36 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-amber-200 text-xs font-semibold focus:outline-none focus:border-amber-400"
                  />

                  <button
                    type="button"
                    onClick={() => handleAutoFillRow(idx)}
                    title="후보 이름에 어울리는 정당명·공약 자동 추천"
                    className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-600/30 border border-slate-600 hover:border-sky-400/50 text-sky-300 text-[10px] font-bold transition cursor-pointer shrink-0 active:scale-95"
                  >
                    <Wand2 className="w-3 h-3" />
                    <span>🎲 자동 추천</span>
                  </button>

                  {newChoices.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveChoice(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition cursor-pointer shrink-0"
                      title="선택지 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Row 2: One-line Slogan / Description */}
                <input
                  type="text"
                  value={choice.subtitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewChoices((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, subtitle: val } : item))
                    );
                  }}
                  placeholder="한줄 공약 · 설명 (비워두면 후보 키워드에 맞춰 자동으로 채워집니다)"
                  className="w-full px-2.5 py-1.5 bg-slate-950/70 border border-slate-700/70 rounded-lg text-slate-300 text-[11px] focus:outline-none focus:border-sky-500"
                />

                {/* Row 3: Keyword-Aware Recommended Party Chips (4~5 chips) */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                    추천 정당명:
                  </span>
                  {suggestions.map((partyChip) => {
                    const isPicked = choice.party.trim() === partyChip;
                    return (
                      <button
                        key={partyChip}
                        type="button"
                        onClick={() => {
                          sounds.playClick();
                          setNewChoices((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, party: partyChip } : item
                            )
                          );
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer border ${
                          isPicked
                            ? 'bg-amber-500/25 text-amber-200 border-amber-400/60'
                            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700/80 hover:border-slate-500'
                        }`}
                      >
                        #{partyChip}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-400">
          ※ 정당명이나 한줄 공약을 비워두셔도 개설 시 후보 키워드에 맞춰 센스 있는 정당명과 공약이 자동 완성됩니다.
        </p>
      </div>

      {/* 1. Creator Admin PIN setting (4 digits - mandatory) */}
      <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>개설자 관리 비밀번호 (숫자 4자리) *</span>
          </label>
          <span className="text-[10px] text-amber-400 font-bold">수정/삭제/조기마감 보호</span>
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

      {/* 3. Duration / Timer Selection */}
      <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>투표 마감 시간 설정</span>
          </label>
          <span className="text-xs font-bold text-amber-400">
            {DURATION_OPTIONS.find((d) => Math.abs(d.hours - selectedDurationHours) < 0.001)
              ?.display || `${selectedDurationHours}시간 후 마감`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setSelectedDurationHours(opt.hours)}
              className={`py-1.5 px-1 rounded text-center text-[11px] font-bold transition cursor-pointer border ${
                Math.abs(selectedDurationHours - opt.hours) < 0.001
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
            >
              {opt.label}
            </button>
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
      </div>

      <button
        type="submit"
        disabled={politicalCheck.hasForbidden || !newTitle.trim() || isSubmitting}
        className={`w-full py-2.5 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 ${
          politicalCheck.hasForbidden || !newTitle.trim() || isSubmitting
            ? 'bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-80'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-900/30 active:scale-98'
        }`}
      >
        {politicalCheck.hasForbidden
          ? `개설 불가 (금칙어 '${politicalCheck.keyword}' 감지)`
          : isSubmitting
          ? '투표소 생성 중...'
          : '새 투표소 개설 완료'}
      </button>
    </form>
  );
};
