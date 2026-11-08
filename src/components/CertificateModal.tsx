import React, { useRef } from 'react';
import { AvatarType } from '../types';
import { sounds } from '../sound';
import { Download, Award, X, Sparkles } from 'lucide-react';

interface CertificateModalProps {
  nickname: string;
  avatarType: AvatarType;
  timestamp: string;
  pollTitle?: string;
  onClose: () => void;
  onRestart: () => void;
}

export const CertificateModal: React.FC<CertificateModalProps> = ({
  nickname,
  avatarType,
  timestamp,
  pollTitle,
  onClose,
  onRestart,
}) => {
  const certCardRef = useRef<HTMLDivElement | null>(null);

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

    // Top Emblem Icon
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(600, 160, 48, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('선거', 600, 160);

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

    // Voter Details Block
    ctx.textAlign = 'left';
    ctx.fillStyle = '#44403c';
    ctx.font = 'bold 32px "Noto Sans KR", sans-serif';
    ctx.fillText(`선거인 성명 :  ${nickname}`, 220, 480);
    ctx.fillText(`투표 일시   :  ${timestamp}`, 220, 545);
    ctx.fillText(`투표 구분   :  ${pollTitle || '제1회 모의선거'}`, 220, 610);
    ctx.fillText(`관할 구역   :  서울특별시 가상 제1투표구`, 220, 675);

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
    ctx.font = 'bold 54px "Song Myung", serif';
    ctx.fillStyle = '#0c4a6e';
    ctx.fillText('가상선거관리위원회위원장', 560, 1290);

    // Red Official Seal Stamp (도장)
    const sealX = 890;
    const sealY = 1290;
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 8;
    ctx.strokeRect(sealX - 70, sealY - 70, 140, 140);

    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 30px "Noto Serif KR", serif';
    ctx.fillText('가상선관', sealX, sealY - 20);
    ctx.fillText('위원회인', sealX, sealY + 25);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-7 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Top Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">디지털 투표확인증 발급</h2>
            <p className="text-xs text-slate-400">소중한 한 표를 행사해 주셔서 진심으로 감사합니다!</p>
          </div>
        </div>

        {/* The Printable / Viewable Certificate Card */}
        <div
          ref={certCardRef}
          className="relative bg-[#fffdf9] text-stone-900 rounded-xl border-4 border-[#c5a059] p-6 shadow-xl mb-5 select-none font-serif"
        >
          {/* Inner hairline border */}
          <div className="border border-[#c5a059]/60 p-5 rounded-lg text-center relative">
            {/* Top Emblem */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-sky-600 text-white font-sans font-bold text-sm mb-3 shadow-sm">
              선거
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-black tracking-widest text-stone-900 mb-1 font-cert">
              투  표  확  인  증
            </h1>
            <p className="text-[11px] font-sans text-stone-500 tracking-wider mb-5">
              Certificate of Voting Participation
            </p>

            {/* Voter Avatar & Info */}
            <div className="bg-stone-50/90 border border-stone-200/80 rounded-xl p-3.5 mb-5 font-sans text-left flex items-center gap-4">
              {/* Avatar Icon */}
              <div className="w-14 h-14 rounded-full bg-slate-200 border-2 border-stone-300 flex items-center justify-center shrink-0 overflow-hidden">
                {avatarType === 'male' ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-sky-950">
                    <div className="w-6 h-6 rounded-full bg-[#ffdfc4] relative -top-1">
                      <div className="absolute -top-1 inset-x-0 h-3 bg-[#221f1e] rounded-t-full" />
                    </div>
                    <div className="absolute bottom-0 w-8 h-4 bg-[#1e3a8a] rounded-t-md" />
                  </div>
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center bg-amber-950">
                    <div className="w-6 h-6 rounded-full bg-[#ffdfc4] relative -top-1">
                      <div className="absolute -top-1 -inset-x-1 h-4 bg-[#3d271d] rounded-t-full" />
                    </div>
                    <div className="absolute bottom-0 w-8 h-4 bg-[#d6bba2] rounded-t-md" />
                  </div>
                )}
              </div>

              {/* Info text */}
              <div className="space-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="text-stone-500">선거인:</span>
                  <span className="font-bold text-stone-900">{nickname}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-stone-500">투표일시:</span>
                  <span className="font-medium text-stone-800">{timestamp}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-stone-500">투표안건:</span>
                  <span className="text-stone-800 font-semibold truncate max-w-[200px]">{pollTitle || '가상 모의선거'}</span>
                </div>
              </div>
            </div>

            {/* Korean Certificate Declaration */}
            <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-cert mb-6">
              위 사람은 대한민국 헌법과 공직선거법에 의거하여,<br />
              가상 모의투표소에서 국민의 소중한 권리인 투표에<br />
              성실히 참여하였음을 확인합니다.
            </p>

            {/* Authority & Seal */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="text-sm font-bold text-sky-950 tracking-wider font-cert">
                가상선거관리위원회위원장
              </span>
              <div className="w-10 h-10 border-2 border-red-600 text-red-600 flex flex-col items-center justify-center text-[8px] font-bold leading-tight font-serif rounded-xs shadow-xs">
                <span>가상선관</span>
                <span>위원회인</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleDownloadImage}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-500/25 cursor-pointer transition"
          >
            <Download className="w-4 h-4" />
            <span>확인증 이미지 (PNG) 저장</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onRestart();
            }}
            className="flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>새로운 투표 체험</span>
          </button>
        </div>

        {/* Beta Disclaimer Note */}
        <div className="mt-4 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-center">
          <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
            ※ [BETA] 본 서비스는 일상 의사결정 및 투표 절차 체험용 모의투표 웹앱이며, 실제 공직선거나 여론조사와 무관합니다.
          </p>
        </div>
      </div>
    </div>
  );
};
