import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import confetti from 'canvas-confetti';

import { AvatarType, Candidate, StationZone, PollStation, PollChannelData } from './types';
import { sounds } from './sound';
import { createProceduralAvatar, createNameTagSprite, CharacterController } from './scene/avatar';
import { buildPollingStationEnvironment, EnvironmentResult } from './scene/environment';
import {
  getAllPolls,
  getPollTallies,
  generateRandomNickname,
} from './data/presetPolls';
import {
  ensureAnonymousAuth,
  ensurePresetPollsSeeded,
  ensurePollAndOptionsExist,
  fetchVoteversePolls,
  castVote,
  subscribePollRealtime,
  subscribeAllPollsRealtime,
  checkHasVotedVoteverse,
  fetchPollTalliesFromDB,
  joinMultiplayerRoom,
  MultiplayerRoomHandle,
  fetchGuestbook,
  postGuestbookMessage,
  subscribeGuestbookRealtime,
  GuestbookMessage,
  resetMyVote,
  clearLocalVoteCache,
} from './lib/voteverseBackend';
import { getMultiplayerSessionId } from './lib/supabase';

import { AvatarSelectModal } from './components/AvatarSelectModal';
import { SignatureModal } from './components/SignatureModal';
import { BallotPaperModal } from './components/BallotPaperModal';
import { ResultsModal } from './components/ResultsModal';
import { CertificateModal } from './components/CertificateModal';
import { VirtualJoystick } from './components/VirtualJoystick';
import { CollapsibleHUD } from './components/CollapsibleHUD';
import { ExitModal } from './components/ExitModal';

// Pre-allocated reusable vectors for zero-GC loop
const _playerDir = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetLookAt = new THREE.Vector3();
const _currentCamPos = new THREE.Vector3();
const _currentLookAt = new THREE.Vector3();

