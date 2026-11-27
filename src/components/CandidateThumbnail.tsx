import React, { useEffect, useState } from 'react';
import { Candidate } from '../types';
import {
  detectSnackArtKey,
  getCroppedImageDataUrl,
  SnackArtKey,
} from '../utils/candidateImage';
import { X, ZoomIn } from 'lucide-react';

interface CandidateThumbnailProps {
  candidate: Pick<
    Candidate,
    'id' | 'title' | 'party' | 'accentBg' | 'symbolNumber' | 'imageUrl' | 'imageCrop'
  >;
  className?: string;
  showZoomHint?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

const FallbackSnackSvg: React.FC<{
  artKey: SnackArtKey;
  accentBg: string;
  symbolNumber: number;
}> = ({ artKey, accentBg, symbolNumber }) => {
  const bgMap: Record<SnackArtKey, [string, string]> = {
    bungeoppang: ['#FEF3C7', '#FDE68A'],
    hotteok: ['#FFEDD5', '#FED7AA'],
    sweetpotato: ['#F3E8FF', '#DDD6FE'],
    eomuk: ['#E0F2FE', '#BAE6FD'],
    hoppang: ['#FFE4E6', '#FECDD3'],
    hotchoco: ['#F5EFE6', '#E6D3BE'],
    gyeranppang: ['#FEF9C3', '#FDE047'],
    chestnut: ['#D1FAE5', '#A7F3D0'],
    kimchistew: ['#FFE4E6', '#FECDD3'],
    tonkatsu: ['#E0F2FE', '#FEF3C7'],
    salmonpoke: ['#D1FAE5', '#A7F3D0'],
    gukbap: ['#FEF3C7', '#FDE68A'],
    samgyeopsal: ['#FFE4E6', '#FDBA74'],
    chimaek: ['#FEF3C7', '#FDE68A'],
    sashimi: ['#E0F2FE', '#BAE6FD'],
    steakwine: ['#F3E8FF', '#E9D5FF'],
    generic: ['#F1F5F9', '#E2E8F0'],
  };
  const [c1, c2] = bgMap[artKey];
  const gradId = `snack_bg_${artKey}_${symbolNumber}`;
  const showSteam =
    artKey !== 'generic' &&
    artKey !== 'salmonpoke' &&
    artKey !== 'tonkatsu' &&
    artKey !== 'chimaek' &&
    artKey !== 'sashimi';

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full block select-none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={c1} />
          <stop offset="100%" stopColor={c2} />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill={`url(#${gradId})`} />
      <circle cx="50" cy="54" r="34" fill="rgba(255,255,255,0.52)" />

      {/* Warm steam wisps for hot foods */}
      {showSteam && (
        <g
          stroke="rgba(255,255,255,0.78)"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M36 28 Q32 21 37 15" />
          <path d="M50 24 Q46 17 51 11" />
          <path d="M64 28 Q60 21 65 15" />
        </g>
      )}

      {artKey === 'bungeoppang' && (
        <g>
          <ellipse cx="46" cy="56" rx="26" ry="16" transform="rotate(-6 46 56)" fill="#D97706" />
          <polygon points="68,54 84,42 82,66" fill="#D97706" />
          <ellipse cx="45" cy="55" rx="21" ry="12" transform="rotate(-6 45 55)" fill="#F59E0B" />
          <path d="M40 50 A4 4 0 0 1 40 60 M49 50 A4 4 0 0 1 49 60 M58 50 A4 4 0 0 1 58 60" stroke="#B45309" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <circle cx="32" cy="53" r="2.7" fill="#451A03" />
        </g>
      )}

      {artKey === 'hotteok' && (
        <g>
          <rect x="28" y="61" width="44" height="23" rx="6" fill="#FFFFFF" stroke="#FDBA74" strokeWidth="2" />
          <circle cx="50" cy="51" r="25" fill="#C2410C" />
          <circle cx="50" cy="50" r="21" fill="#EA580C" />
          <ellipse cx="45" cy="45" rx="11" ry="6" transform="rotate(-16 45 45)" fill="#FDBA74" />
          <circle cx="42" cy="57" r="2" fill="#FEF3C7" />
          <circle cx="57" cy="58" r="2" fill="#FEF3C7" />
          <circle cx="60" cy="46" r="1.9" fill="#FEF3C7" />
          <circle cx="52" cy="41" r="1.8" fill="#FEF3C7" />
        </g>
      )}

      {artKey === 'sweetpotato' && (
        <g>
          <ellipse cx="44" cy="58" rx="25" ry="14" transform="rotate(-18 44 58)" fill="#6D28D9" />
          <ellipse cx="62" cy="54" rx="14" ry="12" transform="rotate(10 62 54)" fill="#FACC15" />
          <ellipse cx="62" cy="53" rx="9" ry="7.5" transform="rotate(10 62 53)" fill="#FEF08A" />
          <ellipse cx="34" cy="63" rx="7" ry="3" transform="rotate(-18 34 63)" fill="#4C1D95" />
        </g>
      )}

      {artKey === 'eomuk' && (
        <g>
          <polygon points="32,54 68,54 63,82 37,82" fill="#FFFFFF" stroke="#38BDF8" strokeWidth="2" />
          <ellipse cx="50" cy="55" rx="16" ry="4.5" fill="#F59E0B" />
          <line x1="46" y1="60" x2="58" y2="24" stroke="#92400E" strokeWidth="3.2" strokeLinecap="round" />
          <rect x="38" y="34" width="26" height="8" rx="4" fill="#FCD34D" stroke="#B45309" strokeWidth="1.6" />
          <rect x="40" y="43" width="26" height="8" rx="4" fill="#FCD34D" stroke="#B45309" strokeWidth="1.6" />
          <rect x="42" y="52" width="24" height="8" rx="4" fill="#FCD34D" stroke="#B45309" strokeWidth="1.6" />
        </g>
      )}

      {artKey === 'hoppang' && (
        <g>
          <ellipse cx="50" cy="70" rx="26" ry="7" fill="#FDE68A" />
          <path d="M25 62 A25 25 0 0 1 75 62 Q75 71 50 71 Q25 71 25 62 Z" fill="#FFFDF9" stroke="#FDA4AF" strokeWidth="2" />
          <ellipse cx="57" cy="60" rx="7" ry="4.5" transform="rotate(10 57 60)" fill="#9F1239" />
          <circle cx="40" cy="57" r="4" fill="rgba(251,113,133,0.35)" />
        </g>
      )}

      {artKey === 'hotchoco' && (
        <g>
          <path d="M67 49 A10 10 0 0 1 67 69" fill="none" stroke="#92400E" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M29 44 H67 V68 A12 12 0 0 1 55 80 H41 A12 12 0 0 1 29 68 Z" fill="#B45309" />
          <ellipse cx="48" cy="45" rx="18" ry="6" fill="#451A03" />
          <rect x="40" y="42" width="8.5" height="6.5" rx="2.5" fill="#FFFFFF" />
          <rect x="51" y="44" width="8.5" height="6.5" rx="2.5" fill="#FFFFFF" />
          <rect x="46" y="39" width="8" height="6" rx="2.5" fill="#FFFFFF" />
        </g>
      )}

      {artKey === 'gyeranppang' && (
        <g>
          <rect x="23" y="44" width="54" height="30" rx="14" fill="#CA8A04" />
          <rect x="26" y="41" width="48" height="24" rx="12" fill="#EAB308" />
          <ellipse cx="50" cy="52" rx="17" ry="10" fill="#FFFFFF" />
          <circle cx="50" cy="52" r="7" fill="#F97316" />
          <circle cx="48" cy="50" r="2.4" fill="#FDE047" />
        </g>
      )}

      {artKey === 'chestnut' && (
        <g>
          <path d="M37 46 Q53 60 37 73 Q21 60 37 46 Z" fill="#78350F" />
          <ellipse cx="37" cy="61" rx="6" ry="3.5" fill="#FACC15" />
          <path d="M63 48 Q78 61 63 74 Q48 61 63 48 Z" fill="#78350F" />
          <ellipse cx="63" cy="62" rx="5.5" ry="3.2" fill="#FACC15" />
          <path d="M50 32 Q67 47 50 61 Q33 47 50 32 Z" fill="#92400E" />
          <ellipse cx="50" cy="48" rx="6.5" ry="3.8" fill="#FACC15" />
        </g>
      )}

      {artKey === 'kimchistew' && (
        <g>
          <path d="M23 54 H77 V62 A27 27 0 0 1 23 62 Z" fill="#292524" />
          <ellipse cx="50" cy="54" rx="29" ry="11" fill="#44403C" />
          <ellipse cx="50" cy="54" rx="24" ry="8.5" fill="#DC2626" />
          <rect x="37" y="49" width="9" height="6" rx="1.5" fill="#FEF3C7" />
          <rect x="53" y="51" width="9" height="6" rx="1.5" fill="#FEF3C7" />
          <circle cx="47" cy="56" r="2.8" fill="none" stroke="#22C55E" strokeWidth="2.2" />
          <circle cx="61" cy="52" r="2.6" fill="none" stroke="#22C55E" strokeWidth="2.2" />
          <circle cx="35" cy="55" r="2.5" fill="none" stroke="#22C55E" strokeWidth="2.2" />
        </g>
      )}

      {artKey === 'tonkatsu' && (
        <g>
          <ellipse cx="50" cy="60" rx="32" ry="21" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
          <circle cx="65" cy="49" r="10" fill="#86EFAC" />
          <ellipse cx="47" cy="61" rx="22" ry="13" transform="rotate(-5 47 61)" fill="#B45309" />
          <ellipse cx="47" cy="59" rx="20" ry="11" transform="rotate(-5 47 59)" fill="#D97706" />
          <line x1="40" y1="51" x2="38" y2="68" stroke="#78350F" strokeWidth="1.8" />
          <line x1="48" y1="51" x2="46" y2="68" stroke="#78350F" strokeWidth="1.8" />
          <line x1="56" y1="51" x2="54" y2="68" stroke="#78350F" strokeWidth="1.8" />
          <path d="M34 58 Q45 54 56 61" fill="none" stroke="#451A03" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      )}

      {artKey === 'salmonpoke' && (
        <g>
          <circle cx="50" cy="56" r="28" fill="#FFFFFF" stroke="#34D399" strokeWidth="2.5" />
          <circle cx="50" cy="56" r="23" fill="#FEFCE8" />
          <ellipse cx="38" cy="50" rx="7.5" ry="4" transform="rotate(-25 38 50)" fill="#22C55E" />
          <ellipse cx="36" cy="57" rx="7.5" ry="4" transform="rotate(-25 36 57)" fill="#16A34A" />
          <ellipse cx="41" cy="63" rx="7.5" ry="4" transform="rotate(-25 41 63)" fill="#22C55E" />
          <rect x="54" y="46" width="8" height="7" rx="2" fill="#FB7185" />
          <rect x="61" y="52" width="8" height="7" rx="2" fill="#F97316" />
          <rect x="52" y="55" width="8" height="7" rx="2" fill="#FB7185" />
          <rect x="60" y="61" width="8" height="7" rx="2" fill="#F97316" />
          <circle cx="48" cy="41" r="3" fill="#15803D" />
          <circle cx="54" cy="40" r="3" fill="#15803D" />
          <circle cx="43" cy="43" r="2.8" fill="#15803D" />
        </g>
      )}

      {artKey === 'gukbap' && (
        <g>
          <path d="M23 54 H77 V62 A27 27 0 0 1 23 62 Z" fill="#292524" />
          <ellipse cx="50" cy="54" rx="29" ry="11" fill="#44403C" />
          <ellipse cx="50" cy="54" rx="24" ry="8.5" fill="#FFFBEB" />
          <ellipse cx="40" cy="54" rx="6.5" ry="3.2" fill="#B45309" />
          <ellipse cx="52" cy="56" rx="6.5" ry="3.2" fill="#92400E" />
          <ellipse cx="60" cy="52" rx="6" ry="3" fill="#B45309" />
          <circle cx="49" cy="52" r="4" fill="#DC2626" />
          <circle cx="36" cy="51" r="2.2" fill="#16A34A" />
          <circle cx="45" cy="58" r="2.2" fill="#16A34A" />
          <circle cx="57" cy="58" r="2.2" fill="#16A34A" />
          <circle cx="64" cy="54" r="2.2" fill="#16A34A" />
        </g>
      )}

      {artKey === 'samgyeopsal' && (
        <g>
          <ellipse cx="50" cy="59" rx="32" ry="22" fill="#292524" stroke="#57534E" strokeWidth="2.4" />
          <rect x="28" y="45" width="36" height="9.5" rx="4" fill="#B45309" />
          <rect x="31" y="47.5" width="30" height="3.2" rx="1.5" fill="#FDBA74" />
          <rect x="31" y="57" width="36" height="9.5" rx="4" fill="#B45309" />
          <rect x="34" y="59.5" width="30" height="3.2" rx="1.5" fill="#FDBA74" />
          <rect x="34" y="69" width="34" height="9" rx="4" fill="#B45309" />
          <rect x="37" y="71.5" width="28" height="3" rx="1.5" fill="#FDBA74" />
          <circle cx="29" cy="62" r="7.5" fill="#22C55E" />
          <circle cx="69" cy="51" r="3.6" fill="#FEF3C7" />
          <circle cx="72" cy="60" r="3.6" fill="#FEF3C7" />
        </g>
      )}

      {artKey === 'chimaek' && (
        <g>
          <path d="M76 48 A6.5 6.5 0 0 1 76 62" fill="none" stroke="#D97706" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="56" y="40" width="21" height="32" rx="5" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.6" />
          <circle cx="60" cy="39" r="6" fill="#FFFFFF" />
          <circle cx="66" cy="37" r="6.2" fill="#FFFFFF" />
          <circle cx="72" cy="39" r="6" fill="#FFFFFF" />
          <rect x="21" y="62" width="14" height="6.5" rx="3" fill="#FFFBEB" />
          <ellipse cx="40" cy="59" rx="16" ry="12" transform="rotate(-14 40 59)" fill="#D97706" />
          <ellipse cx="39" cy="57" rx="12" ry="8.5" transform="rotate(-14 39 57)" fill="#F59E0B" />
          <circle cx="34" cy="54" r="1.8" fill="#B45309" />
          <circle cx="43" cy="61" r="1.8" fill="#B45309" />
          <circle cx="38" cy="63" r="1.8" fill="#B45309" />
        </g>
      )}

      {artKey === 'sashimi' && (
        <g>
          <ellipse cx="50" cy="58" rx="32" ry="22" fill="#1E293B" stroke="#38BDF8" strokeWidth="2" />
          <ellipse cx="36" cy="52" rx="12" ry="7" transform="rotate(-20 36 52)" fill="#22C55E" />
          <rect x="28" y="53" width="20" height="9" rx="4.5" transform="rotate(-12 38 58)" fill="#FB7185" />
          <rect x="41" y="49" width="20" height="9" rx="4.5" transform="rotate(3 51 54)" fill="#FFF7ED" />
          <rect x="54" y="54" width="20" height="9" rx="4.5" transform="rotate(14 64 59)" fill="#F97316" />
          <rect x="39" y="61" width="20" height="9" rx="4.5" transform="rotate(-3 49 65)" fill="#FCA5A5" />
          <circle cx="67" cy="46" r="5" fill="#FACC15" />
          <circle cx="32" cy="66" r="3.8" fill="#84CC16" />
        </g>
      )}

      {artKey === 'steakwine' && (
        <g>
          <ellipse cx="45" cy="62" rx="26" ry="17" fill="#FFFFFF" stroke="#D8B4FE" strokeWidth="2" />
          <ellipse cx="44" cy="61" rx="18" ry="11" transform="rotate(-6 44 61)" fill="#7C2D12" />
          <ellipse cx="44" cy="59.5" rx="15.5" ry="9" transform="rotate(-6 44 59.5)" fill="#9A3412" />
          <line x1="38" y1="53" x2="35" y2="65" stroke="#431407" strokeWidth="1.8" />
          <line x1="44" y1="53" x2="41" y2="65" stroke="#431407" strokeWidth="1.8" />
          <line x1="50" y1="53" x2="47" y2="65" stroke="#431407" strokeWidth="1.8" />
          <circle cx="44" cy="59" r="4" fill="#FEF08A" />
          <ellipse cx="34" cy="66" rx="5" ry="2.2" transform="rotate(-22 34 66)" fill="#16A34A" />
          <line x1="72" y1="54" x2="72" y2="74" stroke="#6B21A8" strokeWidth="2" strokeLinecap="round" />
          <line x1="65" y1="74" x2="79" y2="74" stroke="#6B21A8" strokeWidth="2" strokeLinecap="round" />
          <path d="M63 34 H81 Q82 54 72 54 Q62 54 63 34 Z" fill="rgba(255,255,255,0.78)" stroke="#A855F7" strokeWidth="1.8" />
          <path d="M64 44 H80 Q80 53 72 53 Q64 53 64 44 Z" fill="#9F1239" />
        </g>
      )}

      {artKey === 'generic' && (
        <g>
          <circle cx="50" cy="50" r="25" fill={accentBg || '#3B82F6'} />
          <text
            x="50"
            y="53"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#FFFFFF"
            fontSize="26"
            fontWeight="900"
          >
            {symbolNumber}
          </text>
        </g>
      )}
    </svg>
  );
};

