import React, { useRef, useState, useEffect } from 'react';
import { sounds } from '../sound';
import { FileSignature, RotateCcw, CheckCircle, ShieldCheck, X } from 'lucide-react';

interface SignatureModalProps {
  nickname: string;
  onComplete: (signatureDataUrl: string) => void;
  onClose: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  nickname,
  onComplete,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const lastStrokeSoundTime = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // High DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Initial canvas setup
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Guide watermark text
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '500 16px "Pretendard", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('이곳에 정자로 성명을 쓰거나 서명하세요', rect.width / 2, rect.height / 2);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!hasDrawn) {
      // Clear initial guide watermark on first stroke
      const rect = canvas.getBoundingClientRect();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      setHasDrawn(true);
    }

    setIsDrawing(true);
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    playScratch();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    playScratch();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const playScratch = () => {
    const now = performance.now();
    if (now - lastStrokeSoundTime.current > 120) {
      sounds.playPenScratch();
      lastStrokeSoundTime.current = now;
    }
  };

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    const me = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: me.clientX - rect.left,
      y: me.clientY - rect.top,
    };
  };

  const clearCanvas = () => {
    sounds.playClick();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasDrawn(false);
  };

  const handleConfirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sounds.playPaperFold();
    const dataUrl = canvas.toDataURL('image/png');
    onComplete(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desk Officer Header */}
        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-slate-800">
          <div className="w-13 h-13 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center shrink-0 text-sky-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold mb-1">
              <span>제1단계: 신분확인 및 투표용지 교부</span>
            </div>
            <h2 className="text-xl font-bold text-white">선거인 본인 확인</h2>
            <p className="text-xs text-slate-400">
              투표사무원: &ldquo;반갑습니다, <strong className="text-sky-300">{nickname}</strong> 님! 본인 확인 서명을 진행해주세요.&rdquo;
            </p>
          </div>
        </div>

        {/* Verification Info Box */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-xl p-3.5 mb-4 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>선거인 성명:</span>
            <span className="font-semibold text-white">{nickname}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>확인 상태:</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> 전산 명부 대조 완료
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>교부 대상:</span>
            <span className="font-medium text-slate-200">제1회 모의선거 투표용지 (1매)</span>
          </div>
        </div>

        {/* Signature Pad */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <FileSignature className="w-4 h-4 text-sky-400" />
              <span>전자 서명패드</span>
            </label>
            <button
              type="button"
              onClick={clearCanvas}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>지우기</span>
            </button>
          </div>

          <div className="rounded-xl overflow-hidden border-2 border-slate-700 bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-36 cursor-crosshair touch-none"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5 text-right">
            마우스 드래그 또는 터치스크린으로 서명하세요.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
          >
            돌아가기
          </button>
          <button
            type="button"
            disabled={!hasDrawn}
            onClick={handleConfirm}
            className={`flex-2 flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-bold text-sm shadow-lg transition ${
              hasDrawn
                ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/25 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>서명 완료 및 투표용지 수령</span>
          </button>
        </div>
      </div>
    </div>
  );
};
