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
  const marginX = Math.min(naturalWidth * 0.01, colWidth * 0.15);

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
  const cacheKey = `${crop.src}|${crop.col},${crop.row}|${crop.cols}x${crop.rows}|${crop.cropTop}-${crop.cropBottom}|${outputSize}`;
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
