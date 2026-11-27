import { Candidate, CandidateImageCrop } from '../types';

const loadedImageCache = new Map<string, Promise<HTMLImageElement | null>>();
const croppedDataUrlCache = new Map<string, Promise<string | null>>();

/**
 * Loads an HTMLImageElement once and caches the result (returns null on failure without throwing).
 */
export function loadImageCached(src: string): Promise<HTMLImageElement | null> {
  const key = src.trim();
  if (!key) return Promise.resolve(null);
  const existing = loadedImageCache.get(key);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    // Enable CORS for remote http(s) URLs so Canvas export never gets tainted
    if (/^https?:\/\//i.test(key)) {
      img.crossOrigin = 'anonymous';
    }
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve(img);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = key;
  });

  loadedImageCache.set(key, promise);
  return promise;
}

/**
 * Computes exact source crop rectangle for a grid sprite sheet (excluding 1% inner horizontal margin per column).
 */
export function getImageCropRect(
  naturalWidth: number,
  naturalHeight: number,
  crop: CandidateImageCrop
): { sx: number; sy: number; sw: number; sh: number } {
  const cols = Math.max(1, crop.cols);
  const colWidth = naturalWidth / cols;
  const insetRatio = crop.insetX !== undefined ? Math.max(0, crop.insetX) : 0.01;
  const marginX = Math.min(naturalWidth * insetRatio, colWidth * 0.18);

  const sx = Math.max(0, crop.col * colWidth + marginX);
  const sw = Math.max(1, Math.min(naturalWidth - sx, colWidth - marginX * 2));
  const sy = Math.max(0, naturalHeight * crop.cropTop);
  const sh = Math.max(1, Math.min(naturalHeight - sy, naturalHeight * (crop.cropBottom - crop.cropTop)));

  return { sx, sy, sw, sh };
}

/**
 * Draws a source rect onto a destination rect with object-fit: cover semantics.
 */
function drawCoverRect(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  const srcRatio = sw / sh;
  const dstRatio = dw / dh;

  let drawSx = sx;
  let drawSy = sy;
  let drawSw = sw;
  let drawSh = sh;

  if (srcRatio > dstRatio) {
    drawSw = sh * dstRatio;
    drawSx = sx + (sw - drawSw) / 2;
  } else if (srcRatio < dstRatio) {
    drawSh = sw / dstRatio;
    drawSy = sy + (sh - drawSh) / 2;
  }

  ctx.drawImage(img, drawSx, drawSy, drawSw, drawSh, dx, dy, dw, dh);
}

/**
 * Produces a cached cropped square JPEG data URL from a CandidateImageCrop for crisp <img> & Lightbox display.
 */
export function getCroppedImageDataUrl(
  crop: CandidateImageCrop,
  outputSize = 360
): Promise<string | null> {
  const cacheKey = `${crop.src}|${crop.col},${crop.row}|${crop.cols}x${crop.rows}|${crop.cropTop}-${crop.cropBottom}|${crop.insetX ?? 0.01}|${outputSize}`;
  const existing = croppedDataUrlCache.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const img = await loadImageCached(crop.src);
    if (!img) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const { sx, sy, sw, sh } = getImageCropRect(img.naturalWidth, img.naturalHeight, crop);
      drawCoverRect(ctx, img, sx, sy, sw, sh, 0, 0, outputSize, outputSize);
      return canvas.toDataURL('image/jpeg', 0.9);
    } catch {
      return null;
    }
  })();

  croppedDataUrlCache.set(cacheKey, promise);
  return promise;
}

export type SnackArtKey =
  | 'bungeoppang'
  | 'hotteok'
  | 'sweetpotato'
  | 'eomuk'
  | 'hoppang'
  | 'hotchoco'
  | 'gyeranppang'
  | 'chestnut'
  | 'kimchistew'
  | 'tonkatsu'
  | 'salmonpoke'
  | 'gukbap'
  | 'samgyeopsal'
  | 'chimaek'
  | 'sashimi'
  | 'steakwine'
  | 'generic';

