import { Candidate } from '../types';
import { BETA_DISCLAIMER_TEXT, PollWinnerSummary } from '../data/presetPolls';

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number = 3
): string[] {
  const clean = (text || '').trim();
  if (!clean) return [''];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  const pushCharWrapped = (token: string) => {
    const chars = Array.from(token);
    for (const ch of chars) {
      const next = current + ch;
      if (ctx.measureText(next).width > maxWidth && current) {
        lines.push(current);
        current = ch;
        if (lines.length >= maxLines) return;
      } else {
        current = next;
      }
    }
  };

  for (const word of words) {
    if (lines.length >= maxLines) break;
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else if (!current) {
      pushCharWrapped(word);
    } else {
      lines.push(current);
      if (lines.length >= maxLines) {
        current = '';
        break;
      }
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        current = '';
        pushCharWrapped(word);
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  // Add ellipsis on last line if truncated
  if (lines.length === maxLines) {
    const joined = lines.join(' ');
    if (joined.length < clean.length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(last + '…').width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + '…';
    }
  }

  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function formatIssuedAtKorean(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}년 ${m}월 ${d}일 ${hh}:${mm}`;
}

export interface OfficialImageRenderInput {
  pollTitle: string;
  candidates: Candidate[];
  winnerSummary: PollWinnerSummary;
  isClosed: boolean;
  issuedAt?: Date;
}

/**
 * 1. Official Winner Certificate (1080 x 1350)
 *    Gold double border + Red '卜' stamp + Winner details + Official Seal
 */
export async function renderWinnerCertificateCanvas(
  input: OfficialImageRenderInput
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading timeout
    }
  }

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Warm parchment background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#fffef9');
  bgGrad.addColorStop(0.5, '#fffcf2');
  bgGrad.addColorStop(1, '#fdf8ea');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle background emblem watermark
  ctx.save();
  ctx.fillStyle = 'rgba(197, 160, 89, 0.06)';
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 + 40, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '800 54px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillStyle = 'rgba(197, 160, 89, 0.09)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VOTEVERSE', W / 2, H / 2 + 40);
  ctx.restore();

  // Ornate gold double borders
  ctx.strokeStyle = '#c5a059';
  ctx.lineWidth = 14;
  ctx.strokeRect(36, 36, W - 72, H - 72);

  ctx.strokeStyle = '#856424';
  ctx.lineWidth = 3;
  ctx.strokeRect(56, 56, W - 112, H - 112);

  // Decorative corner accents
  const corners = [
    [68, 68],
    [W - 68, 68],
    [68, H - 68],
    [W - 68, H - 68],
  ];
  ctx.fillStyle = '#c5a059';
  corners.forEach(([cx, cy]) => {
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // Top Red '卜' Ballot Stamp Emblem
  ctx.save();
  ctx.fillStyle = '#fff1f2';
  ctx.beginPath();
  ctx.arc(W / 2, 136, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = '#e11d48';
  ctx.font = '800 42px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('卜', W / 2, 138);
  ctx.restore();

  // Top Sub-badge
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#92400e';
  ctx.font = '700 22px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('보트버스 VOTEVERSE · 공식 선정 인증서', W / 2, 206);

  // Main Title
  ctx.fillStyle = '#1c1917';
  ctx.font = '800 68px "Song Myung", "Noto Serif KR", serif';
  ctx.fillText('공  식  당  선  증', W / 2, 278);

  ctx.fillStyle = '#78716c';
  ctx.font = '600 22px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('OFFICIAL SELECTION CERTIFICATE', W / 2, 330);

  // Divider
  ctx.strokeStyle = '#d6c39c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(150, 368);
  ctx.lineTo(W - 150, 368);
  ctx.stroke();

  // Poll Title Box
  drawRoundedRect(ctx, 110, 396, W - 220, 128, 18);
  ctx.fillStyle = '#f9f5eb';
  ctx.fill();
  ctx.strokeStyle = '#e2d3b3';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#78716c';
  ctx.font = '700 21px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('투표 안건', W / 2, 428);

  ctx.fillStyle = '#1c1917';
  ctx.font = '800 32px "Pretendard", "Noto Sans KR", sans-serif';
  const titleLines = wrapTextLines(ctx, input.pollTitle, W - 280, 2);
  if (titleLines.length === 1) {
    ctx.fillText(titleLines[0], W / 2, 478);
  } else {
    ctx.font = '800 28px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(titleLines[0], W / 2, 464);
    ctx.fillText(titleLines[1], W / 2, 500);
  }

  // Winner Spotlight Box
  const boxX = 110;
  const boxY = 550;
  const boxW = W - 220;
  const boxH = 340;
  drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 24);
  const cardGrad = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
  cardGrad.addColorStop(0, '#fffbeb');
  cardGrad.addColorStop(1, '#fef3c7');
  ctx.fillStyle = cardGrad;
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 3;
  ctx.stroke();

  const { winnerSummary } = input;

  if (!winnerSummary.hasVotes) {
    ctx.fillStyle = '#78716c';
    ctx.font = '800 28px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('개표 결과 안내', W / 2, boxY + 95);
    ctx.fillStyle = '#1c1917';
    ctx.font = '800 42px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('투표 없음 (총 0표)', W / 2, boxY + 175);
    ctx.fillStyle = '#57534e';
    ctx.font = '600 24px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('투표 기간 내 집계된 표가 없습니다.', W / 2, boxY + 245);
  } else {
    // Winner Status Pill
    const statusLabel = winnerSummary.isTie
      ? `🏆 최종 공동 1위 선정 (${winnerSummary.winners.length}건)`
      : input.isClosed
      ? '🏆 최종 제1위 당선 확정'
      : '🏆 현재 제1위 선두';
    drawRoundedRect(ctx, W / 2 - 190, boxY + 28, 380, 44, 22);
    ctx.fillStyle = '#b45309';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 22px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(statusLabel, W / 2, boxY + 51);

    const winners = winnerSummary.winners;
    if (winners.length === 1) {
      const w = winners[0];
      const accent = w.accentBg || '#2563eb';

      // Party Colored Pill
      ctx.font = '800 22px "Pretendard", "Noto Sans KR", sans-serif';
      const partyText = `기호 ${w.symbolNumber}번 · ${w.party}`;
      const partyW = Math.min(boxW - 80, Math.max(220, ctx.measureText(partyText).width + 54));
      drawRoundedRect(ctx, W / 2 - partyW / 2, boxY + 92, partyW, 42, 21);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(partyText, W / 2, boxY + 114);

      // Winner Title
      ctx.fillStyle = '#1c1917';
      ctx.font = '800 44px "Pretendard", "Noto Sans KR", sans-serif';
      const wLines = wrapTextLines(ctx, w.title, boxW - 90, 2);
      if (wLines.length === 1) {
        ctx.fillText(wLines[0], W / 2, boxY + 188);
      } else {
        ctx.font = '800 36px "Pretendard", "Noto Sans KR", sans-serif';
        ctx.fillText(wLines[0], W / 2, boxY + 170);
        ctx.fillText(wLines[1], W / 2, boxY + 214);
      }
    } else {
      // Co-winners (tie): list neatly up to 3 rows
      const shown = winners.slice(0, 3);
      const startY = shown.length === 2 ? boxY + 112 : boxY + 95;
      const stepY = shown.length === 2 ? 64 : 50;

      shown.forEach((w, idx) => {
        const cy = startY + idx * stepY;
        const accent = w.accentBg || '#2563eb';
        const pillText = `기호 ${w.symbolNumber}번 ${w.party}`;
        ctx.font = '800 18px "Pretendard", "Noto Sans KR", sans-serif';
        const pW = Math.min(240, ctx.measureText(pillText).width + 28);

        drawRoundedRect(ctx, boxX + 48, cy - 18, pW, 36, 18);
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(pillText, boxX + 48 + pW / 2, cy);

        ctx.fillStyle = '#1c1917';
        ctx.font = '800 28px "Pretendard", "Noto Sans KR", sans-serif';
        ctx.textAlign = 'left';
        const label = wrapTextLines(ctx, w.title, boxW - 110 - pW, 1)[0];
        ctx.fillText(label, boxX + 64 + pW, cy);
      });
      ctx.textAlign = 'center';
      if (winners.length > 3) {
        ctx.fillStyle = '#92400e';
        ctx.font = '700 18px "Pretendard", "Noto Sans KR", sans-serif';
        ctx.fillText(`외 공동 1위 ${winners.length - 3}개 후보`, W / 2, boxY + 236);
      }
    }

    // Bottom Stats Strip inside Winner Box
    drawRoundedRect(ctx, boxX + 40, boxY + 258, boxW - 80, 58, 14);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fill();
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#44403c';
    ctx.font = '700 24px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(
      `최종 득표수 ${winnerSummary.maxVotes}표   |   득표율 ${winnerSummary.percent}%   |   총 참여 유권자 ${winnerSummary.totalVotes}명`,
      W / 2,
      boxY + 288
    );
  }

  // Official Certification Declaration
  ctx.fillStyle = '#1c1917';
  ctx.font = '500 30px "Song Myung", "Noto Serif KR", serif';
  const certLines = [
    '위 후보(안건)는 보트버스(VOTEVERSE) 유권자들의',
    '민주적이고 공정한 3D 직접 투표를 통해',
    '최종 제1위로 선정되었음을 공식 인증합니다.',
  ];
  certLines.forEach((line, idx) => {
    ctx.fillText(line, W / 2, 956 + idx * 48);
  });

  // Issuance Timestamp
  const issuedStr = formatIssuedAtKorean(input.issuedAt || new Date());
  ctx.fillStyle = '#57534e';
  ctx.font = '600 24px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText(`발급일시 : ${issuedStr}`, W / 2, 1134);

  // Authority + Official Red Square Seal Stamp
  ctx.fillStyle = '#0c4a6e';
  ctx.font = '800 30px "Song Myung", "Noto Serif KR", serif';
  ctx.fillText('보트버스(VOTEVERSE) 중앙일상선거관리위원회', W / 2 - 58, 1212);

  const sealX = W / 2 + 295;
  const sealY = 1208;
  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 6;
  ctx.strokeRect(sealX - 48, sealY - 48, 96, 96);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sealX - 41, sealY - 41, 82, 82);
  ctx.fillStyle = '#dc2626';
  ctx.font = '800 22px "Noto Serif KR", serif';
  ctx.fillText('보트버스', sealX, sealY - 15);
  ctx.fillText('선관위인', sealX, sealY + 17);
  ctx.restore();

  // Bottom Beta Disclaimer
  ctx.fillStyle = '#78716c';
  ctx.font = '500 17px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText(BETA_DISCLAIMER_TEXT, W / 2, H - 78);

  return canvas;
}

/**
 * 2. Final Results Announcement Board Card (1080 x 1350)
 *    Deep navy broadcast scoreboard style with color bars, rankings & VOTEVERSE footer
 */
export async function renderFinalResultsCanvas(
  input: OfficialImageRenderInput
): Promise<HTMLCanvasElement> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Deep Navy Broadcast Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#070d1d');
  bgGrad.addColorStop(0.55, '#0c1630');
  bgGrad.addColorStop(1, '#081022');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle ambient broadcast glow
  const glow1 = ctx.createRadialGradient(180, 140, 20, 180, 140, 420);
  glow1.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
  glow1.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W - 160, 220, 20, W - 160, 220, 420);
  glow2.addColorStop(0, 'rgba(16, 185, 129, 0.14)');
  glow2.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Outer sleek frame
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 28, 28, W - 56, H - 56, 28);
  ctx.stroke();

  // Top Header Badge
  ctx.textBaseline = 'middle';
  drawRoundedRect(ctx, 72, 66, 370, 44, 22);
  ctx.fillStyle = 'rgba(225, 29, 72, 0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Mini '卜' icon circle inside badge
  ctx.fillStyle = '#e11d48';
  ctx.beginPath();
  ctx.arc(98, 88, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 17px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('卜', 98, 89);

  ctx.fillStyle = '#fda4af';
  ctx.font = '800 20px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('보트버스 공식 개표 결과 공고', 124, 89);

  // Status tag on top-right
  const statusTag = input.isClosed ? '🏁 개표 확정 (100%)' : '📡 실시간 집계 현황';
  drawRoundedRect(ctx, W - 296, 66, 224, 44, 22);
  ctx.fillStyle = input.isClosed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.18)';
  ctx.fill();
  ctx.strokeStyle = input.isClosed ? 'rgba(52, 211, 153, 0.6)' : 'rgba(56, 189, 248, 0.5)';
  ctx.stroke();
  ctx.fillStyle = input.isClosed ? '#6ee7b7' : '#7dd3fc';
  ctx.font = '800 19px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statusTag, W - 184, 89);

  // Poll Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 42px "Pretendard", "Noto Sans KR", sans-serif';
  const titleLines = wrapTextLines(ctx, input.pollTitle, W - 144, 2);
  let cursorY = 160;
  titleLines.forEach((line) => {
    ctx.fillText(line, 72, cursorY);
    cursorY += 54;
  });

  // Subtitle stats
  const totalVotes = input.candidates.reduce((s, c) => s + (Number(c.votes) || 0), 0);
  const issuedStr = formatIssuedAtKorean(input.issuedAt || new Date());
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 22px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText(
    `총 참여 유권자 ${totalVotes}명  ·  후보 ${input.candidates.length}개  ·  공고시각 ${issuedStr}`,
    72,
    cursorY + 6
  );

  // 1st Place Highlight Banner
  const bannerY = cursorY + 38;
  const bannerH = 128;
  drawRoundedRect(ctx, 72, bannerY, W - 144, bannerH, 20);
  const bannerGrad = ctx.createLinearGradient(72, bannerY, W - 72, bannerY + bannerH);
  bannerGrad.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
  bannerGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.2)');
  bannerGrad.addColorStop(1, 'rgba(249, 115, 22, 0.18)');
  ctx.fillStyle = bannerGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const { winnerSummary } = input;
  if (!winnerSummary.hasVotes) {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '800 26px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText('🏆 최종 개표 확정 결과: 투표 없음 (0표)', 106, bannerY + bannerH / 2);
  } else {
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '800 21px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(
      winnerSummary.isTie
        ? '🏆 최종 공동 1위 당선 확정'
        : input.isClosed
        ? '🏆 최종 제1위 당선 확정'
        : '🏆 현재 제1위 선두',
      104,
      bannerY + 38
    );

    const winnerDisplay = winnerSummary.winners
      .map((w) => `[기호 ${w.symbolNumber}번] ${w.title} (${w.party})`)
      .join(' · ');
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 30px "Pretendard", "Noto Sans KR", sans-serif';
    const wDisplayLine = wrapTextLines(ctx, winnerDisplay, W - 380, 1)[0];
    ctx.fillText(wDisplayLine, 104, bannerY + 86);

    // Right big percentage badge
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 38px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(`${winnerSummary.percent}%`, W - 104, bannerY + 56);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 20px "Pretendard", "Noto Sans KR", sans-serif';
    ctx.fillText(`${winnerSummary.maxVotes}표 획득`, W - 104, bannerY + 96);
    ctx.textAlign = 'left';
  }

  // Candidate Ranking List Header
  const listStartY = bannerY + bannerH + 34;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '800 22px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('전체 후보자 개표 순위표 (기호순 / 득표율)', 72, listStartY);

  // Sort candidates by votes descending, preserving symbolNumber tie-breaker
  const ranked = [...input.candidates].sort(
    (a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0) || a.symbolNumber - b.symbolNumber
  );

  const listTop = listStartY + 26;
  const footerReserved = 136;
  const availableH = H - footerReserved - listTop;
  const count = Math.max(1, ranked.length);
  const gap = count > 6 ? 10 : 14;
  const rowH = Math.min(118, Math.floor((availableH - gap * (count - 1)) / count));
  const compact = rowH < 86;

  const fallbackPalette = [
    '#f43f5e',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
    '#ec4899',
    '#14b8a6',
    '#84cc16',
  ];

  let prevVotes = -1;
  let currentRank = 0;

  ranked.forEach((cand, idx) => {
    const votes = Number(cand.votes) || 0;
    if (votes !== prevVotes) {
      currentRank = idx + 1;
      prevVotes = votes;
    }
    const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    const isTop = winnerSummary.hasVotes && votes === winnerSummary.maxVotes;
    const accent = cand.accentBg || fallbackPalette[(cand.symbolNumber - 1) % fallbackPalette.length];

    const y = listTop + idx * (rowH + gap);
    drawRoundedRect(ctx, 72, y, W - 144, rowH, 16);
    ctx.fillStyle = isTop ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = isTop ? 'rgba(251, 191, 36, 0.65)' : 'rgba(51, 65, 85, 0.85)';
    ctx.lineWidth = isTop ? 2 : 1.5;
    ctx.stroke();

    // Rank badge
    const rankBoxSize = compact ? 38 : 46;
    const rankX = 92;
    const rankY = y + (compact ? 14 : 18);
    drawRoundedRect(ctx, rankX, rankY, rankBoxSize, rankBoxSize, 12);
    ctx.fillStyle = isTop ? '#f59e0b' : '#1e293b';
    ctx.fill();
    ctx.fillStyle = isTop ? '#0f172a' : '#cbd5e1';
    ctx.font = `800 ${compact ? 18 : 20}px "Pretendard", "Noto Sans KR", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${currentRank}위`, rankX + rankBoxSize / 2, rankY + rankBoxSize / 2 + 1);

    // Symbol pill
    const symX = rankX + rankBoxSize + 12;
    const symW = compact ? 74 : 84;
    drawRoundedRect(ctx, symX, rankY + 4, symW, compact ? 30 : 34, 10);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${compact ? 15 : 17}px "Pretendard", "Noto Sans KR", sans-serif`;
    ctx.fillText(`기호 ${cand.symbolNumber}번`, symX + symW / 2, rankY + (compact ? 19 : 21));

    // Candidate Title + Party
    const textX = symX + symW + 14;
    const rightColW = 195;
    const textMaxW = W - 92 - textX - rightColW;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${compact ? 21 : 25}px "Pretendard", "Noto Sans KR", sans-serif`;
    const cTitle = wrapTextLines(ctx, cand.title, textMaxW, 1)[0];
    ctx.fillText(cTitle, textX, rankY + (compact ? 12 : 14));

    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 ${compact ? 15 : 17}px "Pretendard", "Noto Sans KR", sans-serif`;
    const cParty = wrapTextLines(ctx, cand.party || `기호 ${cand.symbolNumber}번`, textMaxW, 1)[0];
    ctx.fillText(cParty, textX, rankY + (compact ? 34 : 40));

    // Votes & Percent on right
    ctx.textAlign = 'right';
    ctx.fillStyle = isTop ? '#fde68a' : '#f8fafc';
    ctx.font = `800 ${compact ? 24 : 28}px "Pretendard", "Noto Sans KR", sans-serif`;
    ctx.fillText(`${percent}%`, W - 96, rankY + (compact ? 12 : 14));
    ctx.fillStyle = '#94a3b8';
    ctx.font = `700 ${compact ? 15 : 17}px "Pretendard", "Noto Sans KR", sans-serif`;
    ctx.fillText(`${votes}표`, W - 96, rankY + (compact ? 34 : 40));

    // Progress Bar Track
    const barX = 92;
    const barW = W - 184;
    const barH = compact ? 10 : 14;
    const barY = y + rowH - barH - (compact ? 12 : 16);
    drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    const fillW = totalVotes > 0 ? Math.max(barH, Math.round((percent / 100) * barW)) : 0;
    if (fillW > 0) {
      drawRoundedRect(ctx, barX, barY, fillW, barH, barH / 2);
      ctx.fillStyle = accent;
      ctx.fill();
    }
  });

  // Brand Footer
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(72, H - 108);
  ctx.lineTo(W - 72, H - 108);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '800 22px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('클릭 대신 발걸음으로, 우리가 만나는 3D 투표 광장 — VOTEVERSE', W / 2, H - 76);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 16px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText(BETA_DISCLAIMER_TEXT, W / 2, H - 48);

  return canvas;
}

export function downloadCanvasAsPng(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
