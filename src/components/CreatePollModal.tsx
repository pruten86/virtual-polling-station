import React, { useState, useMemo, useEffect } from 'react';
import { PollStation, Candidate, ResultVisibility } from '../types';
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
  BarChart3,
  Lock,
  Camera,
  X,
} from 'lucide-react';
import { compressImageFileToDataUrl } from '../utils/candidateImage';

export const DURATION_OPTIONS = [
  { group: 'short', hours: 1 / 60, label: '1분', display: '1분 후 마감 (테스트용)' },
  { group: 'short', hours: 3 / 60, label: '3분', display: '3분 후 마감 (테스트용)' },
  { group: 'short', hours: 0.5, label: '30분', display: '30분 후 마감' },
  { group: 'hourly', hours: 1, label: '1시간', display: '1시간 후 마감' },
  { group: 'hourly', hours: 2, label: '2시간', display: '2시간 후 마감' },
  { group: 'hourly', hours: 3, label: '3시간', display: '3시간 후 마감' },
  { group: 'hourly', hours: 6, label: '6시간', display: '6시간 후 마감' },
  { group: 'hourly', hours: 12, label: '12시간', display: '12시간 후 마감' },
  { group: 'hourly', hours: 18, label: '18시간', display: '18시간 후 마감' },
  { group: 'hourly', hours: 24, label: '24시간(1일)', display: '24시간(1일) 후 마감' },
  { group: 'daily', hours: 72, label: '3일', display: '3일(72시간) 후 마감' },
  { group: 'daily', hours: 168, label: '7일', display: '7일(168시간) 후 마감' },
] as const;