export function detectSnackArtKey(candidate?: Pick<Candidate, 'id' | 'title'> | null): SnackArtKey {
  const text = `${candidate?.id || ''} ${candidate?.title || ''}`.toLowerCase();
  if (text.includes('붕어빵') || text.includes('winter-snacks-1')) return 'bungeoppang';
  if (text.includes('호떡') || text.includes('winter-snacks-2')) return 'hotteok';
  if (text.includes('군고구마') || text.includes('고구마') || text.includes('winter-snacks-3')) return 'sweetpotato';
  if (text.includes('어묵') || text.includes('오뎅') || text.includes('winter-snacks-4')) return 'eomuk';
  if (text.includes('호빵') || text.includes('찐빵') || text.includes('winter-snacks-5')) return 'hoppang';
  if (text.includes('핫초코') || text.includes('코코아') || text.includes('winter-snacks-6')) return 'hotchoco';
  if (text.includes('계란빵') || text.includes('winter-snacks-7')) return 'gyeranppang';
  if (text.includes('군밤') || text.includes('winter-snacks-8')) return 'chestnut';
  if (text.includes('김치찌개') || text.includes('poll-lunch-1')) return 'kimchistew';
  if (text.includes('돈가스') || text.includes('돈까스') || text.includes('poll-lunch-2')) return 'tonkatsu';
  if (text.includes('포케') || text.includes('연어') || text.includes('poll-lunch-3')) return 'salmonpoke';
  if (text.includes('국밥') || text.includes('사골') || text.includes('poll-lunch-4')) return 'gukbap';
  if (text.includes('삼겹살') || text.includes('목살') || text.includes('poll-dinner-1')) return 'samgyeopsal';
  if (text.includes('치킨') || text.includes('수제맥주') || text.includes('치맥') || text.includes('poll-dinner-2')) return 'chimaek';
  if (text.includes('모듬회') || text.includes('매운탕') || text.includes('poll-dinner-3')) return 'sashimi';
  if (text.includes('스테이크') || text.includes('와인') || text.includes('poll-dinner-4')) return 'steakwine';
  return 'generic';
}

function drawSteamWisps(ctx: CanvasRenderingContext2D, cx: number, topY: number, scale: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = Math.max(1.5, 3 * scale);
  ctx.lineCap = 'round';
  [-16, 0, 16].forEach((ox, i) => {
    ctx.beginPath();
    const x = cx + ox * scale;
    const y0 = topY + (i === 1 ? -4 : 2) * scale;
    ctx.moveTo(x, y0 + 18 * scale);
    ctx.quadraticCurveTo(x - 6 * scale, y0 + 9 * scale, x + 2 * scale, y0);
    ctx.stroke();
  });
  ctx.restore();
}

/**
 * Draws a warm cozy Korean winter snack (or generic emblem) Canvas 2D illustration as a crisp fallback.
 */
