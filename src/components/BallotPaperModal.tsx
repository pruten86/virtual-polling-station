import React, { useState } from 'react';
import { Candidate } from '../types';
import { sounds } from '../sound';
import { Check, Info, ShieldAlert, ArrowRight } from 'lucide-react';

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
  const [isFolding, setIsFolding] = useState(false);
  const [stampCoordinates, setStampCoordinates] = useState<{ [key: string]: { x: number; y: number } }>({});

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 bg-slate-950/85 backdrop-blur-md">
      <div
        className={`relative max-w-xl sm:max-w-2xl w-full max-h-[90dvh] flex flex-col transition-all duration-700 ease-in-out ${
          isFolding
            ? 'scale-75 -rotate-6 opacity-0 translate-y-12'
            : 'scale-100 opacity-100'
        }`}
      >
        {/* Booth privacy indicator banner */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 bg-emerald-950/80 border border-emerald-500/30 rounded-t-2xl text-emerald-300 text-xs font-semibold backdrop-blur-sm">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="whitespace-normal break-keep break-words leading-snug">
              기표소 내부 · 비밀투표 절대 보장
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800/80 transition cursor-pointer"
          >
            기표소 나가기
          </button>
        </div>

        {/* Realistic Korean Election Ballot Paper (Unified PC & Mobile Layout) */}
        <div className="flex flex-col flex-1 min-h-0 bg-[#fcfbf7] border-2 border-[#d6cfbe] shadow-2xl px-3 py-4 text-slate-900 rounded-b-2xl relative select-none">
          {/* Subtle paper grain texture pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2d9c8_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none rounded-b-2xl" />

          {/* Ballot Top Header */}
          <div className="relative shrink-0 text-center border-b-2 border-slate-900 pb-2.5 mb-2.5">
            <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
              <span>서울특별시 가상 제1투표구</span>
              <span className="font-mono font-semibold">관리번호: 2026-VOTE-01</span>
            </div>
            <h1 className="text-xl font-black tracking-widest text-slate-900 font-serif">
              투  표  용  지
            </h1>
            <p className="text-xs font-semibold text-slate-700 mt-0.5 whitespace-normal break-keep break-words leading-snug">
              [ {pollTitle || '제1회 모의선거'} ]
            </p>
          </div>

          {/* Voting Instruction Note */}
          <div className="relative shrink-0 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs mb-3 leading-snug">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="whitespace-normal break-keep break-words leading-snug">
              원하는 후보의 <strong>[기표란]</strong>을 클릭하여 기표용구(<strong>卜</strong>)를 날인한 후, 하단의 <strong>[투표용지 접기]</strong>를 누르세요.
            </span>
          </div>

          {/* Candidates Table (Unified 4-Column Korean Ballot Grid) */}
          <div className="relative flex flex-col flex-1 min-h-0 border-2 border-slate-900 bg-white shadow-sm mb-3 rounded-xs">
            {/* Table Header */}
            <div className="shrink-0 flex items-stretch bg-slate-100 text-xs font-bold text-slate-700 text-center border-b-2 border-slate-900">
              <div className="w-1.5 sm:w-2 shrink-0 bg-slate-300" />
              <div className="w-11 shrink-0 py-2 border-r-2 border-slate-900 flex items-center justify-center">
                기호
              </div>
              <div className="w-[82px] shrink-0 px-1.5 py-2 border-r-2 border-slate-900 flex items-center justify-center">
                정당명
              </div>
              <div className="flex-1 min-w-0 px-2.5 py-2 border-r-2 border-slate-900 flex items-center justify-center">
                후보자(메뉴명)
              </div>
              <div className="w-14 shrink-0 py-2 flex items-center justify-center">
                기표란
              </div>
            </div>

            {/* Candidate Rows Container (Scrollable Only Here) */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y-2 divide-slate-900">
              {candidates.map((candidate, idx) => {
                const isSelected = selectedCandidateId === candidate.id;
                const coords = stampCoordinates[candidate.id];
                const candidateColor = getCandidateColor(candidate, idx);

                const rawParty = candidate.party?.trim();
                const displayParty = rawParty || `기호 ${candidate.symbolNumber}번`;
                const rawDesc = (candidate.subtitle || candidate.description)?.trim() || '';
                const displayDesc = cleanCandidateDescription(rawDesc, displayParty);

                return (
                  <div
                    key={candidate.id}
                    className={`flex items-stretch min-h-[64px] h-auto transition-colors ${
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
                    <div className="w-11 shrink-0 py-2.5 flex items-center justify-center border-r-2 border-slate-900 bg-slate-50/70">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center font-black text-base text-white font-serif shadow-sm"
                        style={{
                          backgroundColor: candidateColor,
                          boxShadow: `0 2px 6px ${hexWithAlpha(candidateColor, 0.45)}`,
                        }}
                      >
                        {candidate.symbolNumber}
                      </span>
                    </div>

                    {/* 2. Party Name Colored Tag Badge */}
                    <div className="w-[82px] shrink-0 py-2.5 px-1.5 flex items-center justify-center border-r-2 border-slate-900 text-center">
                      <span
                        className="px-1.5 py-1 rounded-lg border text-[11px] font-bold whitespace-normal break-keep break-words leading-snug"
                        style={{
                          color: candidateColor,
                          borderColor: hexWithAlpha(candidateColor, 0.45),
                          backgroundColor: hexWithAlpha(candidateColor, 0.1),
                        }}
                      >
                        {displayParty}
                      </span>
                    </div>

                    {/* 3. Candidate Name & Pure Description Column (Zero Truncation) */}
                    <div className="flex-1 min-w-0 py-2.5 px-2.5 flex flex-col justify-center border-r-2 border-slate-900 text-left">
                      <span className="text-sm font-bold text-slate-950 whitespace-normal break-keep break-words leading-snug">
                        {candidate.title}
                      </span>
                      {displayDesc && (
                        <span className="text-xs text-slate-600 mt-1 whitespace-normal break-keep break-words leading-snug">
                          {displayDesc}
                        </span>
                      )}
                    </div>

                    {/* 4. Stamp Target Cell */}
                    <div
                      onClick={(e) => handleSelectCandidate(candidate.id, e)}
                      className="w-14 shrink-0 py-2.5 relative flex items-center justify-center cursor-pointer p-1 group"
                    >
                      {/* Circle guide outline inside stamp box */}
                      <div
                        className={`w-10 h-10 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-red-600 bg-red-50'
                            : 'border-slate-300 group-hover:border-red-300 group-hover:bg-red-50/30'
                        }`}
                      >
                        {!isSelected && (
                          <span className="text-[10px] text-slate-400 group-hover:text-red-500 font-bold transition">
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
                            className="w-11 h-11 text-[#dc2626] filter drop-shadow-[0_1px_2px_rgba(220,38,38,0.3)]"
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

          {/* Bottom Security Mark & Seal */}
          <div className="relative shrink-0 flex items-center justify-between gap-2 border-t border-slate-300 pt-2.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 text-slate-600 min-w-0">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="whitespace-normal break-keep break-words leading-snug">
                선거법에 의거하여 기표소 내 촬영 및 공개는 엄격히 금지됩니다.
              </span>
            </div>
            <div className="shrink-0 font-serif font-bold text-red-700 tracking-wider border border-red-400 px-2 py-0.5 rounded text-[10px]">
              가상선거관리위원회
            </div>
          </div>

          {/* Fixed Bottom Fold Button */}
          <div className="relative shrink-0 mt-3">
            <button
              type="button"
              disabled={!selectedCandidateId || isFolding}
              onClick={handleFoldBallot}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-bold text-sm shadow-xl transition cursor-pointer ${
                selectedCandidateId
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 active:scale-[0.98]'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-5 h-5 shrink-0" />
              <span className="whitespace-normal break-keep break-words leading-snug">
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
