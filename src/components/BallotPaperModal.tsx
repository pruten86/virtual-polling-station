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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div
        className={`relative w-full max-w-xl transition-all duration-700 ease-in-out ${
          isFolding
            ? 'scale-75 -rotate-6 opacity-0 translate-y-12'
            : 'scale-100 opacity-100'
        }`}
      >
        {/* Booth privacy indicator banner */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-950/80 border border-emerald-500/30 rounded-t-2xl text-emerald-300 text-xs font-semibold backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>기표소 내부 · 비밀투표 절대 보장</span>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 transition"
          >
            기표소 나가기
          </button>
        </div>

        {/* Realistic Korean Election Ballot Paper */}
        <div className="bg-[#fcfbf7] border-2 border-[#d6cfbe] shadow-2xl p-5 sm:p-7 text-slate-900 rounded-b-2xl relative select-none">
          {/* Subtle paper grain texture pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2d9c8_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none rounded-b-2xl" />

          {/* Ballot Top Header */}
          <div className="relative text-center border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex justify-between items-center text-[11px] text-slate-500 mb-1">
              <span>서울특별시 가상 제1투표구</span>
              <span className="font-mono font-semibold">관리번호: 2026-VOTE-01</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-widest text-slate-900 font-serif">
              투  표  용  지
            </h1>
            <p className="text-xs font-semibold text-slate-700 mt-0.5">
              [ {pollTitle || '제1회 모의선거'} ]
            </p>
          </div>

          {/* Voting Instruction Note */}
          <div className="relative flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs mb-4">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              원하는 후보의 <strong>[기표란]</strong>을 클릭하여 기표용구(<strong>卜</strong>)를 날인한 후, 하단의 <strong>[투표용지 접기]</strong>를 누르세요.
            </span>
          </div>

          {/* Candidates Table (Korean Standard Ballot Grid with Responsive Scroll) */}
          <div className="relative border-2 border-slate-900 bg-white shadow-sm mb-4 rounded-xs overflow-hidden">
            {/* Table Header (Sticky) */}
            <div className="grid grid-cols-12 bg-slate-100 text-xs font-bold text-slate-700 text-center py-2 border-b-2 border-slate-900 sticky top-0 z-10 shadow-xs">
              <div className="col-span-2 border-r-2 border-slate-900">기호</div>
              <div className="col-span-3 border-r-2 border-slate-900">정당명</div>
              <div className="col-span-4 border-r-2 border-slate-900">후보자(메뉴명)</div>
              <div className="col-span-3">기표란</div>
            </div>

            {/* Candidate Rows Container with smooth scroll for up to 10 choices */}
            <div className="max-h-[46vh] sm:max-h-[50vh] overflow-y-auto divide-y-2 divide-slate-900">
              {candidates.map((candidate) => {
                const isSelected = selectedCandidateId === candidate.id;
                const coords = stampCoordinates[candidate.id];
                const isCompact = candidates.length > 5;

                return (
                  <div
                    key={candidate.id}
                    className={`grid grid-cols-12 items-stretch ${
                      isCompact ? 'min-h-[56px]' : 'min-h-[72px]'
                    } transition-colors ${
                      isSelected ? 'bg-red-50/40' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    {/* Symbol Number */}
                    <div className="col-span-2 flex items-center justify-center font-black text-xl sm:text-2xl text-slate-900 border-r-2 border-slate-900 bg-slate-50 font-serif">
                      {candidate.symbolNumber}
                    </div>

                    {/* Party */}
                    <div className="col-span-3 flex flex-col justify-center px-1.5 sm:px-2 py-1.5 border-r-2 border-slate-900 text-center">
                      <span className="text-xs font-bold text-slate-800 line-clamp-2">{candidate.party}</span>
                    </div>

                    {/* Title & Description */}
                    <div className="col-span-4 flex flex-col justify-center px-2.5 sm:px-3 py-1.5 border-r-2 border-slate-900">
                      <span className="text-xs sm:text-sm font-bold text-slate-950 line-clamp-1">{candidate.title}</span>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 leading-tight line-clamp-1">
                        {candidate.subtitle}
                      </span>
                    </div>

                    {/* Stamp Target Cell */}
                    <div
                      onClick={(e) => handleSelectCandidate(candidate.id, e)}
                      className="col-span-3 relative flex items-center justify-center cursor-pointer p-1 group"
                    >
                      {/* Circle guide outline inside stamp box */}
                      <div
                        className={`${
                          isCompact ? 'w-9 h-9 sm:w-10 sm:h-10' : 'w-11 h-11'
                        } rounded-full border-2 border-dashed flex items-center justify-center transition-all ${
                          isSelected
                            ? 'border-red-600 bg-red-50'
                            : 'border-slate-300 group-hover:border-red-300 group-hover:bg-red-50/30'
                        }`}
                      >
                        {!isSelected && (
                          <span className="text-[10px] text-slate-300 group-hover:text-red-400 font-bold transition">
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
                            className={`${isCompact ? 'w-10 h-10 sm:w-11 sm:h-11' : 'w-12 h-12'} text-[#dc2626] filter drop-shadow-[0_1px_2px_rgba(220,38,38,0.3)]`}
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
          <div className="relative flex items-center justify-between border-t border-slate-300 pt-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 text-slate-600">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              <span>선거법에 의거하여 기표소 내 촬영 및 공개는 엄격히 금지됩니다.</span>
            </div>
            <div className="font-serif font-bold text-red-700 tracking-widest border border-red-400 px-2 py-0.5 rounded text-[10px]">
              가상선거관리위원회
            </div>
          </div>

          {/* Fold Button */}
          <div className="mt-5">
            <button
              type="button"
              disabled={!selectedCandidateId || isFolding}
              onClick={handleFoldBallot}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-base shadow-xl transition cursor-pointer ${
                selectedCandidateId
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 active:scale-[0.98]'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-5 h-5" />
              <span>
                {selectedCandidateId
                  ? '투표용지 반으로 접기 (비밀투표 보호)'
                  : '후보를 선택하여 기표해주세요'}
              </span>
              {selectedCandidateId && <ArrowRight className="w-4 h-4 ml-1" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
