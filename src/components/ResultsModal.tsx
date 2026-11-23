import React, { useState, useEffect, useRef } from 'react';
import { Candidate, PollChannelData, ResultVisibility, normalizeResultVisibility } from '../types';
import { sounds } from '../sound';
import {
  Award,
  BarChart3,
  RotateCcw,
  X,
  FileCheck,
  CheckCircle2,
  Layers,
  Radio,
  MessageSquare,
  Send,
  Sparkles,
  Clock,
  User,
  Flag,
  TimerOff,
  Download,
  ScrollText,
  Trophy,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import {
  BETA_DISCLAIMER_TEXT,
  getPollWinnerSummary,
  formatClosedDateTimeDot,
  formatScheduledDeadlineKorean,
} from '../data/presetPolls';
import {
  renderWinnerCertificateCanvas,
  renderFinalResultsCanvas,
  downloadCanvasAsPng,
} from '../utils/officialPollImages';
import {
  supabase,
  isSupabaseConfigured,
} from '../lib/supabase';
import {
  fetchGuestbook,
  postGuestbookMessage,
  subscribeGuestbookRealtime,
  GuestbookMessage,
} from '../lib/voteverseBackend';

interface ResultsModalProps {
  candidates: Candidate[];
  pollTitle?: string;
  pollId?: string;
  maxVoters?: number;
  userVoteId: string | null;
  nickname?: string;
  isClosed?: boolean;
  expiresAt?: number | null;
  isPermanent?: boolean;
  resultVisibility?: ResultVisibility;
  canClosePoll?: boolean;
  isLobbyDirectView?: boolean;
  onClosePollNow?: () => void | Promise<void>;
  onOpenCertificate?: () => void;
  onResetVotes?: () => void;
  onSwitchPoll?: () => void;
  onClose: () => void;
  isOfficial?: boolean;
  allChannels?: PollChannelData[];
  activeChannelIndex?: number;
  onRealtimeCandidateUpdate?: (updatedCandidates: Candidate[]) => void;
  guestbookMessages?: GuestbookMessage[];
  isGuestbookLoading?: boolean;
  onPostGuestbook?: (message: string) => Promise<{ success: boolean; error?: string }>;
  initialOpenOfficialDocs?: boolean;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  candidates,
  pollTitle,
  pollId = 'poll-default',
  maxVoters = 100,
  userVoteId,
  nickname = '선거인',
  isClosed = false,
  expiresAt = null,
  isPermanent = false,
  resultVisibility = 'realtime',
  canClosePoll = false,
  isLobbyDirectView = false,
  onClosePollNow,
  onOpenCertificate,
  onResetVotes,
  onSwitchPoll,
  onClose,
  isOfficial = false,
  allChannels = [],
  activeChannelIndex = 1,
  onRealtimeCandidateUpdate,
  guestbookMessages,
  isGuestbookLoading,
  onPostGuestbook,
  initialOpenOfficialDocs = false,
}) => {
  const isResultsSealed = normalizeResultVisibility(resultVisibility) === 'after_close' && !isClosed;

  // View mode for official polls: 'cumulative' or channel index number (1, 2, 3...)
  const [selectedChannelView, setSelectedChannelView] = useState<'cumulative' | number>('cumulative');

  // Realtime Candidate Tallies state synced with parent
  const [liveCandidates, setLiveCandidates] = useState<Candidate[]>(candidates);

  // Official Winner Certificate & Final Results Announcement Sub-modal
  const [isDocsModalOpen, setIsDocsModalOpen] = useState<boolean>(
    initialOpenOfficialDocs && !isResultsSealed
  );
  const [docsTab, setDocsTab] = useState<'certificate' | 'announcement'>('certificate');
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [isGeneratingDoc, setIsGeneratingDoc] = useState<boolean>(false);
  const latestCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Guestbook state (uses parent App state when provided, or standalone DB state)
  const [internalGuestbook, setInternalGuestbook] = useState<GuestbookMessage[]>([]);
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [commentInput, setCommentInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isClosingPoll, setIsClosingPoll] = useState<boolean>(false);
  const [guestbookError, setGuestbookError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(isSupabaseConfigured);
  const guestbookListRef = useRef<HTMLDivElement | null>(null);

  const isManagedByParent = guestbookMessages !== undefined;
  const guestbook = isManagedByParent ? guestbookMessages : internalGuestbook;
  const loadingGuestbook = isGuestbookLoading !== undefined ? isGuestbookLoading : internalLoading;

  // Sync with prop updates
  useEffect(() => {
    setLiveCandidates(candidates);
  }, [candidates]);

  // Load initial guestbook comments & subscribe if not managed by parent App
  useEffect(() => {
    if (isManagedByParent) return;

    let isMounted = true;
    setInternalLoading(true);
    fetchGuestbook(pollId)
      .then((entries) => {
        if (isMounted) {
          setInternalGuestbook(entries);
        }
      })
      .finally(() => {
        if (isMounted) {
          setInternalLoading(false);
        }
      });

    const unsubscribe = subscribeGuestbookRealtime(pollId, (newEntry) => {
      if (!isMounted) return;
      setInternalGuestbook((prev) => {
        if (prev.some((e) => e.id === newEntry.id)) return prev;
        return [newEntry, ...prev].slice(0, 100);
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [pollId, isManagedByParent]);

  // Supabase Realtime Subscription for poll_options votes
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsRealtimeConnected(false);
      return;
    }

    const channelName = `realtime_poll_${pollId}`;
    const channel = supabase.channel(channelName);

    // 1. Listen strictly for DB updates on poll_options (no local +1 broadcast)
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'poll_options',
          filter: `poll_id=eq.${pollId}`,
        },
        (payload: any) => {
          const updatedRow = payload.new;
          if (updatedRow && updatedRow.id) {
            const nextVotes =
              updatedRow.vote_count !== undefined
                ? Number(updatedRow.vote_count)
                : Number(updatedRow.votes);
            if (!Number.isNaN(nextVotes)) {
              setLiveCandidates((prev) => {
                const next = prev.map((c) =>
                  c.id === updatedRow.id ? { ...c, votes: nextVotes } : c
                );
                if (onRealtimeCandidateUpdate) {
                  onRealtimeCandidateUpdate(next);
                }
                return next;
              });
            }
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          setIsRealtimeConnected(true);
        }
      });

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [pollId, onRealtimeCandidateUpdate]);

  // Handle Guestbook comment submission via DB
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commentInput.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setGuestbookError(null);
    sounds.playClick();

    try {
      if (onPostGuestbook) {
        const res = await onPostGuestbook(trimmed);
        if (res.success) {
          setCommentInput('');
        } else {
          setGuestbookError(res.error || '방명록 등록에 실패했습니다.');
        }
      } else {
        const res = await postGuestbookMessage(pollId, nickname, trimmed);
        if (res.success && res.data) {
          setInternalGuestbook((prev) => [
            res.data!,
            ...prev.filter((item) => item.id !== res.data!.id),
          ]);
          setCommentInput('');
        } else {
          setGuestbookError(res.error || '방명록 등록에 실패했습니다.');
        }
      }
    } catch (err: any) {
      console.warn('Failed to post comment', err);
      setGuestbookError(err?.message || '방명록 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick cheer suggestions
  const quickTags = [
    '🗳️ 소중한 한 표 행사 완료!',
    '👏 공정한 모의투표 응원합니다!',
    '✨ 민주주의의 꽃, 투표!',
    '🔥 우리 팀 최고!',
  ];

  // Derive displayed candidates based on selected channel view
  const displayedCandidates: Candidate[] = React.useMemo(() => {
    if (!isOfficial || selectedChannelView === 'cumulative' || allChannels.length === 0) {
      return liveCandidates;
    }
    const targetChannel = allChannels.find((ch) => ch.channelIndex === selectedChannelView);
    if (!targetChannel) return liveCandidates;

    return liveCandidates.map((c) => ({
      ...c,
      votes: targetChannel.votes[c.id] || 0,
    }));
  }, [liveCandidates, isOfficial, selectedChannelView, allChannels]);

  const totalVotes = displayedCandidates.reduce((sum, c) => sum + c.votes, 0);
  const cumulativeTotal = liveCandidates.reduce((sum, c) => sum + c.votes, 0);
  const winnerSummary = React.useMemo(
    () => getPollWinnerSummary(displayedCandidates),
    [displayedCandidates]
  );

  // Sort by vote count descending
  const sorted = [...displayedCandidates].sort((a, b) => b.votes - a.votes);
  const leading = sorted[0];

  // Generate high-res 1080x1350 Canvas preview whenever official docs modal is open (never while sealed)
  useEffect(() => {
    if (!isDocsModalOpen || isResultsSealed) return;
    let cancelled = false;
    setIsGeneratingDoc(true);

    const payload = {
      pollTitle: pollTitle || '실시간 모의투표 개표 현황',
      candidates: displayedCandidates,
      winnerSummary,
      isClosed,
      closedAt: expiresAt,
      isPermanent,
    };

    const renderPromise =
      docsTab === 'certificate'
        ? renderWinnerCertificateCanvas(payload)
        : renderFinalResultsCanvas(payload);

    renderPromise
      .then((canvas) => {
        if (cancelled) return;
        latestCanvasRef.current = canvas;
        setPreviewDataUrl(canvas.toDataURL('image/png'));
      })
      .finally(() => {
        if (!cancelled) setIsGeneratingDoc(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDocsModalOpen, isResultsSealed, docsTab, pollTitle, displayedCandidates, winnerSummary, isClosed, expiresAt, isPermanent]);

  const handleDownloadOfficialImage = async () => {
    sounds.playClick();
    const filename =
      docsTab === 'certificate'
        ? 'voteverse-winner-certificate.png'
        : 'voteverse-final-results.png';

    if (latestCanvasRef.current) {
      downloadCanvasAsPng(latestCanvasRef.current, filename);
      return;
    }

    const payload = {
      pollTitle: pollTitle || '실시간 모의투표 개표 현황',
      candidates: displayedCandidates,
      winnerSummary,
      isClosed,
      closedAt: expiresAt,
      isPermanent,
    };
    const canvas =
      docsTab === 'certificate'
        ? await renderWinnerCertificateCanvas(payload)
        : await renderFinalResultsCanvas(payload);
    downloadCanvasAsPng(canvas, filename);
  };

  const formatRelativeTime = (isoString: string): string => {
    try {
      const diffSecs = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSecs < 10) return '방금 전';
      if (diffSecs < 60) return `${diffSecs}초 전`;
      const diffMins = Math.floor(diffSecs / 60);
      if (diffMins < 60) return `${diffMins}분 전`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      return `${Math.floor(diffHours / 24)}일 전`;
    } catch {
      return '최근';
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md">
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
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
              isClosed
                ? 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                : 'bg-orange-500/20 border-orange-400/30 text-orange-400'
            }`}
          >
            {isClosed ? <Flag className="w-6 h-6" /> : <BarChart3 className="w-6 h-6" />}
          </div>
          <div className="min-w-0 pr-8">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                {isClosed ? '최종 개표 확정 결과' : '제4단계: 개표 전광판'}
              </span>

              {isClosed && (
                <>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 text-[11px] font-extrabold">
                    🏁 투표 마감 · 개표 완료
                  </span>
                  {expiresAt && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 border border-rose-500/40 text-rose-300 text-[11px] font-bold">
                      🕒 {formatClosedDateTimeDot(expiresAt)}
                    </span>
                  )}
                </>
              )}

              {!isClosed && isPermanent && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-[11px] font-bold">
                  ♾️ 상시 운영 (기한 제한 없음)
                </span>
              )}

              {!isClosed && !isPermanent && expiresAt && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/35 text-amber-200 text-[11px] font-semibold">
                  🕒 {formatScheduledDeadlineKorean(expiresAt)}
                </span>
              )}

              {isResultsSealed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-extrabold">
                  🔒 마감 후 공개
                </span>
              )}

              {/* Realtime Live Indicator */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isRealtimeConnected
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <Radio className="w-3 h-3" />
                <span>
                  {isRealtimeConnected
                    ? '실시간 연동 중'
                    : '실시간 로컬 동기화'}
                </span>
              </span>
            </div>

            <h2 className="text-lg sm:text-2xl font-bold text-white whitespace-normal break-keep break-words leading-snug">
              {pollTitle || '실시간 모의투표 개표 현황'}
            </h2>
            <p className="text-xs text-slate-400">
              {isResultsSealed ? (
                <>
                  현재 참여 인원: <strong className="text-white">{totalVotes} / {maxVoters}명</strong>
                  <span className="text-amber-300 ml-1.5 font-semibold">
                    (후보별 득표 현황은 마감 후 일괄 공개)
                  </span>
                </>
              ) : isOfficial ? (
                <>
                  현재 조회 득표수: <strong className="text-white">{totalVotes}표</strong>
                  <span className="text-sky-300 ml-2 font-semibold">
                    (전체 누적 {cumulativeTotal}표 · {allChannels.length}개 채널 · {isClosed ? '개표 완료 (100%)' : '실시간 집계 중'})
                  </span>
                </>
              ) : (
                <>
                  전체 투표수: <strong className="text-white">{totalVotes} / {maxVoters}표</strong> ({isClosed ? '개표 완료 (100%)' : '실시간 집계 중'})
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

        {isResultsSealed ? (
          /* Sealed Ballot Box View (Strictly hides candidate votes, percentages, rankings, and docs export before close) */
          <div className="mb-5 rounded-2xl bg-gradient-to-b from-slate-800/95 via-slate-900/95 to-slate-950 border-2 border-amber-400/40 p-5 sm:p-6 text-center shadow-inner">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border-2 border-amber-400/50 flex items-center justify-center text-amber-300 mb-3 shadow-lg shadow-amber-950/40">
              <Lock className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[11px] font-extrabold mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>투표함 봉인 · 비밀 개표 정책 적용 중</span>
            </div>

            <h3 className="text-base sm:text-lg font-extrabold text-white whitespace-normal break-keep leading-snug mb-1.5">
              🔒 비밀 개표 진행 중 — 마감 후 결과가 공개됩니다
            </h3>
            <p className="text-xs text-slate-300 whitespace-normal break-keep leading-relaxed max-w-md mx-auto mb-4">
              공정한 의사결정을 위해 투표 마감 전까지 후보별 득표수, 득표율, 순위 및 1위 현황은 모두 비공개로 봉인됩니다.
              마감 시각이 되거나 방장이 개표를 확정하면 즉시 전체 결과가 공개됩니다.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto text-left">
              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 px-3.5 py-2.5">
                <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                  현재 총 참여 인원
                </span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-300 font-mono">
                  {totalVotes}명
                  <span className="text-xs text-slate-400 font-semibold ml-1">
                    / 정원 {maxVoters}명
                  </span>
                </span>
              </div>

              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 px-3.5 py-2.5">
                <span className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                  개표 결과 공개 예정 시각
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-amber-300 block leading-snug">
                  {expiresAt
                    ? formatScheduledDeadlineKorean(expiresAt)
                    : '방장 개표 확정 시 즉시 공개'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Official 100-voter Channel Filter Selector */}
            {isOfficial && allChannels.length > 0 && (
              <div className="mb-4 bg-slate-800/60 border border-slate-700/80 rounded-xl p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>제N투표소 (100명 단위 실시간 분할)</span>
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

            {/* 1st Place / Final Result Banner + Official Certificate & Results Card Trigger */}
            {isClosed && !winnerSummary.hasVotes ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/80 border border-slate-600/60 mb-4">
                <div className="flex items-center gap-3">
                  <Flag className="w-5 h-5 text-slate-400 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-200">최종 개표 결과: </span>
                    <span className="font-extrabold text-slate-300 text-sm">투표 없음 (0표)</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setDocsTab('announcement');
                    setIsDocsModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-extrabold text-xs transition cursor-pointer shrink-0 active:scale-95"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-300" />
                  <span>🏆 당선증 · 개표공고문 이미지 발급</span>
                </button>
              </div>
            ) : leading && totalVotes > 0 ? (
              <div
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border mb-4 ${
                  isClosed
                    ? 'bg-gradient-to-r from-emerald-500/20 via-amber-500/15 to-orange-500/15 border-emerald-400/50'
                    : 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-amber-500/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Award className={`w-6 h-6 shrink-0 ${isClosed ? 'text-emerald-300' : 'text-amber-400'}`} />
                  <div className="text-xs min-w-0">
                    <span className={`font-bold ${isClosed ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {isClosed
                        ? winnerSummary.isTie
                          ? '🏆 최종 확정 결과 (공동 1위): '
                          : '🏆 최종 확정 결과 (1위): '
                        : winnerSummary.isTie
                        ? '현재 공동 1위: '
                        : '현재 1위 우세: '}
                    </span>
                    <span className="font-extrabold text-white text-sm">
                      {winnerSummary.winners
                        .map((w) => `[기호 ${w.symbolNumber}번] ${w.title}`)
                        .join(' · ')}
                    </span>
                    <span className="text-amber-200 ml-1.5 font-semibold">
                      ({winnerSummary.percent}%, {winnerSummary.maxVotes}표)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setDocsTab('certificate');
                    setIsDocsModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-xs shadow-md shadow-amber-900/30 transition cursor-pointer shrink-0 active:scale-95"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>🏆 당선증 · 개표공고문 이미지 발급</span>
                </button>
              </div>
            ) : null}

            {/* Real-time Dynamic Vote Bars (Responsive Grid for up to 10 candidates) */}
            <div
              className={`mb-5 max-h-[38vh] overflow-y-auto pr-1 ${
                displayedCandidates.length > 5
                  ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
                  : 'space-y-2.5'
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
                    className={`${isCompact ? 'p-2 sm:p-2.5' : 'p-3'} rounded-xl border transition-all ${
                      isUserChoice
                        ? 'bg-slate-800/90 border-sky-400/60 ring-1 ring-sky-400/40'
                        : 'bg-slate-800/40 border-slate-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-slate-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                          {candidate.symbolNumber}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-bold text-white whitespace-normal break-keep break-words leading-snug block">
                            {candidate.title}
                          </span>
                          <span className="text-[10px] sm:text-xs text-slate-400 whitespace-normal break-keep break-words leading-snug block">
                            ({candidate.party})
                          </span>
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
                    <div className="w-full h-2 rounded-full bg-slate-700/70 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          barColors[idx % barColors.length]
                        }`}
                        style={{ width: `${Math.max(2, percent)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 💬 Voter Guestbook (유권자 한마디 & 실시간 응원 방명록) */}
        <div className="mb-5 bg-slate-850 border border-slate-700/80 rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                유권자 한마디 방명록
              </h3>
              <span className="text-[11px] text-slate-400">({guestbook.length}개)</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>실시간 소통</span>
            </div>
          </div>

          {/* Quick Cheer Tag Chips */}
          <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1 scrollbar-none">
            {quickTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setCommentInput(tag);
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 hover:text-white shrink-0 transition cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Comment Input Form */}
          <form onSubmit={handleCommentSubmit} className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => {
                  setCommentInput(e.target.value);
                  if (guestbookError) setGuestbookError(null);
                }}
                maxLength={100}
                placeholder={`[${nickname}] 소감이나 응원을 남겨보세요 (최대 100자)`}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!commentInput.trim() || isSubmitting}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? '등록 중...' : '등록'}</span>
            </button>
          </form>

          {guestbookError && (
            <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">
              {guestbookError}
            </div>
          )}

          {/* Rolling / Scrollable Comments Feed */}
          <div
            ref={guestbookListRef}
            className="space-y-2 max-h-36 overflow-y-auto pr-1 text-xs mt-1"
          >
            {loadingGuestbook && guestbook.length === 0 ? (
              <div className="text-center py-4 text-slate-400 text-xs">
                방명록을 불러오는 중입니다...
              </div>
            ) : guestbook.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-xs">
                첫 번째 응원 한마디를 남겨보세요!
              </div>
            ) : (
              guestbook.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-800/70 border border-slate-700/60 rounded-lg p-2.5 flex items-start justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <User className="w-3 h-3 text-sky-400" />
                      <span className="font-bold text-slate-200 text-[11px] truncate">
                        {entry.display_name}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5 ml-auto">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(entry.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs break-words leading-relaxed">
                      {entry.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
          {!isLobbyDirectView && onOpenCertificate && (
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
          )}

          {canClosePoll && !isClosed && onClosePollNow && (
            <button
              type="button"
              disabled={isClosingPoll}
              onClick={async () => {
                sounds.playClick();
                setIsClosingPoll(true);
                try {
                  await onClosePollNow();
                } finally {
                  setIsClosingPoll(false);
                }
              }}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/50 text-rose-200 font-bold text-xs transition cursor-pointer disabled:opacity-60"
            >
              <TimerOff className="w-4 h-4 text-rose-300" />
              <span>{isClosingPoll ? '마감 처리 중...' : '⏱️ 즉시 투표 마감 (개표 확정)'}</span>
            </button>
          )}

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

          {!isLobbyDirectView && !isClosed && onResetVotes && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onResetVotes();
              }}
              className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-semibold text-xs transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>재투표하기</span>
            </button>
          )}

          {isLobbyDirectView && (
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs transition cursor-pointer"
            >
              <span>로비로 돌아가기</span>
            </button>
          )}
        </div>

        {/* Beta Disclaimer Note */}
        <div className="mt-4 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            {BETA_DISCLAIMER_TEXT}
          </p>
        </div>
      </div>

      {/* Official Winner Certificate & Final Results Announcement PNG Export Modal */}
      {isDocsModalOpen && !isResultsSealed && (
        <div
          onClick={() => {
            sounds.playClick();
            setIsDocsModalOpen(false);
          }}
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-5 bg-slate-950/90 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 sm:px-5 py-3.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-white whitespace-normal break-keep break-words leading-snug">
                    공식 당선증 · 개표 공고문 발급
                  </h3>
                  <p className="text-[11px] text-slate-400 whitespace-normal break-keep break-words leading-snug">
                    1080×1350 고화질 PNG 이미지로 저장해 바로 공유하세요!
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setIsDocsModalOpen(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white text-xs font-bold transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
                <span>닫기</span>
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* 2 Style Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1.5 bg-slate-800/85 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setDocsTab('certificate');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docsTab === 'certificate'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <ScrollText className="w-3.5 h-3.5 shrink-0" />
                  <span>📜 공식 당선증</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setDocsTab('announcement');
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                    docsTab === 'announcement'
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                  <span>📊 개표 결과 확정 공고문</span>
                </button>
              </div>

              {/* WYSIWYG High-Res Preview Frame */}
              <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-slate-950 border border-slate-700/90 flex items-center justify-center shadow-inner">
                {isGeneratingDoc || !previewDataUrl ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                    <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                    <span>고화질 공식 이미지 생성 중...</span>
                  </div>
                ) : (
                  <img
                    src={previewDataUrl}
                    alt={
                      docsTab === 'certificate'
                        ? '보트버스 공식 당선증 미리보기'
                        : '보트버스 개표 결과 확정 공고문 미리보기'
                    }
                    className="w-full h-full object-contain select-none"
                  />
                )}
              </div>

              {/* Download & Close Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleDownloadOfficialImage}
                  disabled={isGeneratingDoc}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/25 transition cursor-pointer active:scale-[0.98] disabled:opacity-60"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>
                    {docsTab === 'certificate'
                      ? '📜 공식 당선증 PNG 저장'
                      : '📊 개표 확정 공고문 PNG 저장'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setIsDocsModalOpen(false);
                  }}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold text-xs transition cursor-pointer"
                >
                  전광판으로 돌아가기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
