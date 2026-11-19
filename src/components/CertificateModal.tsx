import React, { useRef } from 'react';
import { AvatarType, AVATAR_META, normalizeAvatarType } from '../types';
import { sounds } from '../sound';
import { Download, Award, X, Sparkles, BarChart3, Vote, Footprints } from 'lucide-react';
import { AvatarIllustration } from './AvatarIllustration';

interface CertificateModalProps {
  nickname: string;
  avatarType: AvatarType;
  timestamp: string;
  pollTitle?: string;
  onClose: () => void;
  onRestart: () => void;
  onOpenResults?: () => void;
  onOpenLobby?: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  nickname,
  avatarType,
  timestamp,
  pollTitle,
  onClose,
  onRestart,
  onOpenResults,
  onOpenLobby,
}) => {
  const certCardRef = useRef<HTMLDivElement | null>(null);
  const normalizedAvatar = normalizeAvatarType(avatarType);
  const avatarMeta = AVATAR_META[normalizedAvatar];

  // Generate and download high-resolution PNG using HTML Canvas
  const handleDownloadImage = () => {
    sounds.playClick();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext('2d')!;

    // 1. Warm parchment certificate background
    ctx.fillStyle = '#fffdfa';
    ctx.fillRect(0, 0, 1200, 1600);

    // Decorative ornate double border
    ctx.strokeStyle = '#c5a059'; // Classic gold
    ctx.lineWidth = 14;
    ctx.strokeRect(40, 40, 1120, 1520);

    ctx.strokeStyle = '#856424';
    ctx.lineWidth = 3;
    ctx.strokeRect(60, 60, 1080, 1480);

    // Top Emblem Icon (Red '卜' Ballot Stamp Mark)
    ctx.fillStyle = '#fff1f2';
    ctx.beginPath();
    ctx.arc(600, 160, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = '#e11d48';
    ctx.font = 'bold 46px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('卜', 600, 162);

    // Certificate Title
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 76px "Song Myung", "Noto Serif KR", serif';
    ctx.fillText('투  표  확  인  증', 600, 280);

    ctx.fillStyle = '#78716c';
    ctx.font = '500 28px "Noto Sans KR", sans-serif';
    ctx.fillText('Certificate of Voting Participation', 600, 340);

    // Subtle divider
    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(200, 390);
    ctx.lineTo(1000, 390);
    ctx.stroke();

    // Voter Details Block + Miniature Avatar Emblem on Canvas
    const avCx = 915;
    const avCy = 575;
    ctx.save();
    ctx.beginPath();
    ctx.arc(avCx, avCy, 86, 0, Math.PI * 2);
    ctx.fillStyle = avatarMeta.bgSoft;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#d6c3a5';
    ctx.stroke();
    ctx.clip();

    // Mini shoulders/top
    ctx.fillStyle = normalizedAvatar === 'female_2' ? '#FFFDF8' : avatarMeta.topColor;
    ctx.beginPath();
    ctx.arc(avCx, avCy + 82, 62, Math.PI, 0);
    ctx.fill();
    if (normalizedAvatar === 'female_2') {
      ctx.fillStyle = avatarMeta.topColor;
      ctx.fillRect(avCx - 30, avCy + 28, 60, 62);
    } else if (normalizedAvatar === 'male_3') {
      ctx.fillStyle = '#FAF3E7';
      ctx.beginPath();
      ctx.moveTo(avCx - 16, avCy + 26);
      ctx.lineTo(avCx, avCy + 64);
      ctx.lineTo(avCx + 16, avCy + 26);
      ctx.closePath();
      ctx.fill();
    }

    // Back hair for female styles
    ctx.fillStyle = avatarMeta.hairColor;
    if (normalizedAvatar === 'female_1') {
      ctx.beginPath();
      ctx.arc(avCx, avCy - 4, 46, 0, Math.PI * 2);
      ctx.fill();
    } else if (normalizedAvatar === 'female_2') {
      ctx.beginPath();
      ctx.arc(avCx + 36, avCy + 10, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(avCx, avCy - 10, 41, 0, Math.PI * 2);
      ctx.fill();
    } else if (normalizedAvatar === 'female_3') {
      ctx.fillRect(avCx - 44, avCy - 24, 88, 96);
    }

    // Head
    ctx.fillStyle = '#F8D5BC';
    ctx.beginPath();
    ctx.arc(avCx, avCy - 10, 36, 0, Math.PI * 2);
    ctx.fill();

    // Cheek blushes
    ctx.fillStyle = 'rgba(242, 159, 159, 0.6)';
    ctx.beginPath();
    ctx.ellipse(avCx - 20, avCy, 8, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(avCx + 20, avCy, 8, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dot eyes
    ctx.fillStyle = '#2A1F1A';
    ctx.beginPath();
    ctx.arc(avCx - 13, avCy - 8, 4.5, 0, Math.PI * 2);
    ctx.arc(avCx + 13, avCy - 8, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Glasses for male_3
    if (avatarMeta.hasGlasses) {
      ctx.strokeStyle = '#2E2019';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(avCx - 13, avCy - 8, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(avCx + 13, avCy - 8, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(avCx - 2, avCy - 8);
      ctx.lineTo(avCx + 2, avCy - 8);
      ctx.stroke();
    }

    // Top hair dome
    ctx.fillStyle = avatarMeta.hairColor;
    ctx.beginPath();
    ctx.arc(avCx, avCy - 18, 37, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#78716c';
    ctx.font = 'bold 20px "Noto Sans KR", sans-serif';
    ctx.fillText(avatarMeta.fullName, avCx, avCy + 114);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#44403c';
    ctx.font = 'bold 32px "Noto Sans KR", sans-serif';
    ctx.fillText(`선거인 성명 :  ${nickname}`, 180, 480);
    ctx.fillText(`아바타 캐릭터 :  ${avatarMeta.fullName}`, 180, 545);
    ctx.fillText(`투표 일시   :  ${timestamp}`, 180, 610);
    ctx.fillText(`투표 구분   :  ${pollTitle || '제1회 모의선거'}`, 180, 675);

    // Main Certificate Body Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1c1917';
    ctx.font = '500 38px "Song Myung", "Noto Serif KR", serif';
    const textLines = [
      '위 사람은 대한민국 헌법과 공직선거법의 정신에 따라',
      '가상 모의투표소에서 국민의 소중한 주권인 투표에',
      '성실히 참여하였음을 공식 확인합니다.',
    ];
    textLines.forEach((line, idx) => {
      ctx.fillText(line, 600, 840 + idx * 75);
    });

    // Date
    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
    ctx.font = '600 36px "Song Myung", serif';
    ctx.fillText(dateStr, 600, 1180);

    // Authority Title
    ctx.font = 'bold 40px "Song Myung", serif';
    ctx.fillStyle = '#0c4a6e';
    ctx.fillText('보트버스(VOTEVERSE) 중앙일상선거관리위원회', 515, 1290);

    // Red Official Seal Stamp (도장)
    const sealX = 995;
    const sealY = 1290;
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 8;
    ctx.strokeRect(sealX - 70, sealY - 70, 140, 140);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 28px "Noto Serif KR", serif';
    ctx.fillText('보트버스', sealX, sealY - 22);
    ctx.fillText('선관위인', sealX, sealY + 24);

    // Watermark
    ctx.fillStyle = 'rgba(2, 132, 199, 0.05)';
    ctx.beginPath();
    ctx.arc(600, 960, 240, 0, Math.PI * 2);
    ctx.fill();

    // Bottom Beta Disclaimer
    ctx.fillStyle = '#78716c';
    ctx.font = '500 20px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('※ [BETA] 본 서비스는 일상 의사결정 및 투표 절차 체험용 모의투표 웹앱이며, 실제 공직선거나 여론조사와 무관합니다.', 600, 1490);

    // Trigger file download
    const link = document.createElement('a');
    link.download = `투표확인증_${nickname}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div
      onClick={() => {
        sounds.playClick();
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[85dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col"
      >
        {/* Fixed Sticky Header with Prominent Close Button */}
        <div className="sticky top-0 z-20 flex items-center justify-between gap-2 px-4 sm:px-6 py-3.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">디지털 투표확인증 발급</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">소중한 한 표를 행사해 주셔서 감사합니다!</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-slate-200 hover:text-white text-xs font-bold transition cursor-pointer shrink-0"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
            <span>닫기</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {/* The Printable / Viewable Certificate Card */}
          <div
            ref={certCardRef}
            className="relative bg-[#fffdf9] text-stone-900 rounded-xl border-4 border-[#c5a059] p-4 sm:p-6 shadow-xl select-none font-serif"
          >
            {/* Inner hairline border */}
            <div className="border border-[#c5a059]/60 p-3.5 sm:p-5 rounded-lg text-center relative">
              {/* Top Emblem (Red '卜' Ballot Stamp) */}
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-50 border-2 border-rose-600 text-rose-600 font-sans font-black text-lg sm:text-xl mb-2.5 shadow-sm">
                卜
              </div>

              {/* Title */}
              <h1 className="text-xl sm:text-3xl font-black tracking-widest text-stone-900 mb-1 font-cert">
                투  표  확  인  증
              </h1>
              <p className="text-[10px] sm:text-[11px] font-sans text-stone-500 tracking-wider mb-4">
                Certificate of Voting Participation
              </p>

              {/* Voter Avatar & Info */}
              <div className="bg-stone-50/90 border border-stone-200/80 rounded-xl p-3 mb-4 font-sans text-left flex items-center gap-3 sm:gap-4">
                {/* Avatar Icon (6-variant clay miniature illustration) */}
                <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full border-2 border-[#d6c3a5] flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                  <AvatarIllustration avatarType={normalizedAvatar} className="w-full h-full" />
                </div>

                {/* Info text */}
                <div className="space-y-1 text-xs min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-stone-500 shrink-0">선거인:</span>
                    <span className="font-bold text-stone-900 truncate">{nickname}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-stone-200 text-stone-700 shrink-0"
                      style={{ backgroundColor: avatarMeta.bgSoft }}
                    >
                      {avatarMeta.shortName}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-stone-500 shrink-0">투표일시:</span>
                    <span className="font-medium text-stone-800 truncate">{timestamp}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-stone-500 shrink-0">투표안건:</span>
                    <span className="text-stone-800 font-semibold truncate">{pollTitle || '가상 모의선거'}</span>
                  </div>
                </div>
              </div>

              {/* Korean Certificate Declaration */}
              <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-cert mb-4">
                위 사람은 대한민국 헌법과 공직선거법에 의거하여,<br />
                가상 모의투표소에서 국민의 소중한 권리인 투표에<br />
                성실히 참여하였음을 확인합니다.
              </p>

              {/* Authority & Seal */}
              <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap">
                <span className="text-[11px] sm:text-xs font-bold text-sky-950 tracking-wide font-cert">
                  보트버스(VOTEVERSE) 중앙일상선거관리위원회
                </span>
                <div className="w-9 h-9 sm:w-10 sm:h-10 border-2 border-red-600 text-red-600 flex flex-col items-center justify-center text-[7px] sm:text-[8px] font-bold leading-tight font-serif rounded-xs shadow-xs shrink-0">
                  <span>보트버스</span>
                  <span>선관위인</span>
                </div>
              </div>
            </div>
          </div>

          {/* Primary & Secondary Action Buttons */}
          <div className="space-y-2.5">
            {/* a) Primary Highlighted Button: Close modal & browse 3D polling station */}
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-lg shadow-sky-500/30 cursor-pointer transition active:scale-[0.98]"
            >
              <Footprints className="w-4 h-4 shrink-0" />
              <span>🚶 창 닫고 투표소 둘러보기</span>
            </button>

            {/* b) Open Live Results & Guestbook Modal */}
            {onOpenResults && (
              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onOpenResults();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 cursor-pointer transition active:scale-[0.98]"
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>📊 개표 전광판 & 방명록 보기</span>
              </button>
            )}

            {/* c) Auxiliary Buttons Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleDownloadImage}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-bold text-xs cursor-pointer transition whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>인증서 이미지 저장</span>
              </button>

              {onOpenLobby && (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    onOpenLobby();
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-semibold text-xs cursor-pointer transition whitespace-nowrap"
                >
                  <Vote className="w-3.5 h-3.5 shrink-0" />
                  <span>다른 투표소 가기(로비)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  sounds.playClick();
                  onRestart();
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>재투표하기</span>
              </button>
            </div>
          </div>

          {/* Beta Disclaimer Note */}
          <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
              ※ [BETA] 본 서비스는 일상 의사결정 및 투표 절차 체험용 모의투표 웹앱이며, 실제 공직선거나 여론조사와 무관합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