export const CandidateThumbnail: React.FC<CandidateThumbnailProps> = ({
  candidate,
  className = 'w-16 h-16 rounded-xl',
  showZoomHint = false,
  onClick,
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(
    candidate.imageCrop ? null : candidate.imageUrl || null
  );
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  const cropKey = candidate.imageCrop
    ? `${candidate.imageCrop.src}|${candidate.imageCrop.col}|${candidate.imageCrop.row}|${candidate.imageCrop.cropTop}|${candidate.imageCrop.cropBottom}|${candidate.imageCrop.insetX ?? ''}`
    : '';

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);

    if (candidate.imageCrop) {
      getCroppedImageDataUrl(candidate.imageCrop, 360).then((dataUrl) => {
        if (cancelled) return;
        if (dataUrl) {
          setResolvedSrc(dataUrl);
          setLoadFailed(false);
        } else {
          setResolvedSrc(null);
          setLoadFailed(true);
        }
      });
    } else if (candidate.imageUrl) {
      setResolvedSrc(candidate.imageUrl);
    } else {
      setResolvedSrc(null);
      setLoadFailed(true);
    }

    return () => {
      cancelled = true;
    };
  }, [cropKey, candidate.imageUrl, candidate.imageCrop]);

  const artKey = detectSnackArtKey(candidate);
  const content =
    resolvedSrc && !loadFailed ? (
      <img
        src={resolvedSrc}
        alt={candidate.title}
        referrerPolicy="no-referrer"
        onError={() => setLoadFailed(true)}
        className="w-full h-full object-cover select-none"
      />
    ) : (
      <FallbackSnackSvg
        artKey={artKey}
        accentBg={candidate.accentBg}
        symbolNumber={candidate.symbolNumber}
      />
    );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${candidate.title} 사진 크게 보기`}
        className={`relative overflow-hidden shrink-0 group cursor-zoom-in border border-slate-300/80 shadow-sm ${className}`}
      >
        {content}
        {showZoomHint && (
          <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-slate-900/75 text-white flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-110 transition">
            <ZoomIn className="w-3 h-3" />
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={`relative overflow-hidden shrink-0 border border-slate-300/70 shadow-sm ${className}`}>
      {content}
    </div>
  );
};

interface CandidateImageLightboxProps {
  candidate: Candidate | null;
  onClose: () => void;
}

export const CandidateImageLightbox: React.FC<CandidateImageLightboxProps> = ({
  candidate,
  onClose,
}) => {
  if (!candidate) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-950/88 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-slate-200 animate-in zoom-in-95 duration-150"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-slate-900/75 hover:bg-slate-900 text-white flex items-center justify-center transition cursor-pointer"
          aria-label="사진 닫기"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-full aspect-square bg-slate-100">
          <CandidateThumbnail
            candidate={candidate}
            className="w-full h-full rounded-none border-0"
          />
        </div>

        <div className="p-4 bg-white space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="px-2 py-0.5 rounded-md text-xs font-black text-white"
              style={{ backgroundColor: candidate.accentBg || '#3B82F6' }}
            >
              기호 {candidate.symbolNumber}번
            </span>
            <span className="text-xs font-bold text-slate-500">
              {candidate.party}
            </span>
          </div>
          <h4 className="text-base font-black text-slate-900 whitespace-normal break-keep break-words">
            {candidate.title}
          </h4>
          {(candidate.subtitle || candidate.description) && (
            <p className="text-xs text-slate-600 whitespace-normal break-keep break-words leading-relaxed">
              {candidate.subtitle || candidate.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