export function drawCandidateFallbackArt(
  ctx: CanvasRenderingContext2D,
  candidate: Pick<Candidate, 'id' | 'title' | 'accentBg' | 'symbolNumber'>,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  const artKey = detectSnackArtKey(candidate);
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;
  const s = Math.min(dw, dh) / 100;

  const bgPalettes: Record<SnackArtKey, [string, string]> = {
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

  const [c1, c2] = bgPalettes[artKey];
  const grad = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(dx, dy, dw, dh);

  // Soft decorative glow halo behind snack
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.beginPath();
  ctx.arc(cx, cy + 4 * s, 34 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  if (artKey === 'bungeoppang') {
    drawSteamWisps(ctx, cx, cy - 36 * s, s * 0.8);
    // Golden crispy fish body
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.ellipse(cx - 4 * s, cy + 6 * s, 26 * s, 16 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin
    ctx.beginPath();
    ctx.moveTo(cx + 18 * s, cy + 4 * s);
    ctx.lineTo(cx + 33 * s, cy - 8 * s);
    ctx.lineTo(cx + 31 * s, cy + 16 * s);
    ctx.closePath();
    ctx.fill();
    // Warm golden inner highlight
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(cx - 5 * s, cy + 5 * s, 21 * s, 12 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // Waffle scales
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2 * s;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.arc(cx + i * 8 * s, cy + 5 * s, 4 * s, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    }
    // Cute eye
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.arc(cx - 17 * s, cy + 3 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (artKey === 'hotteok') {
    drawSteamWisps(ctx, cx, cy - 36 * s, s * 0.8);
    // Paper cup holder at bottom
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 22 * s, cy + 12 * s, 44 * s, 22 * s, 6 * s);
    ctx.fill();
    ctx.strokeStyle = '#FDBA74';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    // Griddled golden pancake disc
    ctx.fillStyle = '#C2410C';
    ctx.beginPath();
    ctx.arc(cx, cy + 2 * s, 25 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.arc(cx, cy + 1 * s, 21 * s, 0, Math.PI * 2);
    ctx.fill();
    // Golden crust sheen & honey seeds
    ctx.fillStyle = '#FDBA74';
    ctx.beginPath();
    ctx.ellipse(cx - 5 * s, cy - 4 * s, 11 * s, 6 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF3C7';
    [[-8, 6], [6, 8], [10, -4], [-2, 11], [2, -8]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy + oy * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (artKey === 'sweetpotato') {
    drawSteamWisps(ctx, cx, cy - 36 * s, s * 0.8);
    // Purple roasted sweet potato skin
    ctx.fillStyle = '#6D28D9';
    ctx.beginPath();
    ctx.ellipse(cx - 6 * s, cy + 8 * s, 24 * s, 14 * s, -0.35, 0, Math.PI * 2);
    ctx.fill();
    // Broken open bright honey-gold interior
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.ellipse(cx + 12 * s, cy + 4 * s, 14 * s, 12 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.ellipse(cx + 12 * s, cy + 3 * s, 9 * s, 7.5 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Charred roasted accents
    ctx.fillStyle = '#4C1D95';
    ctx.beginPath();
    ctx.ellipse(cx - 14 * s, cy + 12 * s, 7 * s, 3 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (artKey === 'eomuk') {
    drawSteamWisps(ctx, cx, cy - 38 * s, s * 0.8);
    // Paper broth cup
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(cx - 18 * s, cy + 4 * s);
    ctx.lineTo(cx + 18 * s, cy + 4 * s);
    ctx.lineTo(cx + 13 * s, cy + 32 * s);
    ctx.lineTo(cx - 13 * s, cy + 32 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    // Warm amber broth
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5 * s, 16 * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wooden skewer + folded fishcake waves
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 4 * s, cy + 10 * s);
    ctx.lineTo(cx + 8 * s, cy - 28 * s);
    ctx.stroke();
    ctx.fillStyle = '#FCD34D';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 1.6 * s;
    [-16, -6, 3].forEach((oy, i) => {
      ctx.beginPath();
      ctx.roundRect(cx - 12 * s + i * 2 * s, cy + oy * s, 26 * s, 8 * s, 4 * s);
      ctx.fill();
      ctx.stroke();
    });
  } else if (artKey === 'hoppang') {
    drawSteamWisps(ctx, cx, cy - 36 * s, s * 0.85);
    // Paper parchment bottom
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 20 * s, 26 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fluffy white steamed bun dome
    ctx.fillStyle = '#FFFDF9';
    ctx.beginPath();
    ctx.arc(cx, cy + 12 * s, 25 * s, Math.PI, 0, false);
    ctx.quadraticCurveTo(cx + 25 * s, cy + 21 * s, cx, cy + 21 * s);
    ctx.quadraticCurveTo(cx - 25 * s, cy + 21 * s, cx - 25 * s, cy + 12 * s);
    ctx.fill();
    ctx.strokeStyle = '#FDA4AF';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    // Warm red-bean smile peek
    ctx.fillStyle = '#9F1239';
    ctx.beginPath();
    ctx.ellipse(cx + 7 * s, cy + 10 * s, 7 * s, 4.5 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Soft blush
    ctx.fillStyle = 'rgba(251, 113, 133, 0.35)';
    ctx.beginPath();
    ctx.arc(cx - 10 * s, cy + 7 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (artKey === 'hotchoco') {
    drawSteamWisps(ctx, cx - 2 * s, cy - 38 * s, s * 0.8);
    // Mug handle
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.arc(cx + 18 * s, cy + 10 * s, 10 * s, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // Cozy ceramic mug
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.roundRect(cx - 21 * s, cy - 6 * s, 38 * s, 36 * s, [4 * s, 4 * s, 12 * s, 12 * s]);
    ctx.fill();
    // Rich cocoa top
    ctx.fillStyle = '#451A03';
    ctx.beginPath();
    ctx.ellipse(cx - 2 * s, cy - 5 * s, 18 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cute floating marshmallows
    ctx.fillStyle = '#FFFFFF';
    [[-8, -7], [3, -5], [-2, -10]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.roundRect(cx + ox * s, cy + oy * s, 8 * s, 6.5 * s, 2.5 * s);
      ctx.fill();
    });
  } else if (artKey === 'gyeranppang') {
    drawSteamWisps(ctx, cx, cy - 34 * s, s * 0.78);
    // Oval golden sweet loaf
    ctx.fillStyle = '#CA8A04';
    ctx.beginPath();
    ctx.roundRect(cx - 27 * s, cy - 6 * s, 54 * s, 30 * s, 14 * s);
    ctx.fill();
    ctx.fillStyle = '#EAB308';
    ctx.beginPath();
    ctx.roundRect(cx - 24 * s, cy - 9 * s, 48 * s, 24 * s, 12 * s);
    ctx.fill();
    // Whole cooked egg white + sunny yolk on top
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2 * s, 17 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(cx, cy + 2 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(cx - 2 * s, cy, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (artKey === 'chestnut') {
    drawSteamWisps(ctx, cx, cy - 34 * s, s * 0.75);
    // Three glossy roasted chestnuts
    const nuts = [
      { ox: -13, oy: 10, r: 14 },
      { ox: 13, oy: 12, r: 13 },
      { ox: 0, oy: -4, r: 15 },
    ];
    nuts.forEach(({ ox, oy, r }) => {
      const nx = cx + ox * s;
      const ny = cy + oy * s;
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.moveTo(nx, ny - r * s);
      ctx.quadraticCurveTo(nx + r * 1.15 * s, ny + 2 * s, nx, ny + r * 0.9 * s);
      ctx.quadraticCurveTo(nx - r * 1.15 * s, ny + 2 * s, nx, ny - r * s);
      ctx.fill();
      // Golden roasted crack peeking out
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(nx, ny + 2 * s, r * 0.42 * s, r * 0.24 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (artKey === 'kimchistew') {
    drawSteamWisps(ctx, cx, cy - 36 * s, s * 0.85);
    // Dark clay ttukbaegi pot body
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(cx, cy + 12 * s, 27 * s, 0, Math.PI, false);
    ctx.lineTo(cx - 27 * s, cy + 4 * s);
    ctx.lineTo(cx + 27 * s, cy + 4 * s);
    ctx.closePath();
    ctx.fill();
    // Pot rim
    ctx.fillStyle = '#44403C';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4 * s, 29 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rich crimson kimchi stew broth
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4 * s, 24 * s, 8.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Soft white tofu cubes & pork/kimchi chunks
    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.roundRect(cx - 13 * s, cy - 1 * s, 9 * s, 6 * s, 1.5 * s);
    ctx.roundRect(cx + 3 * s, cy + 1 * s, 9 * s, 6 * s, 1.5 * s);
    ctx.fill();
    // Fresh green onion rings
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 2.2 * s;
    [[-3, 6], [11, 2], [-15, 5]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy + oy * s, 2.8 * s, 0, Math.PI * 2);
      ctx.stroke();
    });
  } else if (artKey === 'tonkatsu') {
    // Crisp white ceramic plate
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 10 * s, 32 * s, 21 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    // Fresh shredded cabbage mound
    ctx.fillStyle = '#86EFAC';
    ctx.beginPath();
    ctx.arc(cx + 15 * s, cy - 1 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    // Golden crispy sliced pork cutlet
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.ellipse(cx - 3 * s, cy + 11 * s, 22 * s, 13 * s, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.ellipse(cx - 3 * s, cy + 9 * s, 20 * s, 11 * s, -0.08, 0, Math.PI * 2);
    ctx.fill();
    // Slice lines & savory dark tonkatsu sauce zigzag
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.8 * s;
    [-10, -2, 6].forEach((ox) => {
      ctx.beginPath();
      ctx.moveTo(cx + ox * s, cy + 1 * s);
      ctx.lineTo(cx + (ox - 2) * s, cy + 18 * s);
      ctx.stroke();
    });
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2.6 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 16 * s, cy + 8 * s);
    ctx.quadraticCurveTo(cx - 5 * s, cy + 4 * s, cx + 6 * s, cy + 11 * s);
    ctx.stroke();
  } else if (artKey === 'salmonpoke') {
    // Modern pastel ceramic bowl
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy + 6 * s, 28 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2.5 * s;
    ctx.stroke();
    // Fluffy brown-rice base
    ctx.fillStyle = '#FEFCE8';
    ctx.beginPath();
    ctx.arc(cx, cy + 6 * s, 23 * s, 0, Math.PI * 2);
    ctx.fill();
    // Fresh green avocado fan slices (left)
    ctx.fillStyle = '#22C55E';
    [[-12, 0], [-14, 7], [-9, 13]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.ellipse(cx + ox * s, cy + oy * s, 7.5 * s, 4 * s, -0.45, 0, Math.PI * 2);
      ctx.fill();
    });
    // Vibrant orange salmon cubes (right)
    ctx.fillStyle = '#FB7185';
    [[4, -4], [11, 2], [2, 5], [10, 11], [2, 14]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.roundRect(cx + ox * s, cy + oy * s, 8 * s, 7 * s, 2 * s);
      ctx.fill();
    });
    // Edamame dots & sesame
    ctx.fillStyle = '#15803D';
    [[-2, -9], [4, -10], [-7, -7]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy + oy * s, 3 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (artKey === 'gukbap') {
    drawSteamWisps(ctx, cx, cy - 36 * s, s * 0.85);
    // Traditional black earthen ttukbaegi pot
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.arc(cx, cy + 12 * s, 27 * s, 0, Math.PI, false);
    ctx.lineTo(cx - 27 * s, cy + 4 * s);
    ctx.lineTo(cx + 27 * s, cy + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#44403C';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4 * s, 29 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rich milky-ivory sagol bone broth
    ctx.fillStyle = '#FFFBEB';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4 * s, 24 * s, 8.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tender meat slices & red spicy dadaegi dollop
    ctx.fillStyle = '#B45309';
    [[-10, 4], [2, 6], [10, 2]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.ellipse(cx + ox * s, cy + oy * s, 6.5 * s, 3.2 * s, 0.15, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(cx - 1 * s, cy + 2 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    // Chopped green scallions
    ctx.fillStyle = '#16A34A';
    [[-14, 1], [-5, 8], [7, 8], [14, 4]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy + oy * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (artKey === 'samgyeopsal') {
    drawSteamWisps(ctx, cx, cy - 36 * s, s * 0.85);
    // Dark cast-iron Korean BBQ grill pan
    ctx.fillStyle = '#292524';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 9 * s, 32 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#57534E';
    ctx.lineWidth = 2.4 * s;
    ctx.stroke();
    // Sizzling golden-brown pork belly strips with marbled fat bands
    [-9, 3, 15].forEach((oy, idx) => {
      const rx = cx + (idx === 1 ? -1 : idx === 0 ? -4 : 2) * s;
      const ry = cy + oy * s;
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.roundRect(rx - 18 * s, ry - 5 * s, 36 * s, 9.5 * s, 4 * s);
      ctx.fill();
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.roundRect(rx - 15 * s, ry - 2.5 * s, 30 * s, 3.2 * s, 1.5 * s);
      ctx.fill();
      // Grill sear lines
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 1.6 * s;
      [-9, 0, 9].forEach((sx) => {
        ctx.beginPath();
        ctx.moveTo(rx + sx * s, ry - 4.5 * s);
        ctx.lineTo(rx + (sx - 2) * s, ry + 4 * s);
        ctx.stroke();
      });
    });
    // Roasted garlic cloves & fresh green lettuce accent
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(cx - 21 * s, cy + 12 * s, 7.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FEF3C7';
    [[19, 1], [22, 10]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy + oy * s, 3.6 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (artKey === 'chimaek') {
    // Frosty golden craft beer mug on right
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3.5 * s;
    ctx.beginPath();
    ctx.arc(cx + 26 * s, cy + 5 * s, 6.5 * s, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(cx + 6 * s, cy - 10 * s, 21 * s, 32 * s, [3 * s, 3 * s, 6 * s, 6 * s]);
    ctx.fill();
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();
    // Creamy white beer foam crown
    ctx.fillStyle = '#FFFFFF';
    [10, 16, 22].forEach((ox, i) => {
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy - 11 * s + (i === 1 ? -2 : 0) * s, 6 * s, 0, Math.PI * 2);
      ctx.fill();
    });
    // Crispy fried chicken drumstick on left
    ctx.fillStyle = '#FFFBEB';
    ctx.beginPath();
    ctx.roundRect(cx - 29 * s, cy + 12 * s, 14 * s, 6.5 * s, 3 * s);
    ctx.fill();
    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.ellipse(cx - 10 * s, cy + 9 * s, 16 * s, 12 * s, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(cx - 11 * s, cy + 7 * s, 12 * s, 8.5 * s, -0.25, 0, Math.PI * 2);
    ctx.fill();
    // Crispy golden crumbs
    ctx.fillStyle = '#B45309';
    [[-16, 4], [-7, 11], [-12, 13], [-4, 4]].forEach(([ox, oy]) => {
      ctx.beginPath();
      ctx.arc(cx + ox * s, cy + oy * s, 1.8 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (artKey === 'sashimi') {
    // Elegant dark slate sashimi platter
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8 * s, 32 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    // Fresh green shiso leaf garnish
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.ellipse(cx - 14 * s, cy + 2 * s, 12 * s, 7 * s, -0.35, 0, Math.PI * 2);
    ctx.fill();
    // Assorted glistening sashimi slices (salmon, white flounder, red snapper)
    const slices: Array<{ x: number; y: number; rot: number; fill: string; stripe: string }> = [
      { x: -12, y: 8, rot: -0.2, fill: '#FB7185', stripe: '#FFE4E6' },
      { x: 1, y: 4, rot: 0.05, fill: '#FFF7ED', stripe: '#FDBA74' },
      { x: 14, y: 9, rot: 0.25, fill: '#F97316', stripe: '#FFEDD5' },
      { x: -1, y: 15, rot: -0.05, fill: '#FCA5A5', stripe: '#FEF2F2' },
    ];
    slices.forEach(({ x, y, rot, fill, stripe }) => {
      ctx.save();
      ctx.translate(cx + x * s, cy + y * s);
      ctx.rotate(rot);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(-10 * s, -4.5 * s, 20 * s, 9 * s, 4.5 * s);
      ctx.fill();
      ctx.strokeStyle = stripe;
      ctx.lineWidth = 1.4 * s;
      [-4, 0, 4].forEach((lx) => {
        ctx.beginPath();
        ctx.moveTo(lx * s, -3.5 * s);
        ctx.lineTo((lx - 2) * s, 3.5 * s);
        ctx.stroke();
      });
      ctx.restore();
    });
    // Fresh lemon wedge & wasabi dot
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(cx + 18 * s, cy - 3 * s, 5.5 * s, Math.PI * 0.9, Math.PI * 2.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#84CC16';
    ctx.beginPath();
    ctx.arc(cx - 18 * s, cy + 16 * s, 3.8 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (artKey === 'steakwine') {
    drawSteamWisps(ctx, cx - 8 * s, cy - 34 * s, s * 0.72);
    // Warm white dining plate on left-center
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(cx - 5 * s, cy + 12 * s, 26 * s, 17 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#D8B4FE';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    // Thick seared steak medallion with grill marks & herb butter
    ctx.fillStyle = '#7C2D12';
    ctx.beginPath();
    ctx.ellipse(cx - 6 * s, cy + 11 * s, 18 * s, 11 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9A3412';
    ctx.beginPath();
    ctx.ellipse(cx - 6 * s, cy + 9.5 * s, 15.5 * s, 9 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 1.8 * s;
    [-12, -6, 0].forEach((sx) => {
      ctx.beginPath();
      ctx.moveTo(cx + sx * s, cy + 3 * s);
      ctx.lineTo(cx + (sx - 3) * s, cy + 15 * s);
      ctx.stroke();
    });
    // Melting herb butter pat + rosemary leaf
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(cx - 6 * s, cy + 9 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#16A34A';
    ctx.beginPath();
    ctx.ellipse(cx - 16 * s, cy + 16 * s, 5 * s, 2.2 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Elegant red wine glass on right
    const wx = cx + 22 * s;
    ctx.strokeStyle = '#6B21A8';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(wx, cy + 4 * s);
    ctx.lineTo(wx, cy + 24 * s);
    ctx.moveTo(wx - 7 * s, cy + 24 * s);
    ctx.lineTo(wx + 7 * s, cy + 24 * s);
    ctx.stroke();
    // Wine bowl glass outline + deep ruby red wine fill
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.beginPath();
    ctx.moveTo(wx - 9 * s, cy - 16 * s);
    ctx.lineTo(wx + 9 * s, cy - 16 * s);
    ctx.quadraticCurveTo(wx + 10 * s, cy + 4 * s, wx, cy + 4 * s);
    ctx.quadraticCurveTo(wx - 10 * s, cy + 4 * s, wx - 9 * s, cy - 16 * s);
    ctx.fill();
    ctx.strokeStyle = '#A855F7';
    ctx.lineWidth = 1.8 * s;
    ctx.stroke();
    ctx.fillStyle = '#9F1239';
    ctx.beginPath();
    ctx.moveTo(wx - 8 * s, cy - 6 * s);
    ctx.lineTo(wx + 8 * s, cy - 6 * s);
    ctx.quadraticCurveTo(wx + 8 * s, cy + 3 * s, wx, cy + 3 * s);
    ctx.quadraticCurveTo(wx - 8 * s, cy + 3 * s, wx - 8 * s, cy - 6 * s);
    ctx.fill();
  } else {
    // Generic warm candidate badge
    ctx.fillStyle = candidate.accentBg || '#3B82F6';
    ctx.beginPath();
    ctx.arc(cx, cy, 24 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `900 ${Math.round(24 * s)}px "Pretendard", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${candidate.symbolNumber || 1}`, cx, cy + 1 * s);
  }
  ctx.restore();
}

/**
 * Draws a candidate's real photo (imageCrop or imageUrl) onto a Canvas 2D context,
 * automatically falling back to warm custom artwork if the image fails to load.
 */
export async function drawCandidateVisualOnCanvas(
  ctx: CanvasRenderingContext2D,
  candidate: Pick<Candidate, 'id' | 'title' | 'accentBg' | 'symbolNumber' | 'imageUrl' | 'imageCrop'>,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  options?: { radius?: number; circle?: boolean }
): Promise<boolean> {
  ctx.save();
  ctx.beginPath();
  if (options?.circle) {
    ctx.arc(dx + dw / 2, dy + dh / 2, Math.min(dw, dh) / 2, 0, Math.PI * 2);
  } else if (options?.radius && options.radius > 0) {
    ctx.roundRect(dx, dy, dw, dh, options.radius);
  } else {
    ctx.rect(dx, dy, dw, dh);
  }
  ctx.clip();

  let drewPhoto = false;

  if (candidate.imageCrop) {
    const img = await loadImageCached(candidate.imageCrop.src);
    if (img) {
      const { sx, sy, sw, sh } = getImageCropRect(
        img.naturalWidth,
        img.naturalHeight,
        candidate.imageCrop
      );
      drawCoverRect(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh);
      drewPhoto = true;
    }
  } else if (candidate.imageUrl) {
    const img = await loadImageCached(candidate.imageUrl);
    if (img) {
      drawCoverRect(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, dw, dh);
      drewPhoto = true;
    }
  }

  if (!drewPhoto) {
    drawCandidateFallbackArt(ctx, candidate, dx, dy, dw, dh);
  }

  ctx.restore();
  return drewPhoto;
}

/**
 * Compresses an uploaded image file client-side into a crisp center-cropped square JPEG Data URL (default 240x240, quality 0.72).
 */
export function compressImageFileToDataUrl(
  file: File,
  targetSize = 240,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('지원하지 않는 이미지 형식입니다.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('이미지 압축 캔버스를 초기화할 수 없습니다.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetSize, targetSize);
        drawCoverRect(ctx, img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, targetSize, targetSize);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
