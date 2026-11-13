import React from 'react';
import { DoorOpen, BarChart3, Vote, RotateCcw, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { sounds } from '../sound';

interface ExitModalProps {
  pollTitle: string;
  hasVoted: boolean;
  totalVotes: number;
  onOpenResults: () => void;
  onOpenLobby: () => void;
  onRevote: () => void;
  onClose: () => void;
}

export const ExitModal: React.FC<ExitModalProps> = ({
  pollTitle,
  hasVoted,
  totalVotes,
  onOpenResults,
  onOpenLobby,
  onRevote,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl text-slate-100 relative">
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          aria-label="닫기"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${
              hasVoted
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
            }`}
          >
            <DoorOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              EXIT · 투표소 출구 안내
            </span>
            <h2 className="text-lg font-extrabold text-white truncate">{pollTitle}</h2>
          </div>
        </div>

        {hasVoted ? (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 mb-5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                <p className="font-bold text-emerald-300 mb-1">투표에 참여해 주셔서 감사합니다!</p>
                <p className="text-slate-300 text-xs">
                  현재 총 <strong className="text-white">{totalVotes}표</strong>가 집계되었습니다. 개표현황과 방명록을 확인하거나 다른 투표소로 이동할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 mb-5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                <p className="font-bold text-amber-300 mb-1">아직 투표를 완료하지 않으셨습니다.</p>
                <p className="text-slate-300 text-xs">
                  투표를 마치고 퇴장하시거나 다른 투표소로 이동하시겠습니까?
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          {hasVoted && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onOpenResults();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" />
              <span>개표현황 · 방명록 보기</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onOpenLobby();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-sky-600/20 transition cursor-pointer"
          >
            <Vote className="w-4 h-4" />
            <span>다른 투표소 가기 (로비 이동)</span>
          </button>

          {hasVoted && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onRevote();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
              <span>재투표하기</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-xs transition cursor-pointer"
          >
            {hasVoted ? '투표소에 머무르기' : '돌아가서 계속 투표하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
