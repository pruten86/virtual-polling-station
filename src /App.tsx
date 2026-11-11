import React, { useEffect, useRef, useState, useCallback } from 'react';

import * as THREE from 'three';

import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import confetti from 'canvas-confetti';


import { AvatarType, Candidate, StationZone, PollStation, PollChannelData } from './types';

import { sounds } from './sound';

import { createProceduralAvatar, CharacterController } from './scene/avatar';

import { buildPollingStationEnvironment, EnvironmentResult } from './scene/environment';

import {

  getAllPolls,

  getPollTallies,

  recordPollVote,

  getActiveOfficialChannel,

  recordOfficialVote,

  generateRandomNickname,

} from './data/presetPolls';

import { supabase, isSupabaseConfigured } from './lib/supabase';

import {

  ensureAnonymousAuth,

  castVote,

  subscribePollRealtime,

  checkHasVotedVoteverse,

} from './lib/voteverseBackend';


import { AvatarSelectModal } from './components/AvatarSelectModal';

import { SignatureModal } from './components/SignatureModal';

import { BallotPaperModal } from './components/BallotPaperModal';

import { ResultsModal } from './components/ResultsModal';

import { CertificateModal } from './components/CertificateModal';

import { VirtualJoystick } from './components/VirtualJoystick';

import { CollapsibleHUD } from './components/CollapsibleHUD';


// Pre-allocated reusable vectors for zero-GC loop

const _playerDir = new THREE.Vector3();

const _targetCamPos = new THREE.Vector3();

const _targetLookAt = new THREE.Vector3();

const _currentCamPos = new THREE.Vector3();

const _currentLookAt = new THREE.Vector3();