// Build official 100-voter channel summary & breakdown strictly from live DB candidate totals
function buildOfficialChannelState(cands: Candidate[]): {
  activeChannelIndex: number;
  channelVotes: number;
  totalCumulativeVotes: number;
  allChannels: PollChannelData[];
} {
  const total = cands.reduce((s, c) => s + (Number(c.votes) || 0), 0);
  const channelCount = Math.floor(total / 100) + 1;
  const activeChannelIndex = channelCount;
  const channelVotes = total % 100;

  const allChannels: PollChannelData[] = [];
  if (total === 0) {
    const emptyVotes: Record<string, number> = {};
    cands.forEach((c) => {
      emptyVotes[c.id] = 0;
    });
    allChannels.push({ channelIndex: 1, votes: emptyVotes, totalVotes: 0 });
  } else {
    const remainingByCand = cands.map((c) => ({ id: c.id, rem: Number(c.votes) || 0 }));
    for (let chIdx = 1; chIdx <= channelCount; chIdx++) {
      const votesMap: Record<string, number> = {};
      cands.forEach((c) => {
        votesMap[c.id] = 0;
      });
      const chCap = chIdx < channelCount ? 100 : channelVotes;
      let chTotal = 0;
      const totalRem = remainingByCand.reduce((s, r) => s + r.rem, 0);
      if (chCap > 0 && totalRem > 0) {
        if (chIdx === channelCount) {
          remainingByCand.forEach((r) => {
            votesMap[r.id] = r.rem;
            chTotal += r.rem;
            r.rem = 0;
          });
        } else {
          let allocated = 0;
          remainingByCand.forEach((r, idx) => {
            if (idx === remainingByCand.length - 1) {
              const take = Math.min(r.rem, chCap - allocated);
              votesMap[r.id] = take;
              r.rem -= take;
              allocated += take;
            } else {
              const share = Math.min(r.rem, Math.floor((r.rem / totalRem) * chCap));
              votesMap[r.id] = share;
              r.rem -= share;
              allocated += share;
            }
          });
          for (const r of remainingByCand) {
            if (allocated >= chCap) break;
            const add = Math.min(r.rem, chCap - allocated);
            if (add > 0) {
              votesMap[r.id] += add;
              r.rem -= add;
              allocated += add;
            }
          }
          chTotal = allocated;
        }
      }
      allChannels.push({ channelIndex: chIdx, votes: votesMap, totalVotes: chTotal });
    }
  }

  return {
    activeChannelIndex,
    channelVotes,
    totalCumulativeVotes: total,
    allChannels,
  };
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // App & Election State
  const [hasEntered, setHasEntered] = useState<boolean>(false);
  const [isLobbyOpen, setIsLobbyOpen] = useState<boolean>(false);
  const [nickname, setNickname] = useState<string>(() => generateRandomNickname());
  const [avatarType, setAvatarType] = useState<AvatarType>('male');

  // All Polls (synced with Supabase DB for Lobby & Realtime)
  const [allPolls, setAllPolls] = useState<PollStation[]>(() => getAllPolls());
  const handlePollsUpdated = useCallback((updated: PollStation[]) => {
    setAllPolls(updated);
  }, []);

  // Currently Selected Polling Station / Poll
  const [currentPoll, setCurrentPoll] = useState<PollStation>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pollQuery = urlParams.get('poll');
      const all = getAllPolls();
      if (pollQuery) {
        const found = all.find((p) => p.id === pollQuery);
        if (found) return found;
      }
      return all[0];
    } catch {
      return getAllPolls()[0];
    }
  });
  const currentPollRef = useRef<PollStation>(currentPoll);
  useEffect(() => {
    currentPollRef.current = currentPoll;
  }, [currentPoll]);

  // Official Channel system state ("온라인 갓바위" 방식 100명 단위 자동 증설)
  const [officialChannelState, setOfficialChannelState] = useState<{
    activeChannelIndex: number;
    channelVotes: number;
    totalCumulativeVotes: number;
    allChannels: PollChannelData[];
  }>(() =>
    currentPoll.isOfficial
      ? buildOfficialChannelState(currentPoll.candidates)
      : {
          activeChannelIndex: 1,
          channelVotes: 0,
          totalCumulativeVotes: 0,
          allChannels: [],
        }
  );

  // Voting Progress Pipeline
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [hasBallot, setHasBallot] = useState<boolean>(false);
  const [hasStamped, setHasStamped] = useState<boolean>(false);
  const [userVoteId, setUserVoteId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean>(false);
  const [voteTimestamp, setVoteTimestamp] = useState<string>('');

  // Candidates & Real-time votes for the current poll
  const [candidates, setCandidates] = useState<Candidate[]>(() =>
    currentPoll.isOfficial ? currentPoll.candidates : getPollTallies(currentPoll)
  );

  // Modal Open States
  const [isSignatureOpen, setIsSignatureOpen] = useState<boolean>(false);
  const [isBallotPaperOpen, setIsBallotPaperOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [isCertificateOpen, setIsCertificateOpen] = useState<boolean>(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState<boolean>(false);

  // Interaction & Nearby Detection
  const [activeZoneNear, setActiveZoneNear] = useState<StationZone | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [guestbookMessages, setGuestbookMessages] = useState<GuestbookMessage[]>([]);
  const [isGuestbookLoading, setIsGuestbookLoading] = useState<boolean>(false);

  // Supabase authenticated anonymous user ID (pre-warmed for DB voting/guestbook)
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  // Per-tab unique ID via sessionStorage so multiple tabs/windows & cross-device users always show as distinct 3D avatars
  const multiplayerPeerId = useRef<string>(getMultiplayerSessionId()).current;

  // Mutable refs for Three.js engine and input
  const playerRef = useRef<CharacterController | null>(null);
  const npcRef = useRef<CharacterController | null>(null);
  const envResultRef = useRef<EnvironmentResult | null>(null);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const joystickVector = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isMovingRef = useRef<boolean>(false);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const ballotDropMeshRef = useRef<THREE.Mesh | null>(null);
  const isDroppingBallotRef = useRef<boolean>(false);
  const ballotDropProgressRef = useRef<number>(0);

  const hasVotedRef = useRef<boolean>(false);
  useEffect(() => {
    hasVotedRef.current = hasVoted;
  }, [hasVoted]);

  const isExitModalOpenRef = useRef<boolean>(false);
  useEffect(() => {
    isExitModalOpenRef.current = isExitModalOpen;
  }, [isExitModalOpen]);
  const hasTouchedExitRef = useRef<boolean>(false);

  // Multiplayer Realtime Room & Remote Avatars Map
  const remoteAvatarsRef = useRef<
    Map<
      string,
      {
        controller: CharacterController;
        nameTag: THREE.Sprite;
        targetX: number;
        targetZ: number;
        targetRotY: number;
        isMoving: boolean;
        lastMoveBroadcastAt?: number;
      }
    >
  >(new Map());
  const roomHandleRef = useRef<MultiplayerRoomHandle | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const lastPresenceTrackTimeRef = useRef<number>(0);
  const lastBroadcastPosRef = useRef<{ x: number; z: number; rotY: number }>({
    x: -6.5,
    z: 0.5,
    rotY: Math.PI,
  });
  const lastPresencePosRef = useRef<{ x: number; z: number; rotY: number }>({
    x: -6.5,
    z: 0.5,
    rotY: Math.PI,
  });
  const lastSentMovingRef = useRef<boolean>(false);

  // Step synchronization with Environment beacon indicators
  useEffect(() => {
    if (envResultRef.current) {
      envResultRef.current.updateBeaconActive(currentStep);
    }
  }, [currentStep]);

  // 2. 컴포넌트 마운트 시 ensureAnonymousAuth() 호출 및 공식 투표소 3개 DB 자동 시드/조회
  useEffect(() => {
    let isMounted = true;
    ensureAnonymousAuth().then((uid) => {
      if (isMounted && uid) {
        setAuthUserId(uid);
      }
    });

    ensurePresetPollsSeeded()
      .then(() => fetchVoteversePolls())
      .then((fetched) => {
        if (!isMounted || !fetched || fetched.length === 0) return;
        setAllPolls(fetched);

        const activeId = currentPollRef.current.id;
        const matched = fetched.find((p) => p.id === activeId);
        if (matched) {
          setCurrentPoll(matched);
          setCandidates(matched.candidates);
          if (matched.isOfficial) {
            setOfficialChannelState(buildOfficialChannelState(matched.candidates));
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Global Realtime subscription for all poll_options across every poll (keeps Lobby & active poll synchronized)
  useEffect(() => {
    const unsubscribeAll = subscribeAllPollsRealtime(({ pollId, optionId, votes }) => {
      setAllPolls((prevPolls) =>
        prevPolls.map((p) =>
          p.id !== pollId
            ? p
            : {
                ...p,
                candidates: p.candidates.map((c) =>
                  c.id === optionId ? { ...c, votes } : c
                ),
              }
        )
      );

      if (pollId === currentPollRef.current.id) {
        setCandidates((prev) => {
          const next = prev.map((c) => (c.id === optionId ? { ...c, votes } : c));
          if (currentPollRef.current.isOfficial) {
            setOfficialChannelState(buildOfficialChannelState(next));
          }
          return next;
        });
        setCurrentPoll((prev) =>
          prev.id === pollId
            ? {
                ...prev,
                candidates: prev.candidates.map((c) =>
                  c.id === optionId ? { ...c, votes } : c
                ),
              }
            : prev
        );
      }
    });

    return () => {
      unsubscribeAll();
    };
  }, []);

  // Synchronize user vote status for the current poll
  useEffect(() => {
    let isMounted = true;
    checkHasVotedVoteverse(currentPoll.id).then((already) => {
      if (!isMounted) return;
      if (already) {
        setHasVoted(true);
        setCurrentStep(4);
      } else {
        setHasVoted(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentPoll.id]);

  // Fetch authoritative candidate tallies from Supabase DB
  const syncTalliesFromDB = useCallback(async (poll: PollStation, base: Candidate[]) => {
    const dbCandidates = await fetchPollTalliesFromDB(poll.id, base);
    if (dbCandidates) {
      setCandidates(dbCandidates);
      setCurrentPoll((prev) =>
        prev.id === poll.id ? { ...prev, candidates: dbCandidates } : prev
      );
      setAllPolls((prev) =>
        prev.map((p) => (p.id === poll.id ? { ...p, candidates: dbCandidates } : p))
      );

      const dbTotal = dbCandidates.reduce((s, c) => s + c.votes, 0);

      // If DB totalVotes is 0 (DB wiped/reset), clear stale localStorage voted state so user can vote again
      if (dbTotal === 0) {
        let hadLocalVote = false;
        try {
          hadLocalVote = localStorage.getItem(`vps_user_voted_${poll.id}`) === 'true';
        } catch {
          hadLocalVote = false;
        }
        clearLocalVoteCache(poll.id);
        if (hadLocalVote || hasVotedRef.current) {
          setHasVoted(false);
          setHasBallot(false);
          setHasStamped(false);
          setUserVoteId(null);
          setVoteTimestamp('');
          setCurrentStep(1);
        }
      }

      if (poll.isOfficial) {
        setOfficialChannelState(buildOfficialChannelState(dbCandidates));
      }
    }
  }, []);

  // 4. ResultsModal(개표 전광판)이 켜져 있거나 투표소 진입 시 DB 조회 및 subscribePollRealtime을 등록해 실시간으로 후보자 득표수(candidates.votes)가 갱신되게 처리
  useEffect(() => {
    if (!hasEntered && !isResultsOpen) return;

    const activePoll = currentPollRef.current;
    syncTalliesFromDB(activePoll, activePoll.candidates);

    const unsubscribe = subscribePollRealtime(activePoll.id, ({ optionId, votes }) => {
      setCandidates((prev) => {
        const next = prev.map((c) => (c.id === optionId ? { ...c, votes } : c));
        if (currentPollRef.current.isOfficial) {
          setOfficialChannelState(buildOfficialChannelState(next));
        }
        return next;
      });
      setAllPolls((prevPolls) =>
        prevPolls.map((p) =>
          p.id !== activePoll.id
            ? p
            : {
                ...p,
                candidates: p.candidates.map((c) =>
                  c.id === optionId ? { ...c, votes } : c
                ),
              }
        )
      );
    });

    return () => {
      unsubscribe();
    };
  }, [currentPoll.id, hasEntered, isResultsOpen, syncTalliesFromDB]);

  // Guestbook DB load & Supabase Realtime INSERT subscription
  useEffect(() => {
    if (!hasEntered && !isResultsOpen) return;

    let isMounted = true;
    setIsGuestbookLoading(true);

    fetchGuestbook(currentPoll.id)
      .then((entries) => {
        if (isMounted) {
          setGuestbookMessages(entries);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsGuestbookLoading(false);
        }
      });

    const unsubscribeGuestbook = subscribeGuestbookRealtime(currentPoll.id, (newEntry) => {
      if (!isMounted) return;
      setGuestbookMessages((prev) => {
        if (prev.some((e) => e.id === newEntry.id)) return prev;
        return [newEntry, ...prev].slice(0, 100);
      });
    });

    return () => {
      isMounted = false;
      unsubscribeGuestbook();
    };
  }, [currentPoll.id, hasEntered, isResultsOpen]);

  const handlePostGuestbook = useCallback(
    async (message: string): Promise<{ success: boolean; error?: string }> => {
      const res = await postGuestbookMessage(currentPoll.id, nickname, message);
      if (res.success && res.data) {
        setGuestbookMessages((prev) => [
          res.data!,
          ...prev.filter((item) => item.id !== res.data!.id),
        ]);
      }
      return { success: res.success, error: res.error };
    },
    [currentPoll.id, nickname]
  );

  // Sync billboard & banner with latest candidate tallies and poll title
  useEffect(() => {
    if (envResultRef.current) {
      const total = candidates.reduce((s, c) => s + c.votes, 0);
      const results = candidates.map((c) => ({
        id: c.id,
        title: c.title,
        votes: c.votes,
        percent: total > 0 ? Math.round((c.votes / total) * 100) : 0,
      }));
      envResultRef.current.updateBillboardTexture(results, total, currentPoll.title);
      envResultRef.current.updateBannerTitle(currentPoll.title);
    }
  }, [candidates, currentPoll]);

  // Show quick toast notification
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // 1. Supabase Realtime Presence & Broadcast Multiplayer Room Connection (using per-tab multiplayerPeerId)
  useEffect(() => {
    if (!hasEntered) return;

    const room = joinMultiplayerRoom(
      currentPoll.id,
      {
        userId: multiplayerPeerId,
        nickname,
        avatarType,
        x: playerRef.current ? playerRef.current.group.position.x : -6.5,
        z: playerRef.current ? playerRef.current.group.position.z : 0.5,
        rotY: playerRef.current ? playerRef.current.group.rotation.y : Math.PI,
      },
      {
        onPresenceSync: (remotePlayers) => {
          setOnlineCount(remotePlayers.length + 1);

          const currentMap = remoteAvatarsRef.current;
          const activeIds = new Set(remotePlayers.map((p) => p.userId));

          // A. Remove avatars of users who left presence
          for (const [id, item] of currentMap.entries()) {
            if (!activeIds.has(id)) {
              if (sceneRef.current) {
                sceneRef.current.remove(item.controller.group);
              }
              currentMap.delete(id);
            }
          }

          // B. Add new remote avatars AND unconditionally update targetX/targetZ/targetRotY for existing avatars
          for (const p of remotePlayers) {
            const existingEntry = currentMap.get(p.userId);
            if (!existingEntry) {
              const controller = createProceduralAvatar(p.avatarType);
              controller.group.position.set(p.x, 0, p.z);
              controller.lookAtAngle(p.rotY);

              const nameTag = createNameTagSprite(p.nickname);
              controller.group.add(nameTag);

              if (sceneRef.current) {
                sceneRef.current.add(controller.group);
              }

              currentMap.set(p.userId, {
                controller,
                nameTag,
                targetX: p.x,
                targetZ: p.z,
                targetRotY: p.rotY,
                isMoving: Boolean(p.isMoving),
              });
            } else {
              existingEntry.targetX = p.x;
              existingEntry.targetZ = p.z;
              existingEntry.targetRotY = p.rotY;
              existingEntry.isMoving = Boolean(p.isMoving);
            }
          }
        },
        onPlayerMove: ({ userId, x, z, rotY, isMoving }) => {
          const entry = remoteAvatarsRef.current.get(userId);
          if (entry) {
            entry.targetX = x;
            entry.targetZ = z;
            entry.targetRotY = rotY;
            entry.isMoving = Boolean(isMoving);
            entry.lastMoveBroadcastAt = performance.now();
          }
        },
        onVoteCast: ({ userId, nickname: voterName }) => {
          // Toast notification ONLY - do NOT locally increment candidate tallies here
          if (userId !== multiplayerPeerId) {
            sounds.playChime();
            showToast(`🗳️ [${voterName}]님이 소중한 한 표를 행사했습니다!`);
          }
        },
      }
    );

    roomHandleRef.current = room;

    return () => {
      room.leave();
      roomHandleRef.current = null;

      // Clean up remote avatars on leaving/switching room
      if (sceneRef.current) {
        for (const item of remoteAvatarsRef.current.values()) {
          sceneRef.current.remove(item.controller.group);
        }
      }
      remoteAvatarsRef.current.clear();
      setOnlineCount(1);
    };
  }, [hasEntered, currentPoll.id, nickname, avatarType, multiplayerPeerId, showToast]);

  const totalVotes = candidates.reduce((s, c) => s + c.votes, 0);
  const maxCapacity = currentPoll.maxVoters || 100;
  // Official polls never reach capacity lock because they auto-expand
  const isCapacityReached = !currentPoll.isOfficial && totalVotes >= maxCapacity;

  // Alias for digital certificate modal visibility
  const setShowCertificate = setIsCertificateOpen;

  // 3. 투표함(Zone 3)에 용지를 넣는 handleCastBallot 함수
  const handleCastBallot = useCallback(async () => {
    if (!userVoteId) {
      showToast('기표된 후보 정보가 없습니다. 2번 기표소에서 기표를 완료해주세요!');
      return;
    }

    const selectedCandidate = candidates.find((c) => c.id === userVoteId) || { id: userVoteId };

    // Strict DB vote recording via castVote(currentPoll.id, selectedCandidate.id, currentPoll)
    const res = await castVote(currentPoll.id, selectedCandidate.id, currentPoll);

    // Block only on genuine DB write error (never show certificate if DB failed)
    if (!res.success) {
      sounds.playWarning();
      const msg = res.message || '투표 저장에 실패했습니다. 잠시 후 다시 시도해주세요.';
      showToast(msg);
      return;
    }

    // Immediately reflect fresh DB tallies returned by castVote across HUD, 3D billboard, ResultsModal & Lobby
    const freshCandidates = res.tallies
      ? candidates.map((c) => ({
          ...c,
          votes: res.tallies![c.id] !== undefined ? res.tallies![c.id] : c.votes,
        }))
      : candidates;

    if (res.tallies) {
      setCandidates(freshCandidates);
      setCurrentPoll((prev) =>
        prev.id === currentPoll.id ? { ...prev, candidates: freshCandidates } : prev
      );
      setAllPolls((prev) =>
        prev.map((p) => (p.id === currentPoll.id ? { ...p, candidates: freshCandidates } : p))
      );
      if (currentPoll.isOfficial) {
        setOfficialChannelState(buildOfficialChannelState(freshCandidates));
      }
    }

    const latestTotal = freshCandidates.reduce((s, c) => s + c.votes, 0);
    const latestChannelIdx = Math.floor(latestTotal / 100) + 1;

    // DB write succeeded: play drop sound & animation, then show certificate & refresh DB tallies
    sounds.playDropSound();
    isDroppingBallotRef.current = true;
    ballotDropProgressRef.current = 0;

    setTimeout(() => {
      // Celebratory Confetti & Victory Chime
      sounds.playChime();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#0284c7', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6'],
      });

      setHasVoted(true);
      setCurrentStep(4);
      const now = new Date();
      const timeStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${String(
        now.getHours()
      ).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setVoteTimestamp(timeStr);

      // Refresh authoritative candidate tallies strictly from Supabase DB
      syncTalliesFromDB(currentPoll, freshCandidates);

      showToast(
        currentPoll.isOfficial
          ? `투표용지가 투입되었습니다! (제${latestChannelIdx}투표소에 기록됨) 4번 개표 전광판을 확인하세요.`
          : '투표함에 투표용지가 투입되었습니다! 4번 개표 전광판에서 실시간 결과를 확인하세요.'
      );

      // 확인증 모달(setShowCertificate) 표시
      setTimeout(() => {
        setShowCertificate(true);
      }, 600);

      // Broadcast vote_cast toast notification to other peers in room
      if (roomHandleRef.current) {
        roomHandleRef.current.broadcastVote(nickname, selectedCandidate.id);
      }
    }, 850);
  }, [
    currentPoll,
    userVoteId,
    candidates,
    showToast,
    setShowCertificate,
    nickname,
    syncTalliesFromDB,
  ]);

  // Handle Station Interaction
  const handleInteract = useCallback(() => {
    if (!hasEntered || isLobbyOpen) return;

    if (activeZoneNear === 'exit') {
      sounds.playClick();
      setIsExitModalOpen(true);
      return;
    }

    // If custom poll has reached its max capacity and user hasn't voted yet, lock voting
    if (isCapacityReached && !hasVoted) {
      if (activeZoneNear === 'billboard') {
        sounds.playClick();
        setIsResultsOpen(true);
      } else if (activeZoneNear) {
        sounds.playClick();
        showToast(
          `[정원 마감] 본 투표소는 최대 정원(${maxCapacity}명)에 도달하여 마감되었습니다. 4번 개표 전광판에서 최종 결과를 확인하세요!`
        );
      }
      return;
    }

    if (activeZoneNear === 'desk') {
      if (!hasBallot) {
        sounds.playClick();
        setIsSignatureOpen(true);
      } else {
        showToast('이미 본인 확인 및 투표용지 교부를 마쳤습니다. 2번 기표소로 이동하세요!');
      }
    } else if (activeZoneNear === 'booth') {
      if (!hasBallot) {
        showToast('먼저 1번 교부대에서 본인 확인 후 투표용지를 수령해주세요!');
      } else if (!hasStamped) {
        sounds.playClick();
        setIsBallotPaperOpen(true);
      } else {
        showToast('이미 기표를 완료하였습니다. 3번 투표함에 접은 투표용지를 넣어주세요!');
      }
    } else if (activeZoneNear === 'box') {
      if (!hasBallot) {
        showToast('먼저 1번 교부대에서 본인 확인 후 투표를 진행해주세요!');
      } else if (!hasStamped) {
        showToast('먼저 2번 기표소에서 비밀투표 후 투표용지를 접어와주세요!');
      } else if (!hasVoted) {
        handleCastBallot();
      } else {
        showToast('이미 소중한 한 표를 행사하셨습니다. 4번 개표 전광판을 확인하세요!');
      }
    } else if (activeZoneNear === 'billboard') {
      sounds.playClick();
      setIsResultsOpen(true);
    }
  }, [hasEntered, isLobbyOpen, activeZoneNear, hasBallot, hasStamped, hasVoted, isCapacityReached, maxCapacity, showToast, handleCastBallot]);

  // Keyboard input listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. If currently typing inside any input, textarea, select, or contenteditable, or modal is active, do NOT intercept
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.isContentEditable;

      if (
        isInput ||
        !hasEntered ||
        isLobbyOpen ||
        isSignatureOpen ||
        isBallotPaperOpen ||
        isResultsOpen ||
        isCertificateOpen ||
        isExitModalOpen
      ) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keysPressed.current[e.key.toLowerCase()] = true;

      if (e.key === ' ' || e.key === 'Spacebar') {
        handleInteract();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable ||
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.tagName === 'SELECT' ||
        activeEl?.isContentEditable;

      if (isInput) return;

      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasEntered, isLobbyOpen, isSignatureOpen, isBallotPaperOpen, isResultsOpen, isCertificateOpen, isExitModalOpen, handleInteract]);

  // Three.js Scene Setup & Render Loop (Initialized ONCE on mount to prevent light duplication)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // Detect software WebGL guard
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Renderer Setup (Calibrated ToneMapping to avoid washed-out whiteout)
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // 2. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    sceneRef.current = scene;

    // Room Environment for soft natural reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 3. Camera Setup (Quarter-view / Isometric angle)
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    // Initial isometric vantage
    camera.position.set(-10.5, 8.2, 8.5);
    camera.lookAt(-6.0, 0.8, -0.5);
    cameraRef.current = camera;

    // 4. Balanced Lighting Rig (Prevents furniture/floor whiteout)
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.15);
    dirLight.position.set(10, 16, 12);
    dirLight.castShadow = !isSoftwareGl;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Soft warm/cool fill light for depth without harsh glare
    const fillLight = new THREE.DirectionalLight(0xdbeafe, 0.35);
    fillLight.position.set(-12, 10, -8);
    scene.add(fillLight);

    // 5. Build Polling Station Architecture
    const envResult = buildPollingStationEnvironment();
    scene.add(envResult.sceneGroup);
    envResultRef.current = envResult;

    // 6. Spawn Procedural Player Avatar at Entrance
    const playerAvatar = createProceduralAvatar(avatarType);
    playerAvatar.group.position.set(-6.5, 0, 0.5);
    playerAvatar.lookAtAngle(Math.PI); // Facing towards verification desk (-Z)
    scene.add(playerAvatar.group);
    playerRef.current = playerAvatar;

    // 7. Spawn Verification Desk NPC Officer (Directly behind the desk at X=-6.5, Z=-5.2, facing +Z)
    const npcAvatar = createProceduralAvatar('npc');
    npcAvatar.group.position.set(-6.5, 0, -5.2);
    npcAvatar.lookAtAngle(0);
    scene.add(npcAvatar.group);
    npcRef.current = npcAvatar;

    // 8. Dedicated 3D Folded Ballot Mesh for Drop Animation (Positioned right above ballot box slot at 5.5, -4.5)
    const ballotGeo = new THREE.BoxGeometry(0.32, 0.02, 0.22);
    const ballotMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
    });
    const ballotDropMesh = new THREE.Mesh(ballotGeo, ballotMat);
    ballotDropMesh.visible = false;
    ballotDropMesh.position.set(5.5, 1.95, -4.5);
    scene.add(ballotDropMesh);
    ballotDropMeshRef.current = ballotDropMesh;

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Animation & Input Render Loop
    const clock = new THREE.Clock();
    let frameId: number;

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.1);

      // Handle Character Movement
      const player = playerRef.current;
      if (player) {
        _playerDir.set(0, 0, 0);

        // Keyboard WASD & Arrow Key Mapping (Quarter-view Aligned)
        const keys = keysPressed.current;
        if (keys['w'] || keys['arrowup']) {
          _playerDir.x += 1;
          _playerDir.z -= 1;
        }
        if (keys['s'] || keys['arrowdown']) {
          _playerDir.x -= 1;
          _playerDir.z += 1;
        }
        if (keys['a'] || keys['arrowleft']) {
          _playerDir.x -= 1;
          _playerDir.z -= 1;
        }
        if (keys['d'] || keys['arrowright']) {
          _playerDir.x += 1;
          _playerDir.z += 1;
        }

        // Virtual Joystick Input Mapping (Screen Space to Isometric Ground)
        const joy = joystickVector.current;
        if (joy.x !== 0 || joy.y !== 0) {
          const isoX = (joy.x - joy.y) * 0.7071;
          const isoZ = (joy.x + joy.y) * 0.7071;
          _playerDir.x += isoX;
          _playerDir.z += isoZ;
        }

        const isMoving = _playerDir.lengthSq() > 0.001;
        isMovingRef.current = isMoving;
        const moveSpeed = 4.8;

        if (isMoving) {
          _playerDir.normalize();

          const nextX = player.group.position.x + _playerDir.x * moveSpeed * delta;
          const nextZ = player.group.position.z + _playerDir.z * moveSpeed * delta;

          // Realistic Boundary Collision Check aligned with actual furniture placements:
          // Room floor bounds: X [-9.8, 9.8], Z [-7.5, 7.5]
          // Desk block: X [-8.8, -4.2], Z [-5.6, -3.8]
          // Booths block: X [-2.2, 2.2], Z [-5.8, -4.2]
          // Ballot table: X [4.4, 6.6], Z [-5.4, -3.8]
          // Billboard: X [5.4, 8.8], Z [0.4, 2.6]
          const isInsideRoom = nextX > -9.8 && nextX < 9.8 && nextZ > -7.5 && nextZ < 7.5;
          const hitsDesk = nextX > -8.8 && nextX < -4.2 && nextZ > -5.6 && nextZ < -3.8;
          const hitsBooths = nextX > -2.2 && nextX < 2.2 && nextZ > -5.8 && nextZ < -4.2;
          const hitsBoxTable = nextX > 4.4 && nextX < 6.6 && nextZ > -5.4 && nextZ < -3.8;
          const hitsBillboard = nextX > 5.4 && nextX < 8.8 && nextZ > 0.4 && nextZ < 2.6;

          if (isInsideRoom && !hitsDesk && !hitsBooths && !hitsBoxTable && !hitsBillboard) {
            player.group.position.x = nextX;
            player.group.position.z = nextZ;
          }

          const targetAngle = Math.atan2(_playerDir.x, _playerDir.z);
          player.lookAtAngle(targetAngle);

          // Footstep Audio
          sounds.playFootstep();
        }

        player.update(isMoving, delta, moveSpeed);

        // Compare actual 3D group coordinates (keyboard OR mobile joystick) & sync via Broadcast (80ms) + Presence (250ms)
        const room = roomHandleRef.current;
        if (room) {
          const now = performance.now();
          const curX = player.group.position.x;
          const curZ = player.group.position.z;
          const curRot = player.group.rotation.y;

          const broadcastDist = Math.hypot(
            curX - lastBroadcastPosRef.current.x,
            curZ - lastBroadcastPosRef.current.z
          );
          const broadcastRotDiff = Math.abs(curRot - lastBroadcastPosRef.current.rotY);

          const presenceDist = Math.hypot(
            curX - lastPresencePosRef.current.x,
            curZ - lastPresencePosRef.current.z
          );
          const presenceRotDiff = Math.abs(curRot - lastPresencePosRef.current.rotY);

          const hasBroadcastDelta = broadcastDist >= 0.01 || broadcastRotDiff >= 0.02;
          const hasPresenceDelta = presenceDist >= 0.01 || presenceRotDiff >= 0.02;

          if (hasBroadcastDelta && now - lastBroadcastTimeRef.current >= 80) {
            lastBroadcastTimeRef.current = now;
            lastBroadcastPosRef.current = { x: curX, z: curZ, rotY: curRot };
            room.sendMove(curX, curZ, curRot, isMoving);
            lastSentMovingRef.current = true;
          }

          if (hasPresenceDelta && now - lastPresenceTrackTimeRef.current >= 250) {
            lastPresenceTrackTimeRef.current = now;
            lastPresencePosRef.current = { x: curX, z: curZ, rotY: curRot };
            room.updatePresence(curX, curZ, curRot, isMoving);
            lastSentMovingRef.current = true;
          }

          if (!isMoving && lastSentMovingRef.current) {
            lastSentMovingRef.current = false;
            lastBroadcastTimeRef.current = now;
            lastPresenceTrackTimeRef.current = now;
            lastBroadcastPosRef.current = { x: curX, z: curZ, rotY: curRot };
            lastPresencePosRef.current = { x: curX, z: curZ, rotY: curRot };
            room.sendMove(curX, curZ, curRot, false);
            room.updatePresence(curX, curZ, curRot, false);
          }
        }

        // Smooth Quarter-view Camera Tracking (Keeps all 4 zones naturally visible)
        _targetCamPos.set(
          player.group.position.x - 3.8,
          player.group.position.y + 7.8,
          player.group.position.z + 7.8
        );
        _targetLookAt.set(
          player.group.position.x + 0.5,
          player.group.position.y + 0.8,
          player.group.position.z - 0.5
        );

        _currentCamPos.copy(camera.position).lerp(_targetCamPos, 0.08);
        _currentLookAt.copy(camera.position).lerp(_targetLookAt, 0.08);

        camera.position.copy(_currentCamPos);
        camera.lookAt(_targetLookAt);

        // 100% Exact Proximity Detection referencing environment.ts stationLocations
        const pos = player.group.position;
        const locations = envResultRef.current?.stationLocations || [
          { zone: 'desk', position: new THREE.Vector3(-6.5, 0, -3.2) },
          { zone: 'booth', position: new THREE.Vector3(0.0, 0, -3.6) },
          { zone: 'box', position: new THREE.Vector3(5.5, 0, -3.3) },
          { zone: 'billboard', position: new THREE.Vector3(6.2, 0, 1.8) },
          { zone: 'exit', position: new THREE.Vector3(8.5, 0, 4.3) },
        ];

        let nearestZone: StationZone | null = null;
        let minDistance = 1.9; // 1.9m interaction radius

        for (const loc of locations) {
          const d = Math.hypot(pos.x - loc.position.x, pos.z - loc.position.z);
          if (d < minDistance) {
            minDistance = d;
            nearestZone = loc.zone;
          }
        }
        setActiveZoneNear(nearestZone);

        // Trigger Exit Modal when touching the Exit glass door (X = 8.5, Z = 5.5)
        const distToExitDoor = Math.hypot(pos.x - 8.5, pos.z - 5.5);
        if (distToExitDoor < 1.15 && !hasTouchedExitRef.current && !isExitModalOpenRef.current) {
          hasTouchedExitRef.current = true;
          sounds.playClick();
          setIsExitModalOpen(true);
        } else if (distToExitDoor > 1.6) {
          hasTouchedExitRef.current = false;
        }
      }

      // Update Remote Players' 3D Avatars (Smooth lerp(0.2) interpolation + walk animation)
      for (const entry of remoteAvatarsRef.current.values()) {
        const dist = Math.hypot(
          entry.targetX - entry.controller.group.position.x,
          entry.targetZ - entry.controller.group.position.z
        );

        entry.controller.group.position.x = THREE.MathUtils.lerp(
          entry.controller.group.position.x,
          entry.targetX,
          0.2
        );
        entry.controller.group.position.z = THREE.MathUtils.lerp(
          entry.controller.group.position.z,
          entry.targetZ,
          0.2
        );

        const curAngle = entry.controller.group.rotation.y;
        let diff = entry.targetRotY - curAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        entry.controller.lookAtAngle(curAngle + diff * 0.22);

        const isRemoteMoving = dist >= 0.03;
        entry.controller.update(isRemoteMoving, delta, 4.8);
      }

      // NPC Officer subtle idle breathing/head turning
      if (npcRef.current) {
        npcRef.current.update(false, delta, 0);
      }

      // Ballot Drop into Slot Animation (Falls straight into ballot box slot at 5.5, -4.5)
      if (isDroppingBallotRef.current && ballotDropMeshRef.current) {
        ballotDropProgressRef.current += delta * 1.8;
        const p = Math.min(1, ballotDropProgressRef.current);

        const startY = 1.95;
        const endY = 1.50;
        const currentY = THREE.MathUtils.lerp(startY, endY, p);

        ballotDropMeshRef.current.visible = true;
        ballotDropMeshRef.current.position.set(5.5, currentY, -4.5);
        ballotDropMeshRef.current.rotation.y = p * Math.PI * 2;
        ballotDropMeshRef.current.rotation.x = Math.sin(p * Math.PI) * 0.2;

        if (p >= 1) {
          isDroppingBallotRef.current = false;
          ballotDropMeshRef.current.visible = false;
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      if (sceneRef.current) {
        for (const item of remoteAvatarsRef.current.values()) {
          sceneRef.current.remove(item.controller.group);
        }
      }
      remoteAvatarsRef.current.clear();
      sceneRef.current = null;
      playerRef.current = null;
      npcRef.current = null;
      envResultRef.current = null;
    };
  }, []); // Run ONCE on mount

  // Update Avatar Model when avatarType changes without tearing down the scene/lights
  useEffect(() => {
    if (sceneRef.current && playerRef.current) {
      const oldPos = playerRef.current.group.position.clone();
      const oldRot = playerRef.current.group.rotation.y;
      sceneRef.current.remove(playerRef.current.group);

      const newAvatar = createProceduralAvatar(avatarType);
      newAvatar.group.position.copy(oldPos);
      newAvatar.lookAtAngle(oldRot);
      sceneRef.current.add(newAvatar.group);
      playerRef.current = newAvatar;
    }
  }, [avatarType]);

  // Handle Entrance or Polling Station Switch from Avatar/Lobby Modal
  const handleEnterWorld = (selectedNickname: string, selectedAvatar: AvatarType, selectedPoll: PollStation) => {
    setNickname(selectedNickname);
    setAvatarType(selectedAvatar);

    if (!authUserId) {
      ensureAnonymousAuth().then((uid) => {
        if (uid) setAuthUserId(uid);
      });
    }

    const isNewPoll = selectedPoll.id !== currentPoll.id;
    setCurrentPoll(selectedPoll);

    // Initialize candidate state from selected poll, ensure DB rows exist, and sync immediately with Supabase DB
    setCandidates(selectedPoll.candidates);
    if (selectedPoll.isOfficial) {
      setOfficialChannelState(buildOfficialChannelState(selectedPoll.candidates));
    } else {
      setOfficialChannelState({
        activeChannelIndex: 1,
        channelVotes: 0,
        totalCumulativeVotes: 0,
        allChannels: [],
      });
    }
    ensurePollAndOptionsExist(selectedPoll).then(() => {
      syncTalliesFromDB(selectedPoll, selectedPoll.candidates);
    });

    // Update URL parameter
    try {
      const url = new URL(window.location.origin + window.location.pathname);
      url.searchParams.set('poll', selectedPoll.id);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }

    if (isNewPoll) {
      // Reset voting flow for the new poll
      setCurrentStep(1);
      setHasBallot(false);
      setHasStamped(false);
      setHasVoted(false);
      setUserVoteId(null);
    }

    if (playerRef.current) {
      playerRef.current.group.position.set(-6.5, 0, 0.5);
      playerRef.current.lookAtAngle(Math.PI);
    }

    setHasEntered(true);
    setIsLobbyOpen(false);

    showToast(`[${selectedPoll.title}] 투표소에 입장했습니다! 1번 교부대로 이동하세요.`);
  };

  // Step 1: Complete Signature
  const handleSignatureComplete = () => {
    setIsSignatureOpen(false);
    setHasBallot(true);
    setCurrentStep(2);
    showToast('본인 확인 완료! 투표용지를 받았습니다. 2번 기표소로 이동하세요.');
  };

  // Step 2: Complete Stamping in Booth
  const handleBallotStamped = (candidateId: string) => {
    setIsBallotPaperOpen(false);
    setUserVoteId(candidateId);
    setHasStamped(true);
    setCurrentStep(3);
    showToast('투표용지를 소중히 접었습니다. 3번 투표함에 넣어주세요!');
  };

  // Re-vote / Reset for current poll (deletes user's DB vote, syncs tallies, resets state & moves avatar to Zone 1)
  const handleResetSimulation = async () => {
    sounds.playClick();
    const res = await resetMyVote(currentPoll.id, userVoteId || undefined);

    setCurrentStep(1);
    setHasBallot(false);
    setHasStamped(false);
    setHasVoted(false);
    setUserVoteId(null);
    setVoteTimestamp('');
    setIsResultsOpen(false);
    setIsCertificateOpen(false);
    setIsExitModalOpen(false);

    if (playerRef.current) {
      playerRef.current.group.position.set(-6.5, 0, -2.3);
      playerRef.current.lookAtAngle(Math.PI);
      lastBroadcastPosRef.current = { x: -6.5, z: -2.3, rotY: Math.PI };
      lastPresencePosRef.current = { x: -6.5, z: -2.3, rotY: Math.PI };
      roomHandleRef.current?.sendMove(-6.5, -2.3, Math.PI, false);
      roomHandleRef.current?.updatePresence(-6.5, -2.3, Math.PI, false);
    }

    await syncTalliesFromDB(currentPoll, currentPoll.candidates);

    if (!res.success && res.error) {
      showToast(`로컬 투표 기록을 초기화했습니다. (DB 알림: ${res.error})`);
    } else {
      showToast('기존 투표가 초기화되었습니다. 1번 본인확인대에서 바로 재투표를 진행하세요!');
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    sounds.isMuted = next;
    setIsMuted(next);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* 3D WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* 1. Initial Avatar Selection & Polling Station Lobby Modal */}
      {(!hasEntered || isLobbyOpen) && (
        <AvatarSelectModal
          initialPollId={currentPoll.id}
          externalPolls={allPolls}
          onPollsUpdated={handlePollsUpdated}
          onEnter={handleEnterWorld}
        />
      )}

      {/* 2. HUD & Step Pipeline Overlay */}
      {hasEntered && !isLobbyOpen && (
        <CollapsibleHUD
          currentStep={currentStep}
          activeZoneNear={activeZoneNear}
          onInteract={handleInteract}
          hasVoted={hasVoted}
          onOpenCertificate={() => {
            sounds.playClick();
            setIsCertificateOpen(true);
          }}
          onReset={handleResetSimulation}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          nickname={nickname}
          pollTitle={currentPoll.title}
          totalVoters={totalVotes}
          maxVoters={maxCapacity}
          isOfficial={currentPoll.isOfficial}
          activeChannelIndex={officialChannelState.activeChannelIndex}
          channelVotes={officialChannelState.channelVotes}
          cumulativeVotes={officialChannelState.totalCumulativeVotes}
          onlineCount={onlineCount}
          onOpenLobby={() => {
            sounds.playClick();
            setIsLobbyOpen(true);
          }}
        />
      )}

      {/* 3. Mobile Virtual Joystick (bottom-left) */}
      {hasEntered && !isLobbyOpen && (
        <div className="absolute bottom-6 left-6 z-30 pointer-events-auto sm:hidden">
          <VirtualJoystick
            onMove={(vec) => {
              joystickVector.current = vec;
            }}
            onStop={() => {
              joystickVector.current = { x: 0, y: 0 };
            }}
          />
        </div>
      )}

      {/* 4. Step 1: Signature Modal */}
      {isSignatureOpen && (
        <SignatureModal
          nickname={nickname}
          onComplete={handleSignatureComplete}
          onClose={() => setIsSignatureOpen(false)}
        />
      )}

      {/* 5. Step 2: Ballot Paper Voting Modal */}
      {isBallotPaperOpen && (
        <BallotPaperModal
          candidates={candidates}
          pollTitle={currentPoll.title}
          onComplete={handleBallotStamped}
          onClose={() => setIsBallotPaperOpen(false)}
        />
      )}

      {/* 6. Step 4: Results Billboard Modal */}
      {isResultsOpen && (
        <ResultsModal
          candidates={candidates}
          pollTitle={currentPoll.title}
          pollId={currentPoll.id}
          nickname={nickname}
          maxVoters={maxCapacity}
          userVoteId={userVoteId}
          isOfficial={currentPoll.isOfficial}
          allChannels={officialChannelState.allChannels}
          activeChannelIndex={officialChannelState.activeChannelIndex}
          onRealtimeCandidateUpdate={(updated) => {
            setCandidates(updated);
            if (currentPoll.isOfficial) {
              setOfficialChannelState(buildOfficialChannelState(updated));
            }
          }}
          guestbookMessages={guestbookMessages}
          isGuestbookLoading={isGuestbookLoading}
          onPostGuestbook={handlePostGuestbook}
          onOpenCertificate={() => {
            setIsResultsOpen(false);
            setIsCertificateOpen(true);
          }}
          onResetVotes={handleResetSimulation}
          onSwitchPoll={() => {
            setIsResultsOpen(false);
            setIsLobbyOpen(true);
          }}
          onClose={() => setIsResultsOpen(false)}
        />
      )}

      {/* 7. Bonus: Digital Certificate Modal */}
      {isCertificateOpen && (
        <CertificateModal
          nickname={nickname}
          avatarType={avatarType}
          pollTitle={currentPoll.title}
          timestamp={voteTimestamp || '2026년 11월 7일 14:30'}
          onClose={() => setIsCertificateOpen(false)}
          onRestart={handleResetSimulation}
        />
      )}

      {/* 8. Exit Door Interaction Modal */}
      {isExitModalOpen && (
        <ExitModal
          pollTitle={currentPoll.title}
          hasVoted={hasVoted}
          totalVotes={totalVotes}
          onOpenResults={() => {
            setIsExitModalOpen(false);
            setIsResultsOpen(true);
          }}
          onOpenLobby={() => {
            setIsExitModalOpen(false);
            setIsLobbyOpen(true);
          }}
          onRevote={handleResetSimulation}
          onClose={() => setIsExitModalOpen(false)}
        />
      )}

      {/* Floating Polite Toast Notification */}
      {toastMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-sky-500/40 text-sky-200 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 max-w-md text-center pointer-events-none">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