function formatPreviewDateTimeKorean(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}년 ${m}월 ${day}일 ${hh}:${mm}`;
}

function formatDurationRelativeNote(hours: number): string {
  if (hours < 1) {
    const mins = Math.max(1, Math.round(hours * 60));
    return `약 ${mins}분 후 자동 마감`;
  }
  if (hours <= 24) {
    return `약 ${Math.round(hours)}시간 후 자동 마감`;
  }
  const days = Math.round(hours / 24);
  return `약 ${days}일(${Math.round(hours)}시간) 후 자동 마감`;
}

export interface PollDurationSelectorProps {
  durationHours: number;
  onChange: (hours: number) => void;
  existingExpiresAt?: number;
  isModified?: boolean;
  onResetToExisting?: () => void;
}

export const PollDurationSelector: React.FC<PollDurationSelectorProps> = ({
  durationHours,
  onChange,
  existingExpiresAt,
  isModified = true,
  onResetToExisting,
}) => {
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now());
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const shortOptions = DURATION_OPTIONS.filter((o) => o.group === 'short');
  const hourlyOptions = DURATION_OPTIONS.filter((o) => o.group === 'hourly');
  const dailyOptions = DURATION_OPTIONS.filter((o) => o.group === 'daily');

  const isHourlyInt =
    durationHours >= 1 &&
    durationHours <= 24 &&
    Math.abs(durationHours - Math.round(durationHours)) < 0.001;
  const sliderVal = isHourlyInt
    ? Math.round(durationHours)
    : durationHours < 1
    ? 1
    : 24;

  const matchedPreset = DURATION_OPTIONS.find(
    (d) => Math.abs(d.hours - durationHours) < 0.001
  );
  const badgeText =
    existingExpiresAt && !isModified
      ? '기존 마감 시각 유지 중'
      : matchedPreset?.display || `${Math.round(durationHours)}시간 후 마감`;

  const previewDeadlineTs =
    existingExpiresAt && !isModified
      ? existingExpiresAt
      : nowTs + durationHours * 3600 * 1000;

  return (
    <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-2.5 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>투표 마감 시간 설정</span>
        </label>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-amber-400">{badgeText}</span>
          {existingExpiresAt && isModified && onResetToExisting && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onResetToExisting();
              }}
              className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] text-slate-300 cursor-pointer transition"
            >
              기존 유지
            </button>
          )}
        </div>
      </div>

      {/* Quick preset groups */}
      <div className="space-y-2">
        {/* Group 1: 초단기/테스트 */}
        <div className="space-y-1">
          <span className="block text-[10px] font-semibold text-slate-400">
            초단기 · 테스트
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {shortOptions.map((opt) => {
              const active =
                isModified && Math.abs(durationHours - opt.hours) < 0.001;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onChange(opt.hours);
                  }}
                  className={`py-1.5 px-2 rounded-md text-center text-[11px] font-bold transition cursor-pointer border ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Group 2: 당일 시간 단위 (1~24시간) */}
        <div className="space-y-1">
          <span className="block text-[10px] font-semibold text-slate-400">
            당일 시간 단위 (1~24시간)
          </span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {hourlyOptions.map((opt) => {
              const active =
                isModified && Math.abs(durationHours - opt.hours) < 0.001;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onChange(opt.hours);
                  }}
                  className={`py-1.5 px-1 rounded-md text-center text-[11px] font-bold transition cursor-pointer border whitespace-nowrap ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Group 3: 다일 단위 */}
        <div className="space-y-1">
          <span className="block text-[10px] font-semibold text-slate-400">
            다일 단위
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {dailyOptions.map((opt) => {
              const active =
                isModified && Math.abs(durationHours - opt.hours) < 0.001;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onChange(opt.hours);
                  }}
                  className={`py-1.5 px-2 rounded-md text-center text-[11px] font-bold transition cursor-pointer border ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Custom 1~24 hour slider + 1-hour dropdown */}
      <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-sky-300">
            직접 시간 조절 (1~24시간)
          </span>
          <select
            aria-label="직접 시간 선택 (1~24시간)"
            value={isModified && isHourlyInt ? String(Math.round(durationHours)) : ''}
            onChange={(e) => {
              const hrs = Number(e.target.value);
              if (Number.isFinite(hrs) && hrs >= 1 && hrs <= 24) {
                sounds.playClick();
                onChange(hrs);
              }
            }}
            className="px-2 py-1 bg-slate-950 border border-slate-600 rounded-md text-[11px] font-bold text-amber-300 focus:outline-none focus:border-amber-400 cursor-pointer"
          >
            <option value="" disabled>
              시간 직접 선택 (1~24시간)
            </option>
            {Array.from({ length: 24 }, (_, idx) => idx + 1).map((h) => (
              <option key={h} value={String(h)}>
                {h}시간 후 마감
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-mono text-slate-400 shrink-0">1시간</span>
          <input
            type="range"
            min={1}
            max={24}
            step={1}
            value={sliderVal}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1 accent-amber-400 cursor-pointer"
          />
          <span className="text-[10px] font-mono text-slate-400 shrink-0">24시간</span>
        </div>
      </div>

      {/* Live Scheduled Deadline Preview */}
      <div className="px-2.5 py-2 rounded-lg bg-slate-950/90 border border-amber-500/35 text-[11px] leading-snug">
        {existingExpiresAt && !isModified ? (
          <div className="text-slate-200 font-semibold">
            🕒 현재 마감 예정 일시:{' '}
            <span className="text-amber-300 font-bold">
              {formatPreviewDateTimeKorean(existingExpiresAt)}
            </span>{' '}
            <span className="text-[10px] text-slate-400 block sm:inline sm:ml-1">
              ({existingExpiresAt <= nowTs ? '이미 마감됨 · 위 버튼/슬라이더 변경 시 재설정' : '위 시간 선택 시 현재 시각 기준으로 재설정'})
            </span>
          </div>
        ) : (
          <div className="text-slate-200 font-semibold">
            🕒 마감 예정 일시:{' '}
            <span className="text-amber-300 font-bold">
              {formatPreviewDateTimeKorean(previewDeadlineTs)}
            </span>{' '}
            <span className="text-sky-300 font-bold">
              ({formatDurationRelativeNote(durationHours)})
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export interface ResultVisibilitySelectorProps {
  value: ResultVisibility;
  onChange: (next: ResultVisibility) => void;
}

export const ResultVisibilitySelector: React.FC<ResultVisibilitySelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="bg-slate-900/60 border border-slate-700/70 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>개표 결과 공개 시점</span>
        </label>
        <span className="text-[10px] font-bold text-sky-300">
          {value === 'after_close' ? '🔒 마감 후 일괄 공개' : '📊 실시간 즉시 공개'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onChange('realtime');
          }}
          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex items-start gap-2 ${
            value === 'realtime'
              ? 'bg-sky-500/20 border-sky-400 ring-1 ring-sky-400/40 text-white shadow-sm'
              : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
          }`}
        >
          <BarChart3
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              value === 'realtime' ? 'text-sky-300' : 'text-slate-400'
            }`}
          />
          <div className="min-w-0 space-y-0.5">
            <span className="block text-[11px] font-extrabold leading-snug">
              📊 실시간 공개 (기본)
            </span>
            <span className="block text-[10px] text-slate-400 leading-snug">
              투표 진행 중에도 전광판과 로비에서 실시간 득표 현황을 볼 수 있습니다.
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onChange('after_close');
          }}
          className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex items-start gap-2 ${
            value === 'after_close'
              ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/40 text-white shadow-sm'
              : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:border-slate-500'
          }`}
        >
          <Lock
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              value === 'after_close' ? 'text-amber-300' : 'text-slate-400'
            }`}
          />
          <div className="min-w-0 space-y-0.5">
            <span className="block text-[11px] font-extrabold leading-snug">
              🔒 투표 마감 후 공개
            </span>
            <span className="block text-[10px] text-slate-400 leading-snug">
              마감 전까지 후보별 득표수·순위를 비밀로 유지하고 마감 확정 시 공개합니다.
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

interface DraftChoice {
  title: string;
  party: string;
  subtitle: string;
  imageUrl?: string;
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
  const [resultVisibility, setResultVisibility] = useState<ResultVisibility>('realtime');
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

  const handleCandidatePhotoUpload = async (
    idx: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file, 240, 0.72);
      sounds.playClick();
      setNewChoices((prev) =>
        prev.map((item, i) =>
          i === idx ? { ...item, imageUrl: compressedDataUrl } : item
        )
      );
      setFormError(null);
    } catch (err: any) {
      setFormError(err?.message || '사진을 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleRemoveCandidatePhoto = (idx: number) => {
    sounds.playClick();
    setNewChoices((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, imageUrl: undefined } : item))
    );
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
          ...(c.imageUrl ? { imageUrl: c.imageUrl } : {}),
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
        resultVisibility,
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
      setResultVisibility('realtime');
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

                  {/* Optional Candidate Photo Upload (240x240 JPEG compressed) */}
                  {choice.imageUrl ? (
                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-emerald-400/70 shrink-0 group">
                      <img
                        src={choice.imageUrl}
                        alt={`후보 ${idx + 1} 미리보기`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCandidatePhoto(idx)}
                        title="첨부 사진 삭제"
                        className="absolute inset-0 bg-slate-950/65 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      title="후보 사진 첨부 (선택 사항 · 240×240 자동 압축)"
                      className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 border border-slate-600 hover:border-emerald-400/50 text-emerald-300 text-[10px] font-bold transition cursor-pointer shrink-0 active:scale-95"
                    >
                      <Camera className="w-3 h-3" />
                      <span>사진</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleCandidatePhotoUpload(idx, e)}
                        className="hidden"
                      />
                    </label>
                  )}

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
      <PollDurationSelector
        durationHours={selectedDurationHours}
        onChange={setSelectedDurationHours}
      />

      {/* 4. Result Visibility Selection (Realtime vs After Close) */}
      <ResultVisibilitySelector
        value={resultVisibility}
        onChange={setResultVisibility}
      />

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
