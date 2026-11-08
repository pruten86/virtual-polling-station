import React, { useState } from 'react';
import { Candidate, PollChannelData } from '../types';
import { sounds } from '../sound';
import {
  Award,
  BarChart3,
  RotateCcw,
  X,
  FileCheck,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { BETA_DISCLAIMER_TEXT } from '../data/presetPolls';

interface ResultsModalProps {
  candidates: Candidate[];
  pollTitle?: string;
  maxVoters?: number;
  userVoteId: string | null;
  onOpenCertificate: () => void;
  onResetVotes: () => void;
  onSwitchPoll?: () => void;
  onClose: () => void;
  isOfficial?: boolean;
  allChannels?: PollChannelData[];
  activeChannelIndex?: number;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  candidates,
  pollTitle,
  maxVoters = 100,
  userVoteId,
  onOpenCertificate,
  onResetVotes,
  onSwitchPoll,
  onClose,
  isOfficial = false,
  allChannels = [],
  activeChannelIndex = 1,
}) => {
  // View mode for official polls: 'cumulative' or channel index number (1, 2, 3...)
  const [selectedChannelView, setSelectedChannelView] = useState<'cumulative' | number>('cumulative');

  // Derive displayed candidates based on selected channel view
  const displayedCandidates: Candidate[] = React.useMemo(() => {
    if (!isOfficial || selectedChannelView === 'cumulative' || allChannels.length === 0) {
      return candidates;
    }
    const targetChannel = allChannels.find((ch) => ch.channelIndex === selectedChannelView);
    if (!targetChannel) return candidates;

    return candidates.map((c) => ({
      ...c,
      votes: targetChannel.votes[c.id] || 0,
    }));
  }, [candidates, isOfficial, selectedChannelView, allChannels]);

  const totalVotes = displayedCandidates.reduce((sum, c) => sum + c.votes, 0);
  const cumulativeTotal = candidates.reduce((sum, c) => sum + c.votes, 0);

  // Sort by vote count descending
  const sorted = [...displayedCandidates].sort((a, b) => b.votes - a.votes);
  const leading = sorted[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-xl sm:max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-7 text-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400 shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-1">
              <span>제4단계: 개표 전광판 (실시간 집계)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {pollTitle || '실시간 모의투표 개표 현황'}
            </h2>
            <p className="text-xs text-slate-400">
              {isOfficial ? (
                <>
                  현재 조회 득표수: <strong className="text-white">{totalVotes}표</strong>
                  <span className="text-sky-300 ml-2 font-semibold">
                    (전체 누적 {cumulativeTotal}표 / {allChannels.length}개 채널 운영 중)
                  </span>
                </>
              ) : (
                <>
                  전체 투표수: <strong className="text-white">{totalVotes} / {maxVoters}표</strong> (개표율 100%)
                  {totalVotes >= maxVoters && (
                    <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      정원 마감
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>

        {/* Official 100-voter Channel Filter Selector */}
        {isOfficial && allChannels.length > 0 && (
          <div className="mb-4 bg-slate-800/60 border border-slate-700/80 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>채널별 개표 현황 선택 (100명 단위 투표소)</span>
              </span>
              <span className="text-[10px] text-slate-400">
                현재 활성: <strong className="text-sky-300">제{activeChannelIndex}투표소</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setSelectedChannelView('cumulative');
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                  selectedChannelView === 'cumulative'
                    ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                    : 'bg-slate-850 text-slate-300 border-slate-700 hover:border-slate-500'
                }`}
              >
                전체 누적 개표 ({cumulativeTotal}표)
              </button>

              {allChannels.map((ch) => (
                <button
                  key={ch.channelIndex}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setSelectedChannelView(ch.channelIndex);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    selectedChannelView === ch.channelIndex
                      ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  제{ch.channelIndex}투표소 ({ch.totalVotes}/100명)
                  {ch.channelIndex === activeChannelIndex && (
                    <span className="ml-1 text-[10px] text-emerald-300 font-extrabold">• 진행중</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 1st Place Leading Banner */}
        {leading && totalVotes > 0 && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 mb-5">
            <Award className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-300">현재 1위 우세: </span>
              <span className="font-extrabold text-white text-sm">
                [기호 {leading.symbolNumber}번] {leading.title}
              </span>
              <span className="text-amber-200 ml-1.5 font-semibold">
                ({Math.round((leading.votes / totalVotes) * 100)}%, {leading.votes}표)
              </span>
            </div>
          </div>
        )}

        {/* Real-time Dynamic Vote Bars (Responsive Grid for up to 10 candidates) */}
        <div
          className={`mb-6 max-h-[52vh] overflow-y-auto pr-1 ${
            displayedCandidates.length > 5
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
              : 'space-y-3'
          }`}
        >
          {displayedCandidates.map((candidate, idx) => {
            const percent = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;
            const isUserChoice = userVoteId === candidate.id;

            const barColors = [
              'bg-gradient-to-r from-rose-500 to-pink-500',
              'bg-gradient-to-r from-blue-500 to-indigo-500',
              'bg-gradient-to-r from-emerald-500 to-teal-500',
              'bg-gradient-to-r from-amber-500 to-yellow-500',
              'bg-gradient-to-r from-purple-500 to-violet-500',
              'bg-gradient-to-r from-cyan-500 to-blue-500',
              'bg-gradient-to-r from-orange-500 to-amber-500',
              'bg-gradient-to-r from-fuchsia-500 to-pink-500',
              'bg-gradient-to-r from-teal-500 to-emerald-500',
              'bg-gradient-to-r from-lime-500 to-green-500',
            ];

            const isCompact = displayedCandidates.length > 5;

            return (
              <div
                key={candidate.id}
                className={`${isCompact ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl border transition-all ${
                  isUserChoice
                    ? 'bg-slate-800/90 border-sky-400/60 ring-1 ring-sky-400/40'
                    : 'bg-slate-800/40 border-slate-700/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {candidate.symbolNumber}
                    </span>
                    <div className="min-w-0 truncate">
                      <span className="text-xs sm:text-sm font-bold text-white truncate block">{candidate.title}</span>
                      <span className="text-[10px] sm:text-xs text-slate-400 truncate block">({candidate.party})</span>
                    </div>
                    {isUserChoice && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 shrink-0">
                        <CheckCircle2 className="w-2.5 h-2.5" /> 내 투표
                      </span>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm sm:text-base font-extrabold text-white font-mono">{percent}%</span>
                    <span className="text-[10px] sm:text-xs text-slate-400 ml-1">({candidate.votes}표)</span>
                  </div>
                </div>

                {/* Progress Track */}
                <div className="w-full h-2.5 rounded-full bg-slate-700/70 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      barColors[idx % barColors.length]
                    }`}
                    style={{ width: `${Math.max(2, percent)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onOpenCertificate();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 cursor-pointer transition"
          >
            <FileCheck className="w-4 h-4" />
            <span>디지털 투표확인증 발급</span>
          </button>

          {onSwitchPoll && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onSwitchPoll();
              }}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-sky-900/60 hover:bg-sky-800 border border-sky-500/40 text-sky-200 font-bold text-xs transition cursor-pointer"
            >
              <span>다른 투표소 가기</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onResetVotes();
            }}
            className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-semibold text-xs transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>투표 초기화</span>
          </button>
        </div>

        {/* Beta Disclaimer Note */}
        <div className="mt-4 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            {BETA_DISCLAIMER_TEXT}
          </p>
        </div>
      </div>
    </div>
  );
};
