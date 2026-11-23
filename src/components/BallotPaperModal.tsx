import React, { useState } from 'react';
import { Candidate } from '../types';
import { sounds } from '../sound';
import { Check, Info, ShieldAlert, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface BallotPaperModalProps {
  candidates: Candidate[];
  pollTitle?: string;
  onComplete: (candidateId: string) => void;
  onClose: () => void;
}

const DEFAULT_PALETTE = [
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

const BADGE_COLOR_HEX: Record<string, string> = {
  rose: '#f43f5e',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  teal: '#14b8a6',
  orange: '#f97316',
  cyan: '#06b6d4',
  pink: '#ec4899',
};

function getCandidateColor(candidate: Candidate, index: number): string {
  const customColor = (candidate as Candidate & { color?: string }).color;
  if (typeof customColor === 'string' && customColor.trim()) {
    return customColor.trim();
  }
  if (typeof candidate.accentBg === 'string' && candidate.accentBg.trim()) {
    return candidate.accentBg.trim();
  }
  if (candidate.badgeColor && BADGE_COLOR_HEX[candidate.badgeColor]) {
    return BADGE_COLOR_HEX[candidate.badgeColor];
  }
  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length];
}

function hexWithAlpha(color: string, alpha: number): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    const r = parseInt(trimmed.slice(1, 3), 16);
    const g = parseInt(trimmed.slice(3, 5), 16);
    const b = parseInt(trimmed.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = parseInt(trimmed[1] + trimmed[1], 16);
    const g = parseInt(trimmed[2] + trimmed[2], 16);
    const b = parseInt(trimmed[3] + trimmed[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return trimmed;
}

function cleanCandidateDescription(rawText: string | undefined, party: string): string {
  if (!rawText) return '';
  let text = rawText.trim();
  if (!text) return '';

  if (party) {
    const escapedParty = party.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefixRegex = new RegExp(`^${escapedParty}\\s*\\|\\s*`, 'i');
    text = text.replace(prefixRegex, '').trim();
  } else if (text.includes(' | ')) {
    text = text.slice(text.indexOf(' | ') + 3).trim();
  }

  if (!text || text === party) return '';
  return text;
}

export const BallotPaperModal: React.FC<BallotPaperModalProps> = ({
  candidates,
  pollTitle,
  onComplete,
  onClose,
}) => {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [isFolding, setIsFolding] = useState(false);
  const [stampCoordinates, setStampCoordinates] = useState<{ [key: string]: { x: number; y: number } }>({});

  const toggleExpandCandidate = (candidateId: string) => {
    setExpandedCandidateId((prev) => (prev === candidateId ? null : candidateId));
  };

  const handleSelectCandidate = (candidateId: string, e: React.MouseEvent<HTMLDivElement>) => {
    sounds.playStampSound();
    setSelectedCandidateId(candidateId);

    // Track relative click position in target cell for authentic stamp placement
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStampCoordinates((prev) => ({
      ...prev,
      [candidateId]: { x, y },
    }));
  };

  const handleFoldBallot = () => {
    if (!selectedCandidateId) return;
    sounds.playPaperFold();
    setIsFolding(true);

    setTimeout(() => {
      onComplete(selectedCandidateId);
    }, 750);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-3 bg-slate-950/85 backdrop-blur-md">
      <div
        className={`relative max-w-xl sm:max-w-2xl w-full max-h-[96dvh] sm:max-h-[92dvh] flex flex-col transition-all duration-700 ease-in-out ${
          isFolding
            ? 'scale-75 -rotate-6 opacity-0 translate-y-12'
            : 'scale-100 opacity-100'
        }`}
      >
        {/* Booth privacy indicator banner (Compact on mobile) */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-950/85 border border-emerald-500/30 rounded-t-2xl text-emerald-300 text-[11px] sm:text-xs font-semibold backdrop-blur-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate">
              기표소 내부 · 비밀투표 절대 보장
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[11px] sm:text-xs text-slate-300 hover:text-white px-2 py-0.5 sm:px-2.5 sm:py-1 rounded bg-slate-800/80 transition cursor-pointer whitespace-nowrap"
          >
            기표소 나가기
          </button>
        </div>

        {/* Realistic Korean Election Ballot Paper (Slim Mobile Header/Footer + Single-Page Fit) */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#fcfbf7] border-2 border-[#d6cfbe] shadow-2xl px-2 py-2 sm:px-3.5 sm:py-3.5 text-slate-900 rounded-b-2xl relative select-none">
          {/* Subtle paper grain texture pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2d9c8_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none rounded-b-2xl" />

          {/* Ballot Top Header (Compressed vertical padding for mobile) */}
          <div className="relative shrink-0 text-center border-b-2 border-slate-900 pb-1.5 mb-1.5 sm:pb-2.5 sm:mb-2.5">
            <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-slate-500 mb-0.5">
              <span>서울특별시 가상 제1투표구</span>
              <span className="font-mono font-semibold">관리번호: 2026-VOTE-01</span>
            </div>
            <h1 className="text-base sm:text-xl font-black tracking-widest text-slate-900 font-serif leading-tight">
              투  표  용  지
            </h1>
            <p className="text-[11px] sm:text-xs font-semibold text-slate-700 mt-0.5 whitespace-normal break-keep break-words leading-tight">
              [ {pollTitle || '제1회 모의선거'} ]
            </p>
          </div>

          {/* Voting Instruction Note (Compact) */}
          <div className="relative shrink-0 flex items-center gap-1.5 px-2 py-1 sm:p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[10px] sm:text-xs mb-1.5 sm:mb-2.5 leading-tight sm:leading-snug">
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
            <span className="whitespace-normal break-keep break-words">
              원하는 후보의 <strong>[기표란]</strong>을 눌러 날인(<strong>卜</strong>) 후 하단 <strong>[투표용지 접기]</strong>를 누르세요.
            </span>
          </div>

          {/* Candidates Table (Unified 4-Column Korean Ballot Grid) */}
          <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden border-2 border-slate-900 bg-white shadow-sm mb-1.5 sm:mb-2.5 rounded-xs">
            {/* Table Header */}
            <div className="shrink-0 flex items-stretch bg-slate-100 text-[10px] sm:text-xs font-bold text-slate-700 text-center border-b-2 border-slate-900">
              <div className="w-1.5 sm:w-2 shrink-0 bg-slate-300" />
              <div className="w-9 sm:w-11 shrink-0 py-1 sm:py-1.5 border-r-2 border-slate-900 flex items-center justify-center">
                기호
              </div>
              <div className="w-[72px] sm:w-[92px] shrink-0 px-1 py-1 sm:py-1.5 border-r-2 border-slate-900 flex items-center justify-center">
                정당명
              </div>
              <div className="flex-1 min-w-0 px-2 py-1 sm:py-1.5 border-r-2 border-slate-900 flex items-center justify-center">
                후보자(메뉴명)
              </div>
              <div className="w-12 sm:w-14 shrink-0 py-1 sm:py-1.5 flex items-center justify-center">
                기표란
              </div>
            </div>

            {/* Candidate Rows Container (Top-aligned scroll container so row 1 never clips) */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y-2 divide-slate-900">
              {candidates.map((candidate, idx) => {
                const isSelected = selectedCandidateId === candidate.id;
                const isExpanded = expandedCandidateId === candidate.id;
                const coords = stampCoordinates[candidate.id];
                const candidateColor = getCandidateColor(candidate, idx);

                const rawParty = candidate.party?.trim();
                const displayParty = rawParty || `기호 ${candidate.symbolNumber}번`;
                const rawDesc = (candidate.subtitle || candidate.description)?.trim() || '';
                const displayDesc = cleanCandidateDescription(rawDesc, displayParty);
                const hasExpandableDetail = Boolean(
                  displayDesc || candidate.title.length > 12 || displayParty.length > 5
                );

                return (
                  <div
                    key={candidate.id}
                    className={`flex items-stretch min-h-[52px] sm:min-h-[58px] transition-colors ${
                      !isSelected ? 'hover:bg-slate-50/80' : ''
                    }`}
                    style={
                      isSelected
                        ? {
                            backgroundColor: hexWithAlpha(candidateColor, 0.1),
                            boxShadow: `inset 0 0 0 2px ${candidateColor}`,
                          }
                        : undefined
                    }
                  >
                    {/* Leftmost Candidate Color Bar */}
                    <div
                      className="w-1.5 sm:w-2 shrink-0 self-stretch"
                      style={{ backgroundColor: candidateColor }}
                    />

                    {/* 1. Symbol Number Colored Badge */}
                    <div className="w-9 sm:w-11 shrink-0 py-1.5 sm:py-2 flex items-center justify-center border-r-2 border-slate-900 bg-slate-50/70">
                      <span
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center font-black text-xs sm:text-sm text-white font-serif shadow-sm"
                        style={{
                          backgroundColor: candidateColor,
                          boxShadow: `0 2px 6px ${hexWithAlpha(candidateColor, 0.45)}`,
                        }}
                      >
                        {candidate.symbolNumber}
                      </span>
                    </div>

                    {/* 2. Party Name Compact Single-Line Colored Tag Badge */}
                    <div className="w-[72px] sm:w-[92px] shrink-0 py-1.5 sm:py-2 px-1 flex items-center justify-center border-r-2 border-slate-900 text-center">
                      <span
                        className="inline-block max-w-full px-1 sm:px-1.5 py-0.5 rounded-md border text-[9.5px] sm:text-[11px] font-bold leading-tight truncate tracking-tighter sm:tracking-normal"
                        style={{
                          color: candidateColor,
                          borderColor: hexWithAlpha(candidateColor, 0.45),
                          backgroundColor: hexWithAlpha(candidateColor, 0.1),
                        }}
                        title={displayParty}
                      >
                        {displayParty}
                      </span>
                    </div>

                    {/* 3. Candidate Name & Summary Column with [상세보기 ▾] / [접기 ▴] Toggle */}
                    <div
                      onClick={() => {
                        if (!hasExpandableDetail) return;
                        sounds.playClick();
                        toggleExpandCandidate(candidate.id);
                      }}
                      className={`flex-1 min-w-0 py-1.5 sm:py-2 px-2 sm:px-2.5 flex flex-col justify-center border-r-2 border-slate-900 text-left ${
                        hasExpandableDetail ? 'cursor-pointer' : ''
                      }`}
                    >
                      <span
                        className={`text-[13px] sm:text-sm font-bold text-slate-950 leading-tight ${
                          isExpanded
                            ? 'whitespace-normal break-keep break-words'
                            : 'line-clamp-1'
                        }`}
                      >
                        {candidate.title}
                      </span>

                      {isExpanded ? (
                        <div className="mt-1 p-1.5 sm:p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] sm:text-xs text-slate-700 whitespace-normal break-keep break-words leading-snug space-y-1 shadow-xs animate-in fade-in duration-150">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-[10px] font-extrabold"
                              style={{ color: candidateColor }}
                            >
                              {displayParty}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                sounds.playClick();
                                toggleExpandCandidate(candidate.id);
                              }}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/80 hover:bg-slate-300 text-[10px] font-bold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <span>접기</span>
                              <ChevronUp className="w-2.5 h-2.5 shrink-0" />
                            </button>
                          </div>
                          {displayDesc && <p className="text-slate-700">{displayDesc}</p>}
                        </div>
                      ) : (
                        (displayDesc || hasExpandableDetail) && (
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className="text-[11px] sm:text-xs text-slate-600 line-clamp-1 leading-tight flex-1 min-w-0">
                              {displayDesc || displayParty}
                            </span>
                            {hasExpandableDetail && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sounds.playClick();
                                  toggleExpandCandidate(candidate.id);
                                }}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[9.5px] sm:text-[10px] font-bold text-slate-700 whitespace-nowrap shrink-0 transition cursor-pointer"
                              >
                                <span>상세보기</span>
                                <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {/* 4. Stamp Target Cell */}
                    <div
                      onClick={(e) => handleSelectCandidate(candidate.id, e)}
                      className="w-12 sm:w-14 shrink-0 py-1.5 sm:py-2 relative flex items-center justify-center cursor-pointer p-1 group"
                    >
                      {/* Circle guide outline inside stamp box */}
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-red-600 bg-red-50'
                            : 'border-slate-300 group-hover:border-red-300 group-hover:bg-red-50/30'
                        }`}
                      >
                        {!isSelected && (
                          <span className="text-[9px] sm:text-[10px] text-slate-400 group-hover:text-red-500 font-bold transition">
                            기표
                          </span>
                        )}
                      </div>

                      {/* Authentic Korean Election Stamp '卜' in Vivid Crimson Red */}
                      {isSelected && (
                        <div
                          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2 animate-in zoom-in-75 duration-150"
                          style={{
                            left: coords ? `${coords.x}px` : '50%',
                            top: coords ? `${coords.y}px` : '50%',
                          }}
                        >
                          <svg
                            viewBox="0 0 100 100"
                            className="w-9 h-9 sm:w-11 sm:h-11 text-[#dc2626] filter drop-shadow-[0_1px_2px_rgba(220,38,38,0.3)]"
                          >
                            {/* Circular outer seal */}
                            <circle
                              cx="50"
                              cy="50"
                              r="44"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="7"
                            />
                            {/* Inner Korean Election '卜' Glyphs */}
                            <line
                              x1="40"
                              y1="22"
                              x2="40"
                              y2="78"
                              stroke="currentColor"
                              strokeWidth="8"
                              strokeLinecap="round"
                            />
                            <line
                              x1="40"
                              y1="46"
                              x2="66"
                              y2="34"
                              stroke="currentColor"
                              strokeWidth="8"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Security Mark & Seal (Compact) */}
          <div className="relative shrink-0 flex items-center justify-between gap-2 border-t border-slate-300 pt-1.5 sm:pt-2 text-[9.5px] sm:text-[11px] text-slate-500">
            <div className="flex items-center gap-1 text-slate-600 min-w-0">
              <ShieldAlert className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 shrink-0" />
              <span className="truncate sm:whitespace-normal">
                기표소 내 촬영 및 공개는 엄격히 금지됩니다.
              </span>
            </div>
            <div className="shrink-0 font-serif font-bold text-red-700 tracking-wider border border-red-400 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] whitespace-nowrap">
              보트버스 선거관리위원회
            </div>
          </div>

          {/* Fixed Bottom Fold Button (Compact on mobile) */}
          <div className="relative shrink-0 mt-1.5 sm:mt-2.5">
            <button
              type="button"
              disabled={!selectedCandidateId || isFolding}
              onClick={handleFoldBallot}
              className={`w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-xl transition cursor-pointer ${
                selectedCandidateId
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 active:scale-[0.98]'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
              <span className="whitespace-nowrap">
                {selectedCandidateId
                  ? '투표용지 반으로 접기 (비밀투표 보호)'
                  : '후보를 선택하여 기표해주세요'}
              </span>
              {selectedCandidateId && <ArrowRight className="w-4 h-4 ml-0.5 shrink-0" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
