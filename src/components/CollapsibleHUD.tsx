import React, { useState } from 'react';
import { StationZone } from '../types';
import { sounds } from '../sound';
import {
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  FileCheck,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Keyboard,
  Vote,
  Layers,
} from 'lucide-react';

interface CollapsibleHUDProps {
  currentStep: number; // 1: Desk, 2: Booth, 3: Box, 4: Billboard
  activeZoneNear: StationZone | null;
  onInteract: () => void;
  hasVoted: boolean;
  onOpenCertificate: () => void;
  onReset: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  nickname: string;
  pollTitle?: string;
  onOpenLobby?: () => void;
  totalVoters?: number;
  maxVoters?: number;
  isOfficial?: boolean;
  activeChannelIndex?: number;
  channelVotes?: number;
  cumulativeVotes?: number;
}

export const CollapsibleHUD: React.FC<CollapsibleHUDProps> = ({
  currentStep,
  activeZoneNear,
  onInteract,
  hasVoted,
  onOpenCertificate,
  onReset,
  isMuted,
  onToggleMute,
  nickname,
  pollTitle,
  onOpenLobby,
  totalVoters,
  maxVoters,
  isOfficial,
  activeChannelIndex = 1,
  channelVotes = 0,
  cumulativeVotes = 0,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const steps = [
    { num: 1, title: '본인확인', sub: '전자서명 및 용지교부' },
    { num: 2, title: '기표소', sub: '비밀투표 날인' },
    { num: 3, title: '투표함', sub: '투표용지 투입' },
    { num: 4, title: '개표현황', sub: '실시간 집계 및 확인증' },
  ];

  // Dynamic action prompt label based on zone
  const getPromptLabel = () => {
    switch (activeZoneNear) {
      case 'desk':
        return currentStep === 1 ? '본인 확인 서명하기' : '교부대 안내 확인';
      case 'booth':
        return currentStep === 2 ? '기표소 입장 및 투표하기' : '기표소 살펴보기';
      case 'box':
        return currentStep === 3 ? '투표함에 용지 넣기' : '투표함 살펴보기';
      case 'billboard':
        return '실시간 개표 결과 보기';
      default:
        return '상호작용';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {/* Top Header / Progress Timeline */}
      <div className="absolute top-3 inset-x-3 sm:inset-x-8 flex flex-col items-center pointer-events-auto">
        <div className="w-full max-w-4xl bg-slate-900/85 border border-slate-700/80 rounded-2xl shadow-xl p-3 sm:p-4 backdrop-blur-md">
          {/* Top Info Bar */}
          <div className="flex items-center justify-between mb-2.5 px-1 text-xs gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
              <span className="font-bold text-white text-sm shrink-0">3D 가상 투표소</span>
              {pollTitle && (
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-sky-300 font-semibold truncate max-w-[180px] border border-slate-700">
                  {pollTitle}
                </span>
              )}

              {/* Official 100-voter channel badge or custom voter count */}
              {isOfficial ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40">
                  <Layers className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>
                    제{activeChannelIndex}투표소 • {channelVotes} / 100명 (누적 {cumulativeVotes}명)
                  </span>
                </span>
              ) : (
                totalVoters !== undefined && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                      totalVoters >= (maxVoters || 100)
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 font-bold'
                        : 'bg-slate-800 text-emerald-300 border-slate-700'
                    }`}
                  >
                    참여 {totalVoters} / {maxVoters || 100}명
                    {totalVoters >= (maxVoters || 100) && ' (정원 마감)'}
                  </span>
                )
              )}

              <span className="text-slate-400 hidden xl:inline shrink-0">| 선거인:</span>
              <span className="text-sky-300 font-semibold hidden xl:inline truncate max-w-[220px]">{nickname}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onOpenLobby && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenLobby();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-200 font-bold hover:bg-sky-500/30 transition cursor-pointer text-xs"
                  title="다른 투표소 안건 선택 로비로 이동"
                >
                  <Vote className="w-3.5 h-3.5" />
                  <span>다른 투표소 가기</span>
                </button>
              )}

              {hasVoted && (
                <button
                  type="button"
                  onClick={onOpenCertificate}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold hover:bg-emerald-500/30 transition cursor-pointer text-xs"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>투표확인증</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer rounded-lg hover:bg-slate-800"
                title="조작법 안내"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4-Step Process Pipeline */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3 text-center">
            {steps.map((s) => {
              const isPast = s.num < currentStep;
              const isCurrent = s.num === currentStep;

              return (
                <div
                  key={s.num}
                  className={`p-2 rounded-xl border transition-all ${
                    isCurrent
                      ? 'bg-sky-500/15 border-sky-400 text-sky-200 ring-1 ring-sky-400/30 shadow-sm'
                      : isPast
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-sky-500 text-white'
                          : isPast
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {s.num}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white truncate">
                      {s.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 hidden sm:block truncate">
                    {s.sub}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Action Trigger Prompt (within 1.8 units) */}
      {activeZoneNear && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-16 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onInteract();
            }}
            className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-sm sm:text-base shadow-2xl shadow-blue-500/40 border-2 border-white/20 active:scale-95 transition-all cursor-pointer"
          >
            <Sparkles className="w-5 h-5 text-yellow-300 shrink-0" />
            <span>{getPromptLabel()}</span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-white/20 text-xs font-mono">
              Space 키
            </span>
          </button>
        </div>
      )}

      {/* Help Modal Popup */}
      {showHelp && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-slate-100 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-sky-400" />
              <span>투표소 이용 및 조작 방법</span>
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-300 mb-5 leading-relaxed">
              <li className="flex gap-2">
                <strong className="text-sky-300 shrink-0">이동:</strong>
                <span>PC 키보드 <strong>W, A, S, D</strong> 또는 <strong>방향키</strong> / 모바일 좌측 하단 가상 조이스틱</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-sky-300 shrink-0">상호작용:</strong>
                <span>구역 근처에서 <strong>Spacebar</strong> 또는 화면 중앙의 상호작용 버튼 클릭</span>
              </li>
              <li className="flex gap-2">
                <strong className="text-sky-300 shrink-0">투표 순서:</strong>
                <span>① 본인확인 서명 ➔ ② 기표소 모의투표 ➔ ③ 투표함 투입 ➔ ④ 개표 현황판 확인</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 pointer-events-auto transition-transform duration-300">
        <div className="flex flex-col items-center">
          {/* Collapse / Expand Toggle Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-t-xl bg-slate-900/90 border-t border-x border-slate-700/80 text-[11px] font-semibold text-slate-300 hover:text-white backdrop-blur-sm transition cursor-pointer shadow-md"
          >
            {isCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>컨트롤 바 펼치기</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>시네마 뷰 (숨기기)</span>
              </>
            )}
          </button>

          {/* Main Dock */}
          {!isCollapsed && (
            <div className="w-full flex items-center justify-between gap-3 bg-slate-900/85 border border-slate-700/80 rounded-2xl p-3 shadow-2xl backdrop-blur-md">
              {/* Desktop keyboard hint */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300">
                  W A S D
                </span>
                <span>이동</span>
                <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px] text-slate-300 ml-1">
                  Space
                </span>
                <span>상호작용</span>
              </div>

              {/* Mobile text */}
              <div className="sm:hidden text-xs text-slate-400">
                <span>조이스틱으로 이동</span>
              </div>

              {/* Right dock controls */}
              <div className="flex items-center gap-2">
                {/* Audio Toggle */}
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    isMuted
                      ? 'bg-slate-800 border-slate-700 text-slate-500'
                      : 'bg-sky-500/20 border-sky-400/40 text-sky-400'
                  }`}
                  title={isMuted ? '음소거 해제' : '음소거'}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Reset button */}
                <button
                  type="button"
                  onClick={onReset}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition cursor-pointer"
                  title="체험 처음부터 다시하기"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">다시하기</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