export default function App() {

  const canvasMountRef = useRef<HTMLDivElement | null>(null);


  // App & Election State

  const [hasEntered, setHasEntered] = useState<boolean>(false);

  const [isLobbyOpen, setIsLobbyOpen] = useState<boolean>(false);

  const [nickname, setNickname] = useState<string>(() => generateRandomNickname());

  const [avatarType, setAvatarType] = useState<AvatarType>('male');


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


  // Official Channel system state ("온라인 갓바위" 방식 100명 단위 자동 증설)

  const [officialChannelState, setOfficialChannelState] = useState<{

    activeChannelIndex: number;

    channelVotes: number;

    totalCumulativeVotes: number;

    allChannels: PollChannelData[];

  }>(() => {

    if (currentPoll.isOfficial) {

      const info = getActiveOfficialChannel(currentPoll.id, currentPoll.candidates);

      return {

        activeChannelIndex: info.activeChannelIndex,

        channelVotes: info.channelVotes,

        totalCumulativeVotes: info.totalCumulativeVotes,

        allChannels: info.allChannels,

      };

    }

    return {

      activeChannelIndex: 1,

      channelVotes: 0,

      totalCumulativeVotes: 0,

      allChannels: [],

    };

  });


  // Voting Progress Pipeline

  const [currentStep, setCurrentStep] = useState<number>(1);

  const [hasBallot, setHasBallot] = useState<boolean>(false);

  const [hasStamped, setHasStamped] = useState<boolean>(false);

  const [userVoteId, setUserVoteId] = useState<string | null>(null);

  const [hasVoted, setHasVoted] = useState<boolean>(false);

  const [voteTimestamp, setVoteTimestamp] = useState<string>('');


  // Candidates & Real-time votes for the current poll

  const [candidates, setCandidates] = useState<Candidate[]>(() => {

    if (currentPoll.isOfficial) {

      const info = getActiveOfficialChannel(currentPoll.id, currentPoll.candidates);

      return info.cumulativeCandidates;

    }

    return getPollTallies(currentPoll);

  });


  // Modal Open States

  const [isSignatureOpen, setIsSignatureOpen] = useState<boolean>(false);

  const [isBallotPaperOpen, setIsBallotPaperOpen] = useState<boolean>(false);

  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);

  const [isCertificateOpen, setIsCertificateOpen] = useState<boolean>(false);


  // Interaction & Nearby Detection

  const [activeZoneNear, setActiveZoneNear] = useState<StationZone | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(false);


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


  // Step synchronization with Environment beacon indicators

  useEffect(() => {

    if (envResultRef.current) {

      envResultRef.current.updateBeaconActive(currentStep);

    }

  }, [currentStep]);


  // 2. 컴포넌트 마운트 시 ensureAnonymousAuth()를 호출해 익명 유저 세션을 발급/확인

  useEffect(() => {

    ensureAnonymousAuth();

  }, []);


  // Synchronize user vote status for the current poll

  useEffect(() => {

    let isMounted = true;

    checkHasVotedVoteverse(currentPoll.id).then((already) => {

      if (isMounted && already) {

        setHasVoted(true);

        setCurrentStep(4);

      }

    });

    return () => {

      isMounted = false;

    };

  }, [currentPoll.id]);


  // 4. ResultsModal(개표 전광판)이 켜져 있거나 투표소 진입 시 subscribePollRealtime을 등록해 실시간으로 후보자 득표수(candidates.votes)가 갱신되게 처리

  useEffect(() => {

    if (!hasEntered && !isResultsOpen) return;


    const unsubscribe = subscribePollRealtime(currentPoll.id, ({ optionId, votes }) => {

      setCandidates((prev) =>

        prev.map((c) => {

          if (c.id === optionId) {

            const nextVotes = votes >= 0 ? votes : c.votes + 1;

            return { ...c, votes: nextVotes };

          }

          return c;

        })

      );

    });


    return () => {

      unsubscribe();

    };

  }, [currentPoll.id, hasEntered, isResultsOpen]);


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


    // castVote(currentPoll.id, selectedCandidate.id) 호출

    const res = await castVote(currentPoll.id, selectedCandidate.id);


    // 중복 투표거나 마감 에러 시 alert(res.message) 표시 후 차단

    if (!res.success || res.alreadyVoted) {

      sounds.playWarning();

      const msg = res.message || '이미 이번 안건에 소중한 한 표를 행사하셨습니다. (1인 1표 원칙)';

      try {

        window.alert(msg);

      } catch {

        // window.alert fallback in iframe

      }

      showToast(msg);

      setHasVoted(true);

      setCurrentStep(4);

      return;

    }


    // 성공 시 기존 효과음 재생 및 확인증 모달(setShowCertificate) 표시

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


      if (currentPoll.isOfficial) {

        const officialRes = recordOfficialVote(currentPoll.id, selectedCandidate.id, candidates);

        setCandidates(officialRes.cumulativeCandidates);

        setOfficialChannelState({

          activeChannelIndex: officialRes.activeChannelIndex,

          channelVotes: officialRes.activeChannelVotes,

          totalCumulativeVotes: officialRes.totalCumulativeVotes,

          allChannels: officialRes.allChannels,

        });

        showToast(

          `투표용지가 투입되었습니다! (제${officialRes.activeChannelIndex}투표소에 기록됨) 4번 개표 전광판을 확인하세요.`

        );

      } else {

        const updated = recordPollVote(currentPoll.id, selectedCandidate.id, candidates);

        setCandidates(updated);

        showToast('투표함에 투표용지가 투입되었습니다! 4번 개표 전광판에서 실시간 결과를 확인하세요.');

      }


      // 확인증 모달(setShowCertificate) 표시

      setTimeout(() => {

        setShowCertificate(true);

      }, 600);


      // Broadcast event to other peers if Supabase is connected

      if (isSupabaseConfigured && supabase) {

        supabase.channel(`realtime_poll_${currentPoll.id}`).send({

          type: 'broadcast',

          event: 'vote_cast',

          payload: { candidateId: selectedCandidate.id },

        });

      }

    }, 850);

  }, [currentPoll, userVoteId, candidates, showToast, setShowCertificate]);


  // Handle Station Interaction

  const handleInteract = useCallback(() => {

    if (!hasEntered || isLobbyOpen) return;


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

        isCertificateOpen

      ) {

        return;

      }


      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {

        e.preventDefault();

      }

