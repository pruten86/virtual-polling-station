import React from 'react';
import { AvatarType, AVATAR_META, normalizeAvatarType } from '../types';

interface AvatarIllustrationProps {
  avatarType: AvatarType | string;
  className?: string;
}

/**
 * Miniature clay-figure SVG bust illustration for each of the 6 avatar variants.
 * Used in both the Lobby 3x2 avatar picker and the Digital Vote Certificate.
 */
export const AvatarIllustration: React.FC<AvatarIllustrationProps> = ({
  avatarType,
  className = 'w-12 h-12',
}) => {
  const type = normalizeAvatarType(avatarType);
  const meta = AVATAR_META[type];

  return (
    <svg
      viewBox="0 0 80 80"
      className={className}
      role="img"
      aria-label={meta.fullName}
    >
      {/* Warm soft pastel circular background */}
      <circle cx="40" cy="40" r="38" fill={meta.bgSoft} />

      {/* Back Hair Layer (rendered behind neck/face for bob, low bun, and long straight hair) */}
      {type === 'female_1' && (
        <>
          <ellipse cx="40" cy="40" rx="22" ry="20" fill={meta.hairColor} />
          <circle cx="22" cy="45" r="7.5" fill={meta.hairColor} />
          <circle cx="58" cy="45" r="7.5" fill={meta.hairColor} />
        </>
      )}

      {type === 'female_2' && (
        <>
          {/* Cute round low bun peeking behind right-lower crown + cream hair tie */}
          <circle cx="56" cy="46" r="8.5" fill={meta.hairColor} />
          <circle cx="51" cy="45" r="3" fill="#E8B84B" />
          <ellipse cx="40" cy="36" rx="19" ry="17" fill={meta.hairColor} />
        </>
      )}

      {type === 'female_3' && (
        <>
          {/* Long straight choco-brown hair flowing softly past shoulders */}
          <path
            d="M19 34 C18 20, 62 20, 61 34 L63 66 C63 72, 17 72, 17 66 Z"
            fill={meta.hairColor}
          />
        </>
      )}

      {/* Shoulders & Pastel Outfit Layer */}
      {type === 'female_2' ? (
        <>
          {/* White long-sleeve shirt base */}
          <path
            d="M14 78 C15 61, 24 55, 40 55 C56 55, 65 61, 66 78 Z"
            fill="#FFFDF8"
          />
          {/* Butter yellow knit vest center */}
          <path
            d="M25 78 L26 57 C30 55.5, 35 55, 40 55 C45 55, 50 55.5, 54 57 L55 78 Z"
            fill={meta.topColor}
          />
          {/* Crisp white shirt collar V */}
          <polygon points="33,55 40,63 47,55" fill="#FFFDF8" />
        </>
      ) : type === 'male_3' ? (
        <>
          {/* Dusty blue cardigan */}
          <path
            d="M14 78 C15 61, 24 55, 40 55 C56 55, 65 61, 66 78 Z"
            fill={meta.topColor}
          />
          {/* Cream inner shirt V-neck strip */}
          <polygon points="33,55 40,71 47,55" fill="#FAF3E7" />
          {/* Cardigan buttons */}
          <circle cx="40" cy="74" r="1.7" fill="#4A4E57" />
        </>
      ) : (
        <>
          {/* Cozy rounded clay sweater / knit dress */}
          <path
            d="M14 78 C15 61, 24 55, 40 55 C56 55, 65 61, 66 78 Z"
            fill={meta.topColor}
          />
          {/* Knit ribbed crew collar */}
          <ellipse cx="40" cy="56.5" rx="9" ry="3.5" fill={meta.accentColor} opacity="0.65" />
          {type === 'male_1' && (
            <>
              <circle cx="40" cy="64" r="1.8" fill="#C48F22" />
              <circle cx="40" cy="71" r="1.8" fill="#C48F22" />
            </>
          )}
          {type === 'female_1' && (
            <>
              <circle cx="35.5" cy="59.5" r="2.1" fill="#F6E2A4" />
              <circle cx="44.5" cy="59.5" r="2.1" fill="#F6E2A4" />
            </>
          )}
          {type === 'female_3' && (
            <path
              d="M32 57 Q40 62 48 57"
              fill="none"
              stroke="#E6D8F6"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          )}
        </>
      )}

      {/* Neck */}
      <rect x="35.5" y="48" width="9" height="9" rx="4" fill="#F2C8AA" />

      {/* Cute Round Ears */}
      <circle cx="22.5" cy="39" r="4" fill="#F8D5BC" />
      <circle cx="57.5" cy="39" r="4" fill="#F8D5BC" />

      {/* Plump Clay Head */}
      <circle cx="40" cy="37" r="17.5" fill="#F8D5BC" />

      {/* Soft Rosy Cheek Blushes */}
      <ellipse cx="29.5" cy="41.5" rx="3.8" ry="2.2" fill="#F29F9F" opacity="0.65" />
      <ellipse cx="50.5" cy="41.5" rx="3.8" ry="2.2" fill="#F29F9F" opacity="0.65" />

      {/* Cute Round Dot Eyes + Tiny White Catchlight */}
      <circle cx="33.5" cy="37.5" r="2.3" fill="#2A1F1A" />
      <circle cx="34.2" cy="36.8" r="0.8" fill="#FFFFFF" />
      <circle cx="46.5" cy="37.5" r="2.3" fill="#2A1F1A" />
      <circle cx="47.2" cy="36.8" r="0.8" fill="#FFFFFF" />

      {/* Gentle Clay Smile */}
      <path
        d="M36.5 43.2 Q40 46 43.5 43.2"
        fill="none"
        stroke="#B66F5D"
        strokeWidth="1.9"
        strokeLinecap="round"
      />

      {/* Front Hair / Bangs per Variant */}
      {type === 'male_1' && (
        <path
          d="M22 35 C22 19, 58 19, 58 35 C55 28, 49 27, 45 29 C41 25, 34 26, 30 29 C27 28, 24 30, 22 35 Z"
          fill={meta.hairColor}
        />
      )}

      {type === 'male_2' && (
        <>
          {/* Voluminous parted bangs */}
          <path
            d="M21 36 C20 18, 59 17, 59 36 C56 30, 50 28, 46 31 C45 25, 42 23, 39 24 C36 28, 28 29, 21 36 Z"
            fill={meta.hairColor}
          />
          <circle cx="32" cy="24" r="6" fill={meta.hairColor} />
          <circle cx="49" cy="24.5" r="5.5" fill={meta.hairColor} />
        </>
      )}

      {type === 'male_3' && (
        <>
          {/* Neat dandy short bangs */}
          <path
            d="M22 35 C22 19, 58 19, 58 35 C54 29, 48 27, 42 28 C37 26, 28 28, 22 35 Z"
            fill={meta.hairColor}
          />
          {/* Cute Round Horn-Rimmed Glasses */}
          <circle
            cx="33.5"
            cy="37.5"
            r="5.3"
            fill="rgba(255,255,255,0.18)"
            stroke="#2E2019"
            strokeWidth="1.9"
          />
          <circle
            cx="46.5"
            cy="37.5"
            r="5.3"
            fill="rgba(255,255,255,0.18)"
            stroke="#2E2019"
            strokeWidth="1.9"
          />
          <line x1="38.8" y1="37.5" x2="41.2" y2="37.5" stroke="#2E2019" strokeWidth="1.8" />
          <line x1="22.5" y1="36.8" x2="28.2" y2="37.2" stroke="#2E2019" strokeWidth="1.5" />
          <line x1="51.8" y1="37.2" x2="57.5" y2="36.8" stroke="#2E2019" strokeWidth="1.5" />
        </>
      )}

      {type === 'female_1' && (
        <path
          d="M21 37 C21 19, 59 19, 59 37 C55 29, 50 28, 45 29 C40 27, 35 27, 31 29 C27 28, 24 31, 21 37 Z"
          fill={meta.hairColor}
        />
      )}

      {type === 'female_2' && (
        <path
          d="M22 36 C22 19, 58 19, 58 36 C54 29, 48 27, 42 28 C36 27, 29 28, 22 36 Z"
          fill={meta.hairColor}
        />
      )}

      {type === 'female_3' && (
        <>
          {/* Soft side-swept long straight bangs */}
          <path
            d="M21 38 C21 19, 59 19, 59 38 C55 30, 49 27, 43 26 C38 29, 30 30, 21 38 Z"
            fill={meta.hairColor}
          />
          {/* Subtle long side framing locks */}
          <path d="M21 34 C19 44, 19 54, 23 62 L26 60 C23 52, 23 43, 24 35 Z" fill={meta.hairColor} />
          <path d="M59 34 C61 44, 61 54, 57 62 L54 60 C57 52, 57 43, 56 35 Z" fill={meta.hairColor} />
        </>
      )}
    </svg>
  );
};
