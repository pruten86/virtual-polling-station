import * as THREE from 'three';
import { Candidate, StationZone, hasCandidateImage } from '../types';
import { drawCandidateVisualOnCanvas } from '../utils/candidateImage';

export interface StationLocation {
  zone: StationZone;
  position: THREE.Vector3;
  name: string;
  stepNumber: number;
}

export interface EnvironmentResult {
  sceneGroup: THREE.Group;
  stationLocations: StationLocation[];
  updateBillboardTexture: (
    results: { id: string; title: string; votes: number; percent: number }[],
    totalVotes: number,
    pollTitle?: string,
    isClosed?: boolean,
    options?: { hideResults?: boolean; scheduledDeadlineText?: string }
  ) => void;
  updateBeaconActive: (currentStep: number) => void;
  updateBannerTitle: (title: string, sub?: string) => void;
  updateElectionPosterWall: (pollTitle: string, candidates: Candidate[]) => void;
  ballotBoxMesh: THREE.Group;
}

// ========================================================
// Rounded Geometry Helpers (Clay / Diorama Soft Silhouettes)
// ========================================================
function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw * 0.9, hh * 0.9);

  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return shape;
}

/**
 * Horizontal rounded slab (rounded corners in X-Z plane, thickness along Y).
 * Ideal for wooden tabletops, ballot box body/lid, rugs, and plinths.
 */
function createRoundedSlabGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius: number,
  bevelSize = 0.02
): THREE.BufferGeometry {
  const b = Math.min(bevelSize, height * 0.35, width * 0.15, depth * 0.15);
  const innerW = Math.max(0.02, width - b * 2);
  const innerD = Math.max(0.02, depth - b * 2);
  const innerH = Math.max(0.005, height - b * 2);
  const shape = createRoundedRectShape(innerW, innerD, Math.max(0.01, cornerRadius - b));

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerH,
    bevelEnabled: b > 0.001,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.center();
  return geo;
}

/**
 * Vertical rounded panel (rounded corners in X-Y plane, thickness along Z).
 * Ideal for billboard casing, pastel room partitions, and rounded signboards.
 */
function createRoundedPanelGeometry(
  width: number,
  height: number,
  depth: number,
  cornerRadius: number,
  bevelSize = 0.02
): THREE.BufferGeometry {
  const b = Math.min(bevelSize, depth * 0.35, width * 0.15, height * 0.15);
  const innerW = Math.max(0.02, width - b * 2);
  const innerH = Math.max(0.02, height - b * 2);
  const innerD = Math.max(0.005, depth - b * 2);
  const shape = createRoundedRectShape(innerW, innerH, Math.max(0.01, cornerRadius - b));

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerD,
    bevelEnabled: b > 0.001,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geo.center();
  return geo;
}

// Deterministic pseudo-random helper so procedural textures look clean and repeatable
function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ========================================================
// Procedural Warm Wood & Matte Fabric Canvas Textures
// ========================================================

// Warm Light Oak Wood Floor Texture (Entrance & Waiting Aisle)
function createWarmOakFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E6CEB0';
  ctx.fillRect(0, 0, 1024, 1024);

  const plankH = 64;
  const plankW = 256;

  for (let row = 0; row < 1024 / plankH; row++) {
    const y = row * plankH;
    const shift = (row % 2) * (plankW / 2);
    for (let col = -1; col <= 1024 / plankW + 1; col++) {
      const x = col * plankW - shift;
      const n = seededNoise(row * 31 + col * 17) - 0.5;

      // Soft warm honey-oak variation
      const r = Math.round(231 + n * 16);
      const g = Math.round(205 + n * 14);
      const b = Math.round(172 + n * 12);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + 1, y + 1, plankW - 2, plankH - 2);

      // Gentle wood grain wisps
      ctx.fillStyle = 'rgba(168, 129, 88, 0.12)';
      for (let gIdx = 0; gIdx < 5; gIdx++) {
        const gx = x + seededNoise(row * 73 + col * 19 + gIdx * 7) * (plankW - 40);
        const gy = y + 6 + gIdx * 11;
        const gw = 40 + seededNoise(row * 29 + gIdx * 11) * 90;
        ctx.fillRect(gx, gy, gw, 1.5);
      }

      // Soft highlight along upper plank bevel
      ctx.fillStyle = 'rgba(255, 248, 236, 0.18)';
      ctx.fillRect(x + 2, y + 2, plankW - 4, 2);
    }
  }

  // Soft warm plank seams
  ctx.strokeStyle = 'rgba(158, 125, 92, 0.34)';
  ctx.lineWidth = 1.6;
  for (let y = 0; y <= 1024; y += plankH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  for (let row = 0; row < 1024 / plankH; row++) {
    const y = row * plankH;
    const shift = (row % 2) * (plankW / 2);
    for (let col = -1; col <= 1024 / plankW + 1; col++) {
      const x = col * plankW - shift;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plankH);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.5, 3.8);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Matte Light-Beige Woven Mat Texture (Central Polling Area)
function createCentralBeigeMatTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#F2EAE0';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle woven linen grain
  for (let y = 0; y < 512; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? 'rgba(216, 200, 180, 0.22)' : 'rgba(255, 251, 246, 0.28)';
    ctx.fillRect(0, y, 512, 3);
  }
  for (let x = 0; x < 512; x += 8) {
    ctx.fillStyle = x % 16 === 0 ? 'rgba(210, 193, 173, 0.16)' : 'rgba(255, 252, 247, 0.2)';
    ctx.fillRect(x, 0, 3, 512);
  }

  // Soft speckling for tactile clay-diorama feel
  for (let i = 0; i < 650; i++) {
    const sx = seededNoise(i * 13.1) * 512;
    const sy = seededNoise(i * 29.7) * 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(195, 176, 154, 0.14)' : 'rgba(255, 255, 255, 0.22)';
    ctx.fillRect(sx, sy, 2.5, 2.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Warm Light-Wood Wainscoting Beadboard Texture
function createWainscotingTexture(repeatX: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#E2C39D';
  ctx.fillRect(0, 0, 512, 256);

  const slatW = 32;
  for (let x = 0; x < 512; x += slatW) {
    const shade = (seededNoise(x * 0.37) - 0.5) * 10;
    ctx.fillStyle = `rgb(${Math.round(226 + shade)}, ${Math.round(195 + shade * 0.9)}, ${Math.round(157 + shade * 0.8)})`;
    ctx.fillRect(x + 1, 0, slatW - 2, 256);

    // Subtle groove shadow + highlight
    ctx.fillStyle = 'rgba(156, 118, 80, 0.32)';
    ctx.fillRect(x, 0, 2, 256);
    ctx.fillStyle = 'rgba(255, 246, 234, 0.22)';
    ctx.fillRect(x + 2, 0, 1.5, 256);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(repeatX, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Warm Diorama Sign Canvas Maker (Pastel header pill + warm cream card)
function createSignTexture(title: string, sub: string, bgColor = '#5DAE74'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFBF5';
  ctx.fillRect(0, 0, 512, 256);

  // Soft warm border
  ctx.strokeStyle = '#E6D6C3';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 502, 246);

  // Rounded pastel header band
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(18, 18, 476, 80, 18);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 34px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 59);

  // Body text in warm cocoa
  ctx.fillStyle = '#3F3128';
  ctx.font = '700 26px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText(sub, 256, 150);

  ctx.fillStyle = '#8C7A6B';
  ctx.font = '600 20px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('보트버스 선거관리위원회', 256, 208);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ========================================================
// Procedural Korean Flag (Taegeukgi) following exact National Flag Act (국기법) proportions
// NOTE: Strictly preserved verbatim without modification.
// ========================================================
function createKoreanFlagTexture(): THREE.CanvasTexture {
  const width = 900;
  const height = 600;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // White background + subtle frame border for crisp contrast on off-white wall
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, width - 4, height - 4);

  const cx = width / 2; // 450
  const cy = height / 2; // 300
  const D = height / 2; // 300 (Taegeuk diameter = 1/2 height)
  const R = D / 2; // 150 (Taegeuk radius)
  const alpha = Math.atan2(2, 3); // Exact diagonal angle (~33.69 deg)

  // 1. Red upper half-circle (clockwise in Canvas 2D from top-left Math.PI+alpha to bottom-right alpha)
  ctx.fillStyle = '#CD2E3A';
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI + alpha, alpha, false);
  ctx.closePath();
  ctx.fill();

  // 2. Blue lower half-circle (clockwise in Canvas 2D from bottom-right alpha to top-left Math.PI+alpha)
  ctx.fillStyle = '#0047A0';
  ctx.beginPath();
  ctx.arc(cx, cy, R, alpha, Math.PI + alpha, false);
  ctx.closePath();
  ctx.fill();

  // 3. Top-left small Red circle (Geon direction bulge)
  ctx.fillStyle = '#CD2E3A';
  ctx.beginPath();
  ctx.arc(
    cx - (R / 2) * Math.cos(alpha),
    cy - (R / 2) * Math.sin(alpha),
    R / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // 4. Bottom-right small Blue circle (Gon direction bulge)
  ctx.fillStyle = '#0047A0';
  ctx.beginPath();
  ctx.arc(
    cx + (R / 2) * Math.cos(alpha),
    cy + (R / 2) * Math.sin(alpha),
    R / 2,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // 5. Four Trigrams (건곤감리) - #000000
  // Distance from center to inner bar edge = 1.5 * R
  // Bar length = R, thickness = R / 6, gap between bars = R / 12, broken bar center gap = R / 12
  const drawTrigram = (theta: number, bars: [number, number, number]) => {
    const startX = 1.5 * R;
    const barLength = R;
    const barThickness = R / 6;
    const barGap = R / 12;
    const barStep = barThickness + barGap; // R / 4
    const centerGap = R / 12;
    const halfLen = (barLength - centerGap) / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(theta);
    ctx.fillStyle = '#000000';

    bars.forEach((isSolid, i) => {
      const x = startX + i * barStep;
      if (isSolid === 1) {
        ctx.fillRect(x, -barLength / 2, barThickness, barLength);
      } else {
        ctx.fillRect(x, -barLength / 2, barThickness, halfLen);
        ctx.fillRect(x, centerGap / 2, barThickness, halfLen);
      }
    });

    ctx.restore();
  };

  // Top-Left: 건 (乾, 3 solid)
  drawTrigram(Math.PI + alpha, [1, 1, 1]);
  // Bottom-Right: 곤 (坤, 3 broken)
  drawTrigram(alpha, [0, 0, 0]);
  // Top-Right: 감 (坎, broken - solid - broken)
  drawTrigram(-alpha, [0, 1, 0]);
  // Bottom-Left: 리 (離, solid - broken - solid)
  drawTrigram(Math.PI - alpha, [1, 0, 1]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ========================================================
// Miniature Clay Potted Plant Helper (Corner Diorama Accent)
// ========================================================
function createClayPottedPlant(): THREE.Group {
  const group = new THREE.Group();

  const potMat = new THREE.MeshStandardMaterial({
    color: 0xd98a6c, // Warm clay terracotta
    roughness: 0.85,
    metalness: 0.0,
  });
  const soilMat = new THREE.MeshStandardMaterial({
    color: 0x6e5443,
    roughness: 0.95,
  });
  const leafMat1 = new THREE.MeshStandardMaterial({
    color: 0x6db37f,
    roughness: 0.82,
    metalness: 0.0,
  });
  const leafMat2 = new THREE.MeshStandardMaterial({
    color: 0x8cc896,
    roughness: 0.82,
    metalness: 0.0,
  });

  const potBody = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.17, 0.36, 18), potMat);
  potBody.position.y = 0.18;
  potBody.castShadow = true;
  potBody.receiveShadow = true;
  group.add(potBody);

  const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.032, 10, 20), potMat);
  potRim.rotation.x = Math.PI / 2;
  potRim.position.y = 0.35;
  potRim.castShadow = true;
  group.add(potRim);

  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 16), soilMat);
  soil.position.y = 0.34;
  group.add(soil);

  // Sculpted rounded clay foliage puffs
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a6548, roughness: 0.85 })
  );
  stem.position.y = 0.54;
  stem.castShadow = true;
  group.add(stem);

  const puffs: [number, number, number, number, boolean][] = [
    [0, 0.86, 0, 0.26, false],
    [-0.17, 0.72, 0.1, 0.18, true],
    [0.18, 0.74, -0.08, 0.19, false],
    [0.05, 0.72, 0.16, 0.17, true],
    [-0.08, 0.98, -0.05, 0.16, true],
  ];
  puffs.forEach(([x, y, z, r, alt]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), alt ? leafMat2 : leafMat1);
    puff.position.set(x, y, z);
    puff.scale.set(1.05, 0.92, 1.05);
    puff.castShadow = true;
    puff.receiveShadow = true;
    group.add(puff);
  });

  return group;
}

// ========================================================
// Cozy Pastel Low Partition Helper (Soft Matte Clay Panels)
// ========================================================
function createPastelPartition(
  width: number,
  height: number,
  colorHex: number,
  woodMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  const panelMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.84,
    metalness: 0.0,
  });

  const panel = new THREE.Mesh(
    createRoundedPanelGeometry(width, height - 0.1, 0.1, 0.12, 0.025),
    panelMat
  );
  panel.position.y = height / 2 + 0.04;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);

  // Warm oak top cap rail
  const topCap = new THREE.Mesh(
    createRoundedSlabGeometry(width + 0.04, 0.06, 0.13, 0.05, 0.015),
    woodMat
  );
  topCap.position.y = height + 0.01;
  topCap.castShadow = true;
  group.add(topCap);

  // Cute stubby wooden feet
  const footGeo = new THREE.CylinderGeometry(0.045, 0.055, 0.12, 12);
  const footOffset = Math.max(0.25, width / 2 - 0.24);
  [-footOffset, footOffset].forEach((fx) => {
    const foot = new THREE.Mesh(footGeo, woodMat);
    foot.position.set(fx, 0.06, 0);
    foot.castShadow = true;
    group.add(foot);
  });

  return group;
}

export function buildPollingStationEnvironment(): EnvironmentResult {
  const sceneGroup = new THREE.Group();

  // ========================================================
  // Shared Warm Matte Clay & Light-Oak Diorama Materials
  // ========================================================
  const creamWallMat = new THREE.MeshStandardMaterial({
    color: 0xf4ece1, // Warm cream ivory
    roughness: 0.88,
    metalness: 0.0,
  });

  const lightOakMat = new THREE.MeshStandardMaterial({
    color: 0xdfbc92, // Warm honey light oak
    roughness: 0.68,
    metalness: 0.0,
  });

  const mediumOakMat = new THREE.MeshStandardMaterial({
    color: 0xcba175, // Slightly deeper oak trim/legs
    roughness: 0.72,
    metalness: 0.0,
  });

  const warmCreamMat = new THREE.MeshStandardMaterial({
    color: 0xfaf4eb, // Matte porcelain cream
    roughness: 0.82,
    metalness: 0.0,
  });

  const softSandFrameMat = new THREE.MeshStandardMaterial({
    color: 0xefe3d2, // Warm sand-cream booth frame
    roughness: 0.74,
    metalness: 0.02,
  });

  const sageGreenMat = new THREE.MeshStandardMaterial({
    color: 0x5dae74, // Friendly soft sage green (Ballot Box & Exit)
    roughness: 0.76,
    metalness: 0.0,
  });

  const pastelMintMat = new THREE.MeshStandardMaterial({
    color: 0xb6dec6,
    roughness: 0.84,
    metalness: 0.0,
  });

  const coralAccentMat = new THREE.MeshStandardMaterial({
    color: 0xe36b6b, // Warm coral-red seals & stamp
    roughness: 0.65,
    metalness: 0.0,
  });

  // ========================================================
  // 1. Dual-Zone Floor (22m x 18m)
  //    - Full warm light-oak wood planks (clearly visible in entrance/waiting aisle)
  //    - Central matte light-beige woven polling mat
  // ========================================================
  const floorGeo = new THREE.PlaneGeometry(22, 18);
  const floorTexture = createWarmOakFloorTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.72,
    metalness: 0.0,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  sceneGroup.add(floorMesh);

  // Central Light-Beige Matte Polling Area Mat (rounded corners, subtle woven texture)
  const matBorderGeo = new THREE.ShapeGeometry(createRoundedRectShape(17.9, 10.6, 0.85), 14);
  const matBorderMat = new THREE.MeshStandardMaterial({
    color: 0xe3d2be,
    roughness: 0.9,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
    polygonOffsetUnits: -0.5,
  });
  const matBorder = new THREE.Mesh(matBorderGeo, matBorderMat);
  matBorder.rotation.x = -Math.PI / 2;
  matBorder.position.set(-0.55, 0.006, -2.9);
  matBorder.receiveShadow = true;
  sceneGroup.add(matBorder);

  const centralMatGeo = new THREE.ShapeGeometry(createRoundedRectShape(17.5, 10.2, 0.72), 14);
  const centralMatTex = createCentralBeigeMatTexture();
  const centralMatMaterial = new THREE.MeshStandardMaterial({
    map: centralMatTex,
    roughness: 0.92,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const centralMatMesh = new THREE.Mesh(centralMatGeo, centralMatMaterial);
  centralMatMesh.rotation.x = -Math.PI / 2;
  centralMatMesh.position.set(-0.55, 0.01, -2.9);
  centralMatMesh.receiveShadow = true;
  sceneGroup.add(centralMatMesh);

  // ========================================================
  // 2. Boundary Walls (Warm Cream Ivory + Light-Wood Wainscoting)
  // ========================================================
  // Back Wall (Z = -9.2)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(22, 5.5, 0.4), creamWallMat);
  backWall.position.set(0, 2.75, -9.2);
  backWall.receiveShadow = true;
  sceneGroup.add(backWall);

  // Left Wall (X = -11.2)
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.5, 18), creamWallMat);
  leftWall.position.set(-11.2, 2.75, 0);
  leftWall.receiveShadow = true;
  sceneGroup.add(leftWall);

  // Light-Wood Wainscoting along Back Wall & Left Wall
  const backWainscotMat = new THREE.MeshStandardMaterial({
    map: createWainscotingTexture(11),
    roughness: 0.74,
    metalness: 0.0,
  });
  const backWainscot = new THREE.Mesh(new THREE.BoxGeometry(21.95, 1.28, 0.06), backWainscotMat);
  backWainscot.position.set(0, 0.64, -8.97);
  backWainscot.receiveShadow = true;
  sceneGroup.add(backWainscot);

  const leftWainscotMat = new THREE.MeshStandardMaterial({
    map: createWainscotingTexture(9),
    roughness: 0.74,
    metalness: 0.0,
  });
  const leftWainscot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.28, 17.95), leftWainscotMat);
  leftWainscot.position.set(-10.97, 0.64, 0);
  leftWainscot.receiveShadow = true;
  sceneGroup.add(leftWainscot);

  // Warm Oak Chair Rails (top molding of wainscoting) & Baseboards
  const backChairRail = new THREE.Mesh(
    createRoundedSlabGeometry(22, 0.08, 0.13, 0.03, 0.015),
    mediumOakMat
  );
  backChairRail.position.set(0, 1.3, -8.94);
  backChairRail.castShadow = true;
  sceneGroup.add(backChairRail);

  const leftChairRail = new THREE.Mesh(
    createRoundedSlabGeometry(0.13, 0.08, 18, 0.03, 0.015),
    mediumOakMat
  );
  leftChairRail.position.set(-10.94, 1.3, 0);
  leftChairRail.castShadow = true;
  sceneGroup.add(leftChairRail);

  const bb1 = new THREE.Mesh(new THREE.BoxGeometry(22, 0.18, 0.1), mediumOakMat);
  bb1.position.set(0, 0.09, -8.94);
  sceneGroup.add(bb1);

  const bb2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 18), mediumOakMat);
  bb2.position.set(-10.94, 0.09, 0);
  sceneGroup.add(bb2);

  // Cozy Pastel Low Partitions (strictly tucked at wall edges/corners, clear of all paths)
  const mintPartition = createPastelPartition(2.1, 1.15, 0xb8dec9, lightOakMat); // Soft Mint
  mintPartition.position.set(-3.2, 0, -8.72);
  sceneGroup.add(mintPartition);

  const lavenderPartition = createPastelPartition(2.1, 1.15, 0xd7cceb, lightOakMat); // Soft Lavender
  lavenderPartition.position.set(2.9, 0, -8.72);
  sceneGroup.add(lavenderPartition);

  const peachPartition = createPastelPartition(2.3, 1.12, 0xf5cbb6, lightOakMat); // Soft Peach
  peachPartition.rotation.y = Math.PI / 2;
  peachPartition.position.set(-10.62, 0, 4.9);
  sceneGroup.add(peachPartition);

  const butterPartition = createPastelPartition(2.1, 1.12, 0xf6e2a4, lightOakMat); // Butter Yellow
  butterPartition.rotation.y = Math.PI / 2;
  butterPartition.position.set(-10.62, 0, 2.2);
  sceneGroup.add(butterPartition);

  const cornerMintPartition = createPastelPartition(1.9, 1.12, 0xc3e4d0, lightOakMat);
  cornerMintPartition.rotation.y = -Math.PI / 5;
  cornerMintPartition.position.set(9.2, 0, -6.4);
  sceneGroup.add(cornerMintPartition);

  // Miniature Clay Potted Plants tucked into non-walkable corners
  const plantBackLeft = createClayPottedPlant();
  plantBackLeft.position.set(-9.9, 0, -7.9);
  sceneGroup.add(plantBackLeft);

  const plantBackRight = createClayPottedPlant();
  plantBackRight.position.set(9.7, 0, -7.8);
  plantBackRight.scale.setScalar(1.08);
  sceneGroup.add(plantBackRight);

  const plantFrontLeft = createClayPottedPlant();
  plantFrontLeft.position.set(-9.8, 0, 7.6);
  plantFrontLeft.scale.setScalar(0.95);
  sceneGroup.add(plantFrontLeft);

  // ========================================================
  // 3. Overhead Grand Banner with Dynamic Title
  // ========================================================
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 1200;
  bannerCanvas.height = 240;
  const bannerCtx = bannerCanvas.getContext('2d')!;
  const bannerTexture = new THREE.CanvasTexture(bannerCanvas);
  bannerTexture.colorSpace = THREE.SRGBColorSpace;

  const updateBannerTitle = (
    titleText: string,
    subText = '서울특별시 가상 제1투표구  |  소중한 한 표, 현명한 선택!'
  ) => {
    // Warm cream diorama banner surface
    bannerCtx.fillStyle = '#FFFBF4';
    bannerCtx.fillRect(0, 0, 1200, 240);

    // Soft pastel sky & sage ribbon stripes
    bannerCtx.fillStyle = '#7EB8F0';
    bannerCtx.fillRect(0, 0, 1200, 16);
    bannerCtx.fillStyle = '#6BC287';
    bannerCtx.fillRect(0, 224, 1200, 16);

    // Official Election Emblem Mark (Warm sage badge)
    bannerCtx.fillStyle = '#5DAE74';
    bannerCtx.beginPath();
    bannerCtx.arc(82, 120, 44, 0, Math.PI * 2);
    bannerCtx.fill();

    bannerCtx.strokeStyle = '#FFFBF4';
    bannerCtx.lineWidth = 4;
    bannerCtx.beginPath();
    bannerCtx.arc(82, 120, 36, 0, Math.PI * 2);
    bannerCtx.stroke();

    bannerCtx.fillStyle = '#FFFFFF';
    bannerCtx.font = 'bold 34px "Pretendard", "Noto Sans KR", sans-serif';
    bannerCtx.textAlign = 'center';
    bannerCtx.textBaseline = 'middle';
    bannerCtx.fillText('선거', 82, 121);

    // Main Banner Title in warm cocoa ink
    bannerCtx.textAlign = 'left';
    bannerCtx.fillStyle = '#362820';
    const fontSize = titleText.length > 22 ? 38 : 48;
    bannerCtx.font = `bold ${fontSize}px "Pretendard", "Noto Sans KR", sans-serif`;
    bannerCtx.fillText(titleText, 152, 95);

    bannerCtx.fillStyle = '#7A685C';
    bannerCtx.font = '600 26px "Pretendard", "Noto Sans KR", sans-serif';
    bannerCtx.fillText(subText, 152, 155);

    // Right side warm coral-red stamp seal
    bannerCtx.strokeStyle = '#DC5A5A';
    bannerCtx.lineWidth = 4;
    bannerCtx.beginPath();
    bannerCtx.roundRect(1020, 50, 132, 132, 16);
    bannerCtx.stroke();

    bannerCtx.fillStyle = '#DC5A5A';
    bannerCtx.font = 'bold 24px "Pretendard", sans-serif';
    bannerCtx.textAlign = 'center';
    bannerCtx.fillText('보트버스', 1086, 100);
    bannerCtx.fillText('선관위인', 1086, 136);

    bannerTexture.needsUpdate = true;
  };

  updateBannerTitle('제1회 오늘 점심 메뉴 모의투표');

  // Slim warm oak backing frame behind banner
  const bannerBackFrame = new THREE.Mesh(
    createRoundedPanelGeometry(10.22, 2.22, 0.08, 0.14, 0.025),
    lightOakMat
  );
  bannerBackFrame.position.set(0, 4.0, -8.95);
  bannerBackFrame.castShadow = true;
  sceneGroup.add(bannerBackFrame);

  const bannerMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 2.0),
    new THREE.MeshStandardMaterial({
      map: bannerTexture,
      roughness: 0.72,
      metalness: 0.0,
    })
  );
  bannerMesh.position.set(0, 4.0, -8.9);
  sceneGroup.add(bannerMesh);

  // Korean Flag on back wall (Exact National Flag Act texture + subtle warm oak backing frame)
  const flagBackFrame = new THREE.Mesh(
    createRoundedPanelGeometry(2.58, 1.78, 0.07, 0.08, 0.02),
    mediumOakMat
  );
  flagBackFrame.position.set(-8.0, 3.8, -8.94);
  flagBackFrame.castShadow = true;
  sceneGroup.add(flagBackFrame);

  const flagGeo = new THREE.PlaneGeometry(2.4, 1.6);
  const flagMat = new THREE.MeshStandardMaterial({
    map: createKoreanFlagTexture(),
    roughness: 0.62,
    metalness: 0.0,
  });
  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.position.set(-8.0, 3.8, -8.9);
  sceneGroup.add(flagMesh);

  // ========================================================
  // 3-B. 3D Election Poster Wall ('후보자 선거 벽보') on Left Wall
  // Mounted cleanly above left wainscoting (y=1.3), facing +X into the hall
  // ========================================================
  const posterWallGroup = new THREE.Group();
  posterWallGroup.position.set(-10.92, 3.25, -1.8);
  posterWallGroup.rotation.y = Math.PI / 2;

  const posterBackFrame = new THREE.Mesh(
    createRoundedPanelGeometry(5.52, 3.38, 0.1, 0.16, 0.03),
    mediumOakMat
  );
  posterBackFrame.position.set(0, 0, -0.02);
  posterBackFrame.castShadow = true;
  posterBackFrame.receiveShadow = true;
  posterWallGroup.add(posterBackFrame);

  const posterInnerTrim = new THREE.Mesh(
    createRoundedPanelGeometry(5.32, 3.18, 0.06, 0.12, 0.02),
    lightOakMat
  );
  posterInnerTrim.position.set(0, 0, 0.02);
  posterWallGroup.add(posterInnerTrim);

  // Decorative wooden header plaque above poster board
  const posterSignTex = createSignTexture('후보자 선거 벽보', '후보별 사진·공약을 확인하세요', '#D97706');
  const posterSignBack = new THREE.Mesh(
    createRoundedPanelGeometry(2.05, 0.42, 0.06, 0.08, 0.015),
    lightOakMat
  );
  posterSignBack.position.set(0, 1.88, 0.02);
  posterSignBack.castShadow = true;
  posterWallGroup.add(posterSignBack);

  const posterSignFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.94, 0.34),
    new THREE.MeshStandardMaterial({ map: posterSignTex, roughness: 0.65 })
  );
  posterSignFace.position.set(0, 1.88, 0.056);
  posterWallGroup.add(posterSignFace);

  const posterCanvas = document.createElement('canvas');
  posterCanvas.width = 1280;
  posterCanvas.height = 760;
  const posterCtx = posterCanvas.getContext('2d')!;
  const posterTexture = new THREE.CanvasTexture(posterCanvas);
  posterTexture.colorSpace = THREE.SRGBColorSpace;

  const posterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.16, 3.04),
    new THREE.MeshStandardMaterial({
      map: posterTexture,
      roughness: 0.72,
      metalness: 0.0,
    })
  );
  posterMesh.position.set(0, 0, 0.058);
  posterWallGroup.add(posterMesh);

  sceneGroup.add(posterWallGroup);

  let posterRenderSeq = 0;

  const updateElectionPosterWall = (pollTitle: string, candidates: Candidate[]) => {
    const seq = ++posterRenderSeq;
    const W = 1280;
    const H = 760;

    const paintPosterBoard = async () => {
      // Warm soft cork/linen poster board background
      posterCtx.fillStyle = '#F7EFE2';
      posterCtx.fillRect(0, 0, W, H);

      // Subtle inner bulletin border
      posterCtx.strokeStyle = '#DFCBB2';
      posterCtx.lineWidth = 6;
      posterCtx.beginPath();
      posterCtx.roundRect(14, 14, W - 28, H - 28, 22);
      posterCtx.stroke();

      // Header Banner Ribbon
      posterCtx.fillStyle = '#362820';
      posterCtx.beginPath();
      posterCtx.roundRect(30, 26, W - 60, 74, 16);
      posterCtx.fill();

      posterCtx.fillStyle = '#F6C667';
      posterCtx.beginPath();
      posterCtx.roundRect(46, 42, 222, 42, 10);
      posterCtx.fill();

      posterCtx.fillStyle = '#2B1F19';
      posterCtx.font = '900 22px "Pretendard", "Noto Sans KR", sans-serif';
      posterCtx.textAlign = 'center';
      posterCtx.textBaseline = 'middle';
      posterCtx.fillText('후보자 선거 벽보', 157, 64);

      posterCtx.fillStyle = '#FFFBF4';
      posterCtx.font = 'bold 28px "Pretendard", "Noto Sans KR", sans-serif';
      posterCtx.textAlign = 'left';
      const trimmedPollTitle =
        pollTitle.length > 26 ? `${pollTitle.slice(0, 26)}…` : pollTitle;
      posterCtx.fillText(trimmedPollTitle, 286, 64);

      posterCtx.fillStyle = '#D9C8B8';
      posterCtx.font = '600 18px "Pretendard", "Noto Sans KR", sans-serif';
      posterCtx.textAlign = 'right';
      posterCtx.fillText('보트버스 선거관리위원회', W - 52, 64);

      const list = candidates.slice(0, 10);
      const count = Math.max(1, list.length);
      const rows = count <= 4 ? 1 : 2;
      const cols = rows === 1 ? Math.max(2, count) : Math.ceil(count / 2);

      const padX = 36;
      const topY = 120;
      const bottomPad = 28;
      const gapX = 18;
      const gapY = 18;
      const availW = W - padX * 2;
      const availH = H - topY - bottomPad;
      const cardW = (availW - gapX * (cols - 1)) / cols;
      const cardH = (availH - gapY * (rows - 1)) / rows;

      const palette = [
        '#F59E0B',
        '#EA580C',
        '#7C3AED',
        '#0284C7',
        '#E11D48',
        '#78350F',
        '#CA8A04',
        '#059669',
        '#6366F1',
        '#0D9488',
      ];

      for (let i = 0; i < list.length; i++) {
        if (seq !== posterRenderSeq) return;
        const cand = list[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padX + col * (cardW + gapX);
        const y = topY + row * (cardH + gapY);
        const accent = cand.accentBg || palette[i % palette.length];
        const hasImg = hasCandidateImage(cand);

        // Paper poster card shadow & body
        posterCtx.fillStyle = 'rgba(72, 52, 38, 0.14)';
        posterCtx.beginPath();
        posterCtx.roundRect(x + 4, y + 5, cardW, cardH, 16);
        posterCtx.fill();

        posterCtx.fillStyle = '#FFFFFF';
        posterCtx.beginPath();
        posterCtx.roundRect(x, y, cardW, cardH, 16);
        posterCtx.fill();

        posterCtx.strokeStyle = '#E5D5C0';
        posterCtx.lineWidth = 2.5;
        posterCtx.stroke();

        // Colored top ribbon bar
        const ribbonH = rows === 1 ? 56 : 42;
        posterCtx.save();
        posterCtx.beginPath();
        posterCtx.roundRect(x, y, cardW, ribbonH, [16, 16, 0, 0]);
        posterCtx.fillStyle = accent;
        posterCtx.fill();
        posterCtx.restore();

        // Symbol badge text + Party name
        posterCtx.fillStyle = '#FFFFFF';
        posterCtx.textAlign = 'left';
        posterCtx.textBaseline = 'middle';
        posterCtx.font = `900 ${rows === 1 ? 24 : 20}px "Pretendard", "Noto Sans KR", sans-serif`;
        posterCtx.fillText(`기호 ${cand.symbolNumber}`, x + 14, y + ribbonH / 2 + 1);

        posterCtx.fillStyle = 'rgba(255,255,255,0.92)';
        posterCtx.textAlign = 'right';
        posterCtx.font = `700 ${rows === 1 ? 18 : 15}px "Pretendard", "Noto Sans KR", sans-serif`;
        const shortParty =
          cand.party.length > 9 ? `${cand.party.slice(0, 9)}…` : cand.party;
        posterCtx.fillText(shortParty, x + cardW - 14, y + ribbonH / 2 + 1);

        // Cute red push-pin at top center of poster
        posterCtx.fillStyle = '#DC5A5A';
        posterCtx.beginPath();
        posterCtx.arc(x + cardW / 2, y + 6, 7, 0, Math.PI * 2);
        posterCtx.fill();
        posterCtx.fillStyle = 'rgba(255,255,255,0.55)';
        posterCtx.beginPath();
        posterCtx.arc(x + cardW / 2 - 2, y + 4, 2.2, 0, Math.PI * 2);
        posterCtx.fill();

        if (hasImg) {
          // Photo poster area
          const imgPad = 12;
          const imgX = x + imgPad;
          const imgY = y + ribbonH + 10;
          const imgW = cardW - imgPad * 2;
          const imgH = cardH - ribbonH - (rows === 1 ? 116 : 82);

          await drawCandidateVisualOnCanvas(posterCtx, cand, imgX, imgY, imgW, imgH, {
            radius: 12,
          });
          if (seq !== posterRenderSeq) return;

          posterCtx.strokeStyle = 'rgba(15, 23, 42, 0.1)';
          posterCtx.lineWidth = 2;
          posterCtx.beginPath();
          posterCtx.roundRect(imgX, imgY, imgW, imgH, 12);
          posterCtx.stroke();

          // Candidate title below photo
          posterCtx.fillStyle = '#1E293B';
          posterCtx.textAlign = 'center';
          posterCtx.textBaseline = 'middle';
          const titleFontSize = rows === 1 ? 26 : 19;
          posterCtx.font = `900 ${titleFontSize}px "Pretendard", "Noto Sans KR", sans-serif`;
          const maxChars = rows === 1 ? 14 : 12;
          const cleanTitle =
            cand.title.length > maxChars ? `${cand.title.slice(0, maxChars)}…` : cand.title;
          posterCtx.fillText(cleanTitle, x + cardW / 2, imgY + imgH + (rows === 1 ? 34 : 24));

          // Subtitle / slogan
          if (cand.subtitle) {
            posterCtx.fillStyle = '#64748B';
            posterCtx.font = `600 ${rows === 1 ? 16 : 13}px "Pretendard", "Noto Sans KR", sans-serif`;
            const maxSub = rows === 1 ? 19 : 16;
            const cleanSub =
              cand.subtitle.length > maxSub ? `${cand.subtitle.slice(0, maxSub)}…` : cand.subtitle;
            posterCtx.fillText(cleanSub, x + cardW / 2, imgY + imgH + (rows === 1 ? 68 : 49));
          }
        } else {
          // Classic Typographic Election Poster Card (for text-only polls)
          const centerX = x + cardW / 2;
          const badgeY = y + ribbonH + (rows === 1 ? 120 : 62);
          const badgeR = rows === 1 ? 58 : 34;

          posterCtx.fillStyle = `${accent}22`;
          posterCtx.beginPath();
          posterCtx.arc(centerX, badgeY, badgeR + 10, 0, Math.PI * 2);
          posterCtx.fill();

          posterCtx.fillStyle = accent;
          posterCtx.beginPath();
          posterCtx.arc(centerX, badgeY, badgeR, 0, Math.PI * 2);
          posterCtx.fill();

          posterCtx.fillStyle = '#FFFFFF';
          posterCtx.textAlign = 'center';
          posterCtx.textBaseline = 'middle';
          posterCtx.font = `900 ${rows === 1 ? 48 : 30}px "Pretendard", sans-serif`;
          posterCtx.fillText(`${cand.symbolNumber}`, centerX, badgeY + 2);

          // Wrapped candidate title
          posterCtx.fillStyle = '#1E293B';
          posterCtx.font = `900 ${rows === 1 ? 28 : 20}px "Pretendard", "Noto Sans KR", sans-serif`;
          const maxLineW = cardW - 32;
          const words = cand.title.split(' ');
          const lines: string[] = [];
          let cur = '';
          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (posterCtx.measureText(test).width > maxLineW && cur) {
              lines.push(cur);
              cur = w;
            } else {
              cur = test;
            }
          }
          if (cur) lines.push(cur);

          const titleStartY = badgeY + badgeR + (rows === 1 ? 52 : 34);
          lines.slice(0, 2).forEach((ln, li) => {
            posterCtx.fillText(ln, centerX, titleStartY + li * (rows === 1 ? 34 : 24));
          });

          if (cand.subtitle) {
            posterCtx.fillStyle = '#64748B';
            posterCtx.font = `600 ${rows === 1 ? 18 : 14}px "Pretendard", "Noto Sans KR", sans-serif`;
            const subTrim =
              cand.subtitle.length > 20 ? `${cand.subtitle.slice(0, 20)}…` : cand.subtitle;
            posterCtx.fillText(
              subTrim,
              centerX,
              titleStartY + Math.min(2, lines.length) * (rows === 1 ? 34 : 24) + 18
            );
          }
        }
      }

      if (seq === posterRenderSeq) {
        posterTexture.needsUpdate = true;
      }
    };

    void paintPosterBoard();
  };

  // ========================================================
  // 4. Floor Directional Guidance Strip (Warm Cream & Sage)
  // ========================================================
  const pathCanvas = document.createElement('canvas');
  pathCanvas.width = 1024;
  pathCanvas.height = 256;
  const pctx = pathCanvas.getContext('2d')!;
  pctx.clearRect(0, 0, 1024, 256);

  // Warm cream pill with soft sage border
  pctx.fillStyle = 'rgba(255, 250, 242, 0.94)';
  pctx.beginPath();
  pctx.roundRect(14, 26, 996, 204, 102);
  pctx.fill();

  pctx.strokeStyle = '#6DB884';
  pctx.lineWidth = 10;
  pctx.stroke();

  pctx.fillStyle = '#3E7A51';
  pctx.font = 'bold 38px "Pretendard", "Noto Sans KR", sans-serif';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  pctx.fillText('투표 진행 방향  ▶  본인확인  ▶  기표소  ▶  투표함  ▶  개표 전광판', 512, 128);

  const pathTexture = new THREE.CanvasTexture(pathCanvas);
  pathTexture.colorSpace = THREE.SRGBColorSpace;
  const pathMat = new THREE.MeshBasicMaterial({
    map: pathTexture,
    transparent: true,
    opacity: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pathMesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.2), pathMat);
  pathMesh.rotation.x = -Math.PI / 2;
  pathMesh.position.set(0, 0.02, 3.8);
  sceneGroup.add(pathMesh);

  // ========================================================
  // ZONE 1: Verification Desk (신분확인·투표용지 교부대)
  // Located at X = -6.5, Z = -4.5 (Exact coordinates preserved)
  // ========================================================
  const deskZoneGroup = new THREE.Group();
  deskZoneGroup.position.set(-6.5, 0, -4.5);

  // Rounded Light-Oak Tabletop
  const tableTop = new THREE.Mesh(
    createRoundedSlabGeometry(4.24, 0.13, 1.44, 0.18, 0.03),
    lightOakMat
  );
  tableTop.position.set(0, 0.84, 0);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  deskZoneGroup.add(tableTop);

  // Warm Cream Modesty Panel + Pastel Mint Ribbon Accent
  const deskPanel = new THREE.Mesh(
    createRoundedPanelGeometry(3.86, 0.72, 0.09, 0.08, 0.02),
    warmCreamMat
  );
  deskPanel.position.set(0, 0.42, 0.54);
  deskPanel.castShadow = true;
  deskPanel.receiveShadow = true;
  deskZoneGroup.add(deskPanel);

  const deskAccentBand = new THREE.Mesh(
    createRoundedPanelGeometry(3.54, 0.18, 0.04, 0.06, 0.01),
    pastelMintMat
  );
  deskAccentBand.position.set(0, 0.54, 0.59);
  deskZoneGroup.add(deskAccentBand);

  // 4 Tapered Round Wooden Legs
  const deskLegGeo = new THREE.CylinderGeometry(0.055, 0.04, 0.8, 14);
  const legPositions = [
    [-1.88, 0.4, -0.52],
    [1.88, 0.4, -0.52],
    [-1.88, 0.4, 0.52],
    [1.88, 0.4, 0.52],
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(deskLegGeo, mediumOakMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    deskZoneGroup.add(leg);
  });

  // Low Clear Rounded Acrylic Guard (keeps clay NPC face at y~1.29 unobstructed!)
  const partitionMat = new THREE.MeshStandardMaterial({
    color: 0xdff2fa,
    transparent: true,
    opacity: 0.28,
    roughness: 0.15,
    metalness: 0.05,
  });
  const partition = new THREE.Mesh(
    createRoundedPanelGeometry(3.3, 0.34, 0.025, 0.08, 0.008),
    partitionMat
  );
  partition.position.set(0, 1.08, 0.22);
  deskZoneGroup.add(partition);

  // Cute wooden acrylic stand feet
  [-1.3, 1.3].forEach((px) => {
    const standFoot = new THREE.Mesh(
      createRoundedSlabGeometry(0.14, 0.05, 0.16, 0.03, 0.01),
      mediumOakMat
    );
    standFoot.position.set(px, 0.92, 0.22);
    deskZoneGroup.add(standFoot);
  });

  // Desk Signage Board (Offset slightly to the right so it never hides NPC's cute face)
  const deskSignTex = createSignTexture('1. 본인 확인 · 투표용지 교부', '신분증 확인 및 서명', '#6EAEE8');
  const deskSignBack = new THREE.Mesh(
    createRoundedPanelGeometry(1.38, 0.44, 0.06, 0.07, 0.015),
    lightOakMat
  );
  deskSignBack.position.set(1.22, 1.12, 0.54);
  deskSignBack.rotation.x = -0.14;
  deskSignBack.castShadow = true;
  deskZoneGroup.add(deskSignBack);

  const deskSignFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.28, 0.36),
    new THREE.MeshStandardMaterial({ map: deskSignTex, roughness: 0.65 })
  );
  deskSignFace.position.set(1.22, 1.12, 0.576);
  deskSignFace.rotation.x = -0.14;
  deskZoneGroup.add(deskSignFace);

  // Rounded Clay Miniature Laptop on Desk
  const laptopBase = new THREE.Mesh(
    createRoundedSlabGeometry(0.42, 0.03, 0.28, 0.04, 0.008),
    softSandFrameMat
  );
  laptopBase.position.set(-0.78, 0.92, -0.05);
  laptopBase.castShadow = true;
  deskZoneGroup.add(laptopBase);

  const laptopScreenBack = new THREE.Mesh(
    createRoundedPanelGeometry(0.42, 0.27, 0.03, 0.04, 0.008),
    softSandFrameMat
  );
  laptopScreenBack.position.set(-0.78, 1.05, -0.18);
  laptopScreenBack.rotation.x = 0.2;
  laptopScreenBack.castShadow = true;
  deskZoneGroup.add(laptopScreenBack);

  const laptopScreenFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.21),
    new THREE.MeshStandardMaterial({ color: 0x86c5f4, roughness: 0.35 })
  );
  laptopScreenFace.position.set(-0.78, 1.05, -0.16);
  laptopScreenFace.rotation.x = 0.2;
  deskZoneGroup.add(laptopScreenFace);

  // Ballot Paper Stack Tray (Warm peach tray + crisp paper stack)
  const paperTray = new THREE.Mesh(
    createRoundedSlabGeometry(0.36, 0.04, 0.46, 0.05, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xf4c4ae, roughness: 0.8 })
  );
  paperTray.position.set(0.55, 0.92, -0.05);
  deskZoneGroup.add(paperTray);

  const paperStack = new THREE.Mesh(
    createRoundedSlabGeometry(0.28, 0.07, 0.38, 0.03, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xfffdf9, roughness: 0.78 })
  );
  paperStack.position.set(0.55, 0.97, -0.05);
  paperStack.castShadow = true;
  deskZoneGroup.add(paperStack);

  // Cute Rounded Coral Stamp Pad
  const stampPad = new THREE.Mesh(
    createRoundedSlabGeometry(0.18, 0.04, 0.14, 0.04, 0.01),
    coralAccentMat
  );
  stampPad.position.set(0.1, 0.92, 0.08);
  deskZoneGroup.add(stampPad);

  sceneGroup.add(deskZoneGroup);

  // ========================================================
  // ZONE 2: Voting Booths (기표소 x 2)
  // Located at X = 0, Z = -5.0 (Exact coordinates preserved)
  // Warm cream frame + pleated beige vertical-cylinder curtains
  // ========================================================
  const boothZoneGroup = new THREE.Group();
  boothZoneGroup.position.set(0, 0, -5.0);

  const curtainMatA = new THREE.MeshStandardMaterial({
    color: 0xe7d7c2, // Warm oatmeal beige
    roughness: 0.94,
    metalness: 0.0,
  });
  const curtainMatB = new THREE.MeshStandardMaterial({
    color: 0xddcab2, // Slightly deeper warm beige fold
    roughness: 0.95,
    metalness: 0.0,
  });

  const createSingleBooth = (offsetX: number) => {
    const singleBooth = new THREE.Group();
    singleBooth.position.x = offsetX;

    // 4 Rounded Warm Cream Frame Posts + Wooden Feet + Rounded Corner Joint Balls
    const poleGeo = new THREE.CylinderGeometry(0.038, 0.038, 2.2, 14);
    const jointGeo = new THREE.SphereGeometry(0.048, 12, 10);
    const footGeo = new THREE.CylinderGeometry(0.055, 0.06, 0.06, 12);

    const corners = [
      [-0.7, 1.1, -0.5],
      [0.7, 1.1, -0.5],
      [-0.7, 1.1, 0.5],
      [0.7, 1.1, 0.5],
    ];
    corners.forEach(([x, y, z]) => {
      const pole = new THREE.Mesh(poleGeo, softSandFrameMat);
      pole.position.set(x, y, z);
      pole.castShadow = true;
      singleBooth.add(pole);

      const topJoint = new THREE.Mesh(jointGeo, lightOakMat);
      topJoint.position.set(x, 2.2, z);
      singleBooth.add(topJoint);

      const foot = new THREE.Mesh(footGeo, mediumOakMat);
      foot.position.set(x, 0.03, z);
      singleBooth.add(foot);
    });

    // Rounded Top Crossbars (Cylindrical tubes for clay softness)
    const backBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 1.4, 12),
      softSandFrameMat
    );
    backBar.rotation.z = Math.PI / 2;
    backBar.position.set(0, 2.2, -0.5);
    singleBooth.add(backBar);

    const frontRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 1.4, 12),
      mediumOakMat
    );
    frontRod.rotation.z = Math.PI / 2;
    frontRod.position.set(0, 2.13, 0.48);
    singleBooth.add(frontRod);

    [-0.7, 0.7].forEach((sx) => {
      const sideBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.032, 0.032, 1.0, 12),
        softSandFrameMat
      );
      sideBar.rotation.x = Math.PI / 2;
      sideBar.position.set(sx, 2.2, 0);
      singleBooth.add(sideBar);
    });

    // Matte Warm Cream Privacy Side & Back Panels
    const sideWallGeo = createRoundedPanelGeometry(0.94, 1.56, 0.045, 0.07, 0.012);
    const leftWallMesh = new THREE.Mesh(sideWallGeo, warmCreamMat);
    leftWallMesh.rotation.y = Math.PI / 2;
    leftWallMesh.position.set(-0.7, 1.24, 0);
    leftWallMesh.castShadow = true;
    leftWallMesh.receiveShadow = true;
    singleBooth.add(leftWallMesh);

    const rightWallMesh = new THREE.Mesh(sideWallGeo, warmCreamMat);
    rightWallMesh.rotation.y = Math.PI / 2;
    rightWallMesh.position.set(0.7, 1.24, 0);
    rightWallMesh.castShadow = true;
    rightWallMesh.receiveShadow = true;
    singleBooth.add(rightWallMesh);

    const backWallMesh = new THREE.Mesh(
      createRoundedPanelGeometry(1.36, 1.56, 0.045, 0.07, 0.012),
      warmCreamMat
    );
    backWallMesh.position.set(0, 1.24, -0.5);
    backWallMesh.castShadow = true;
    backWallMesh.receiveShadow = true;
    singleBooth.add(backWallMesh);

    // Inner Light-Oak Writing Shelf
    const shelf = new THREE.Mesh(
      createRoundedSlabGeometry(1.34, 0.06, 0.46, 0.07, 0.015),
      lightOakMat
    );
    shelf.position.set(0, 0.94, -0.22);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    singleBooth.add(shelf);

    // Cute rounded coral stamp holder on shelf
    const stampHolder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.042, 0.052, 0.12, 14),
      coralAccentMat
    );
    stampHolder.position.set(0.4, 1.02, -0.2);
    singleBooth.add(stampHolder);

    // Warm Wooden-Framed Top Sign: "2. 기표소"
    const boothSignTex = createSignTexture('2. 기표소', '비밀투표 보장 (Secret Ballot)', '#5DAE74');
    const boothSignBack = new THREE.Mesh(
      createRoundedPanelGeometry(1.26, 0.39, 0.055, 0.07, 0.015),
      lightOakMat
    );
    boothSignBack.position.set(0, 2.38, 0.5);
    boothSignBack.castShadow = true;
    singleBooth.add(boothSignBack);

    const boothSignFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18, 0.32),
      new THREE.MeshStandardMaterial({ map: boothSignTex, roughness: 0.65 })
    );
    boothSignFace.position.set(0, 2.38, 0.532);
    singleBooth.add(boothSignFace);

    // Pleated Beige Fabric Curtain (Row of slender vertical cylinders for cozy miniature folds)
    const pleatCount = 11;
    const curtainSpan = 1.22;
    const pleatGeo = new THREE.CylinderGeometry(0.058, 0.064, 1.44, 12);
    const ringGeo = new THREE.TorusGeometry(0.036, 0.01, 8, 12);

    for (let i = 0; i < pleatCount; i++) {
      const t = i / (pleatCount - 1);
      const px = -curtainSpan / 2 + t * curtainSpan;
      // Gentle cloth ripple along Z
      const waveZ = Math.sin(i * 1.45) * 0.022;
      const pleat = new THREE.Mesh(pleatGeo, i % 2 === 0 ? curtainMatA : curtainMatB);
      pleat.position.set(px, 1.38, 0.48 + waveZ);
      pleat.scale.set(1.08, 1.0, 0.72);
      pleat.castShadow = true;
      pleat.receiveShadow = true;
      singleBooth.add(pleat);

      // Cute wooden curtain rings along the top rod
      if (i % 2 === 0) {
        const ring = new THREE.Mesh(ringGeo, lightOakMat);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(px, 2.13, 0.48);
        singleBooth.add(ring);
      }
    }

    return singleBooth;
  };

  const booth1 = createSingleBooth(-1.0);
  const booth2 = createSingleBooth(1.0);
  boothZoneGroup.add(booth1);
  boothZoneGroup.add(booth2);

  sceneGroup.add(boothZoneGroup);

  // ========================================================
  // ZONE 3: Ballot Box (투표함)
  // Located at X = 5.5, Z = -4.5 (Exact coordinates preserved)
  // Friendly Soft Sage Green rounded body + Clean White top slot panel
  // ========================================================
  const boxZoneGroup = new THREE.Group();
  boxZoneGroup.position.set(5.5, 0, -4.5);

  // Rounded Light-Oak Stand Table
  const boxTableTop = new THREE.Mesh(
    createRoundedSlabGeometry(1.86, 0.11, 1.44, 0.16, 0.028),
    lightOakMat
  );
  boxTableTop.position.set(0, 0.72, 0);
  boxTableTop.castShadow = true;
  boxTableTop.receiveShadow = true;
  boxZoneGroup.add(boxTableTop);

  // Soft cream apron under stand table
  const boxTableApron = new THREE.Mesh(
    createRoundedSlabGeometry(1.56, 0.14, 1.14, 0.1, 0.015),
    warmCreamMat
  );
  boxTableApron.position.set(0, 0.61, 0);
  boxZoneGroup.add(boxTableApron);

  const boxLegGeo = new THREE.CylinderGeometry(0.052, 0.038, 0.7, 14);
  const boxTableLegs = [
    [-0.74, 0.35, -0.52],
    [0.74, 0.35, -0.52],
    [-0.74, 0.35, 0.52],
    [0.74, 0.35, 0.52],
  ];
  boxTableLegs.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(boxLegGeo, mediumOakMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    boxZoneGroup.add(leg);
  });

  // Ballot Box Group (Positioned at y = 0.77 so top slot aligns with ballot drop endY = 1.50)
  const ballotBoxMesh = new THREE.Group();
  ballotBoxMesh.position.set(0, 0.77, 0);

  // Friendly Soft Sage Green Rounded Body
  const bodyMesh = new THREE.Mesh(
    createRoundedSlabGeometry(0.88, 0.68, 0.68, 0.1, 0.035),
    sageGreenMat
  );
  bodyMesh.position.y = 0.34;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  ballotBoxMesh.add(bodyMesh);

  // Subtle decorative cream base trim collar
  const baseCollar = new THREE.Mesh(
    createRoundedSlabGeometry(0.91, 0.07, 0.71, 0.1, 0.02),
    warmCreamMat
  );
  baseCollar.position.y = 0.035;
  ballotBoxMesh.add(baseCollar);

  // Clean White/Ivory Rounded Top Slot Panel
  const topPanelMat = new THREE.MeshStandardMaterial({
    color: 0xfbf8f3,
    roughness: 0.72,
    metalness: 0.0,
  });
  const lid = new THREE.Mesh(
    createRoundedSlabGeometry(0.92, 0.1, 0.72, 0.1, 0.028),
    topPanelMat
  );
  lid.position.y = 0.71;
  lid.castShadow = true;
  lid.receiveShadow = true;
  ballotBoxMesh.add(lid);

  // Recessed Slot Surround + Dark Slot Opening (Top surface at local y ≈ 0.76 -> world y ≈ 1.53)
  const slotBezel = new THREE.Mesh(
    createRoundedSlabGeometry(0.46, 0.024, 0.11, 0.035, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xdfe9e1, roughness: 0.75 })
  );
  slotBezel.position.set(0, 0.76, 0);
  ballotBoxMesh.add(slotBezel);

  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.018, 0.042),
    new THREE.MeshBasicMaterial({ color: 0x1e3326 })
  );
  slot.position.set(0, 0.768, 0);
  ballotBoxMesh.add(slot);

  // Cute Rounded Coral-Red Security Seals ("특수 봉인 스티커")
  const sealGeo = createRoundedPanelGeometry(0.13, 0.09, 0.025, 0.025, 0.008);
  const sealLeft = new THREE.Mesh(sealGeo, coralAccentMat);
  sealLeft.position.set(-0.26, 0.67, 0.345);
  ballotBoxMesh.add(sealLeft);

  const sealRight = new THREE.Mesh(sealGeo, coralAccentMat);
  sealRight.position.set(0.26, 0.67, 0.345);
  ballotBoxMesh.add(sealRight);

  // Front Rounded Cream Nameplate ("투 표 함 / BALLOT BOX")
  const ballotCanvas = document.createElement('canvas');
  ballotCanvas.width = 512;
  ballotCanvas.height = 256;
  const bctx = ballotCanvas.getContext('2d')!;
  bctx.fillStyle = '#FFFDF9';
  bctx.beginPath();
  bctx.roundRect(8, 8, 496, 240, 32);
  bctx.fill();
  bctx.strokeStyle = '#9CD1AA';
  bctx.lineWidth = 10;
  bctx.stroke();

  bctx.fillStyle = '#3B7D50';
  bctx.font = 'bold 72px "Pretendard", "Noto Sans KR", sans-serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillText('투  표  함', 256, 102);

  bctx.fillStyle = '#7E6E62';
  bctx.font = '700 30px "Pretendard", sans-serif';
  bctx.fillText('BALLOT BOX', 256, 178);

  const ballotTex = new THREE.CanvasTexture(ballotCanvas);
  ballotTex.colorSpace = THREE.SRGBColorSpace;
  const ballotDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.29),
    new THREE.MeshBasicMaterial({
      map: ballotTex,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  ballotDecal.position.set(0, 0.34, 0.344);
  ballotBoxMesh.add(ballotDecal);

  boxZoneGroup.add(ballotBoxMesh);

  // Warm Oak-Framed Top Sign for Ballot Box (Mounted cleanly above box)
  const boxSignTex = createSignTexture('3. 투표함', '접은 투표용지를 투입구에 넣어주세요', '#5DAE74');
  const boxSignBack = new THREE.Mesh(
    createRoundedPanelGeometry(1.46, 0.44, 0.06, 0.07, 0.015),
    lightOakMat
  );
  boxSignBack.position.set(0, 1.9, -0.32);
  boxSignBack.castShadow = true;
  boxZoneGroup.add(boxSignBack);

  const boxSignFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.38, 0.36),
    new THREE.MeshStandardMaterial({ map: boxSignTex, roughness: 0.65 })
  );
  boxSignFace.position.set(0, 1.9, -0.285);
  boxZoneGroup.add(boxSignFace);

  // Slim wooden rear sign posts down to table
  [-0.5, 0.5].forEach((sx) => {
    const signPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.15, 10),
      mediumOakMat
    );
    signPost.position.set(sx, 1.28, -0.34);
    boxZoneGroup.add(signPost);
  });

  sceneGroup.add(boxZoneGroup);

  // ========================================================
  // ZONE 4: Results Billboard (개표 전광판) & Exit Door
  // Located at X = 7.0, Z = 1.5 (Exact coordinates & angle preserved)
  // Rounded Deep Navy frame + Vivid Pastel Bar Graphs
  // ========================================================
  const billboardGroup = new THREE.Group();
  billboardGroup.position.set(7.0, 0, 1.5);
  billboardGroup.rotation.y = -Math.PI / 4; // Angled toward center aisle

  // Warm Oak Support Pillars + Rounded Foot Caps
  const pillarGeo = new THREE.CylinderGeometry(0.065, 0.075, 3.2, 16);
  const footBaseGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.1, 16);
  [-1.55, 1.55].forEach((px) => {
    const pillar = new THREE.Mesh(pillarGeo, mediumOakMat);
    pillar.position.set(px, 1.6, 0);
    pillar.castShadow = true;
    billboardGroup.add(pillar);

    const footBase = new THREE.Mesh(footBaseGeo, lightOakMat);
    footBase.position.set(px, 0.05, 0);
    footBase.castShadow = true;
    billboardGroup.add(footBase);
  });

  // Outer Warm Honey-Oak Backing Trim
  const billboardOakTrim = new THREE.Mesh(
    createRoundedPanelGeometry(3.8, 2.4, 0.16, 0.22, 0.035),
    lightOakMat
  );
  billboardOakTrim.position.set(0, 2.3, -0.04);
  billboardOakTrim.castShadow = true;
  billboardGroup.add(billboardOakTrim);

  // Rounded Deep Navy Display Casing
  const deepNavyFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1f2a44, // Deep cozy navy
    roughness: 0.52,
    metalness: 0.08,
  });
  const frame = new THREE.Mesh(
    createRoundedPanelGeometry(3.66, 2.26, 0.2, 0.18, 0.04),
    deepNavyFrameMat
  );
  frame.position.set(0, 2.3, 0.01);
  frame.castShadow = true;
  billboardGroup.add(frame);

  // Screen Canvas (Dynamic CanvasTexture)
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024;
  boardCanvas.height = 640;
  const bCtx = boardCanvas.getContext('2d')!;

  const boardTexture = new THREE.CanvasTexture(boardCanvas);
  boardTexture.colorSpace = THREE.SRGBColorSpace;
  const boardScreenMat = new THREE.MeshBasicMaterial({ map: boardTexture });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.38, 1.98), boardScreenMat);
  screenMesh.position.set(0, 2.3, 0.116);
  billboardGroup.add(screenMesh);

  // Billboard Top Header (Warm Apricot/Amber Rounded Plaque)
  const bbHeaderTex = createSignTexture('4. 개표 현황판', '실시간 투표 결과 집계', '#E68A5C');
  const bbHeaderBack = new THREE.Mesh(
    createRoundedPanelGeometry(1.68, 0.4, 0.06, 0.07, 0.015),
    lightOakMat
  );
  bbHeaderBack.position.set(0, 3.64, 0);
  bbHeaderBack.castShadow = true;
  billboardGroup.add(bbHeaderBack);

  const bbHeaderFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.58, 0.33),
    new THREE.MeshStandardMaterial({ map: bbHeaderTex, roughness: 0.65 })
  );
  bbHeaderFace.position.set(0, 3.64, 0.036);
  billboardGroup.add(bbHeaderFace);

  sceneGroup.add(billboardGroup);

  // ========================================================
  // Exit Doorway on Right Side (Exact coordinates preserved: 8.5, 0, 5.5)
  // Warm Oak Frame + Soft Frosted Glass + Friendly Sage Exit Sign
  // ========================================================
  const exitDoorGroup = new THREE.Group();
  exitDoorGroup.position.set(8.5, 0, 5.5);

  const exitFrame = new THREE.Mesh(
    createRoundedPanelGeometry(2.44, 3.2, 0.22, 0.12, 0.03),
    lightOakMat
  );
  exitFrame.position.set(0, 1.6, 0);
  exitFrame.castShadow = true;
  exitDoorGroup.add(exitFrame);

  // Soft Warm Frosted Glass Door
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xdff1e9,
    transparent: true,
    opacity: 0.48,
    roughness: 0.25,
    metalness: 0.05,
  });
  const glassDoor = new THREE.Mesh(new THREE.BoxGeometry(2.08, 2.86, 0.05), glassMat);
  glassDoor.position.set(0, 1.52, 0.02);
  exitDoorGroup.add(glassDoor);

  // Center wooden door mullion + cute rounded wooden handles
  const doorMullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.86, 0.09), mediumOakMat);
  doorMullion.position.set(0, 1.52, 0.02);
  exitDoorGroup.add(doorMullion);

  [-0.16, 0.16].forEach((hx) => {
    const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.24, 6, 10), mediumOakMat);
    handle.position.set(hx, 1.3, 0.09);
    exitDoorGroup.add(handle);
  });

  // Friendly Soft Sage Exit Sign
  const exitSignCanvas = document.createElement('canvas');
  exitSignCanvas.width = 512;
  exitSignCanvas.height = 160;
  const ectx = exitSignCanvas.getContext('2d')!;
  ectx.fillStyle = '#5DAE74';
  ectx.beginPath();
  ectx.roundRect(6, 6, 500, 148, 28);
  ectx.fill();
  ectx.strokeStyle = '#FFFBF4';
  ectx.lineWidth = 8;
  ectx.stroke();

  ectx.fillStyle = '#FFFFFF';
  ectx.font = 'bold 54px "Pretendard", sans-serif';
  ectx.textAlign = 'center';
  ectx.textBaseline = 'middle';
  ectx.fillText('출  구  EXIT  ▶', 256, 82);

  const exitSignTex = new THREE.CanvasTexture(exitSignCanvas);
  exitSignTex.colorSpace = THREE.SRGBColorSpace;

  const exitSignBack = new THREE.Mesh(
    createRoundedPanelGeometry(1.48, 0.46, 0.07, 0.08, 0.015),
    lightOakMat
  );
  exitSignBack.position.set(0, 3.44, 0.08);
  exitDoorGroup.add(exitSignBack);

  const exitSignMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.39),
    new THREE.MeshBasicMaterial({ map: exitSignTex, transparent: true })
  );
  exitSignMesh.position.set(0, 3.44, 0.12);
  exitDoorGroup.add(exitSignMesh);

  sceneGroup.add(exitDoorGroup);

  // ========================================================
  // Dynamic Billboard Canvas Painter (Deep Navy + Vivid Pastel Bars)
  // ========================================================
  const updateBillboardTexture = (
    results: { id: string; title: string; votes: number; percent: number }[],
    totalVotes: number,
    pollTitle?: string,
    isClosed = false,
    options?: { hideResults?: boolean; scheduledDeadlineText?: string }
  ) => {
    const isSealed = Boolean(options?.hideResults && !isClosed);

    // Deep warm navy display backdrop
    bCtx.fillStyle = '#1B253E';
    bCtx.fillRect(0, 0, 1024, 640);

    // Soft rounded inner frame glow
    bCtx.strokeStyle = isSealed ? 'rgba(246, 198, 103, 0.34)' : 'rgba(182, 206, 240, 0.18)';
    bCtx.lineWidth = 4;
    bCtx.beginPath();
    bCtx.roundRect(18, 18, 988, 604, 24);
    bCtx.stroke();

    // Subtle soft dot-grid feel
    bCtx.strokeStyle = 'rgba(165, 198, 245, 0.06)';
    bCtx.lineWidth = 1;
    for (let y = 96; y < 608; y += 44) {
      bCtx.beginPath();
      bCtx.moveTo(44, y);
      bCtx.lineTo(980, y);
      bCtx.stroke();
    }

    // Header Title (Warm cream + pastel amber live badge)
    bCtx.fillStyle = isClosed ? '#7AD3A4' : '#F6C667';
    bCtx.beginPath();
    bCtx.arc(58, 56, 10, 0, Math.PI * 2);
    bCtx.fill();

    bCtx.fillStyle = '#FFF7EB';
    bCtx.font = 'bold 30px "Pretendard", "Noto Sans KR", sans-serif';
    bCtx.textAlign = 'left';
    bCtx.textBaseline = 'middle';
    const headerTitle = pollTitle ? pollTitle : '실시간 개표 현황 (LIVE TALLY)';
    bCtx.fillText(headerTitle.length > 24 ? headerTitle.slice(0, 24) + '...' : headerTitle, 80, 56);

    bCtx.fillStyle = isClosed ? '#7AD3A4' : isSealed ? '#F6C667' : '#C7D6EE';
    bCtx.font = '600 22px "Pretendard", "Noto Sans KR", sans-serif';
    bCtx.textAlign = 'right';
    const statusLabel = isClosed
      ? '개표 완료 (100%)'
      : isSealed
      ? '🔒 비밀 개표 진행 중'
      : '실시간 집계 중';
    bCtx.fillText(
      isSealed ? `총 참여: ${totalVotes}명  |  ${statusLabel}` : `총 투표: ${totalVotes}표  |  ${statusLabel}`,
      972,
      56
    );

    // Warm navy divider
    bCtx.strokeStyle = 'rgba(205, 222, 248, 0.18)';
    bCtx.lineWidth = 2;
    bCtx.beginPath();
    bCtx.moveTo(44, 88);
    bCtx.lineTo(980, 88);
    bCtx.stroke();

    // Sealed Mode (after_close before deadline): Never render candidate bars, counts, or percentages
    if (isSealed) {
      bCtx.fillStyle = 'rgba(34, 47, 79, 0.92)';
      bCtx.beginPath();
      bCtx.roundRect(72, 124, 880, 452, 26);
      bCtx.fill();

      bCtx.strokeStyle = 'rgba(246, 198, 103, 0.45)';
      bCtx.lineWidth = 3;
      bCtx.stroke();

      // Padlock badge circle
      bCtx.fillStyle = 'rgba(246, 198, 103, 0.16)';
      bCtx.beginPath();
      bCtx.arc(512, 206, 48, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.strokeStyle = '#F6C667';
      bCtx.lineWidth = 3;
      bCtx.stroke();

      // Padlock shackle & body
      bCtx.strokeStyle = '#F6C667';
      bCtx.lineWidth = 6;
      bCtx.beginPath();
      bCtx.arc(512, 196, 15, Math.PI, 0, false);
      bCtx.stroke();
      bCtx.fillStyle = '#F6C667';
      bCtx.beginPath();
      bCtx.roundRect(490, 198, 44, 34, 7);
      bCtx.fill();
      bCtx.fillStyle = '#1B253E';
      bCtx.beginPath();
      bCtx.arc(512, 214, 5, 0, Math.PI * 2);
      bCtx.fill();

      // Main sealed headline
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillStyle = '#FFF7EB';
      bCtx.font = 'bold 42px "Pretendard", "Noto Sans KR", sans-serif';
      bCtx.fillText('🔒 마감 후 개표 결과 공개', 512, 294);

      bCtx.fillStyle = '#C7D6EE';
      bCtx.font = '600 22px "Pretendard", "Noto Sans KR", sans-serif';
      bCtx.fillText('투표 마감 전까지 후보별 득표수와 순위는 비밀로 봉인됩니다', 512, 344);

      // Two clean info pills: Current total participants + Scheduled deadline
      bCtx.fillStyle = 'rgba(20, 30, 52, 0.92)';
      bCtx.beginPath();
      bCtx.roundRect(114, 392, 360, 114, 18);
      bCtx.fill();
      bCtx.strokeStyle = 'rgba(122, 211, 164, 0.35)';
      bCtx.lineWidth = 2;
      bCtx.stroke();

      bCtx.fillStyle = '#9FB3D4';
      bCtx.font = '600 19px "Pretendard", "Noto Sans KR", sans-serif';
      bCtx.fillText('현재 총 참여 인원', 294, 426);
      bCtx.fillStyle = '#7AD3A4';
      bCtx.font = 'bold 34px "Pretendard", "Noto Sans KR", sans-serif';
      bCtx.fillText(`${totalVotes}명 참여 중`, 294, 470);

      bCtx.fillStyle = 'rgba(20, 30, 52, 0.92)';
      bCtx.beginPath();
      bCtx.roundRect(510, 392, 400, 114, 18);
      bCtx.fill();
      bCtx.strokeStyle = 'rgba(246, 198, 103, 0.35)';
      bCtx.lineWidth = 2;
      bCtx.stroke();

      bCtx.fillStyle = '#9FB3D4';
      bCtx.font = '600 19px "Pretendard", "Noto Sans KR", sans-serif';
      bCtx.fillText('개표 공개 예정 시각', 710, 426);
      bCtx.fillStyle = '#F6C667';
      bCtx.font = 'bold 24px "Pretendard", "Noto Sans KR", sans-serif';
      const deadlineLabel = options?.scheduledDeadlineText || '방장 개표 확정 시 공개';
      bCtx.fillText(
        deadlineLabel.length > 22 ? deadlineLabel.slice(0, 22) + '...' : deadlineLabel,
        710,
        470
      );

      // Commission footer note
      bCtx.fillStyle = '#8FA6CC';
      bCtx.font = '600 18px "Pretendard", "Noto Sans KR", sans-serif';
      bCtx.fillText('보트버스 선거관리위원회 · 4번 전광판에서 방명록은 상시 이용 가능합니다', 512, 544);

      boardTexture.needsUpdate = true;
      return;
    }

    // Vivid Pastel Bar Graph Palette (pops clearly on deep navy)
    const pastelBars = ['#F48B94', '#7EB8F0', '#7AD3A4', '#F5CA73', '#BCA2F2'];
    const count = Math.max(1, results.length);
    const rowHeight = Math.min(130, 505 / count);

    results.forEach((item, idx) => {
      const topY = 104 + idx * rowHeight;
      const barY = topY + Math.min(40, rowHeight * 0.45);
      const barH = Math.max(20, Math.min(30, rowHeight * 0.34));
      const color = pastelBars[idx % pastelBars.length];

      // Rounded Pastel Candidate Number Badge
      bCtx.fillStyle = color;
      bCtx.beginPath();
      bCtx.arc(76, topY + 20, 21, 0, Math.PI * 2);
      bCtx.fill();

      bCtx.fillStyle = '#1B253E';
      bCtx.font = 'bold 22px "Pretendard", sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText(`${idx + 1}`, 76, topY + 21);

      // Candidate Title
      bCtx.textAlign = 'left';
      bCtx.fillStyle = '#FFF9F0';
      bCtx.font = 'bold 26px "Pretendard", "Noto Sans KR", sans-serif';
      const displayTitle = item.title.length > 21 ? item.title.slice(0, 21) + '...' : item.title;
      bCtx.fillText(displayTitle, 114, topY + 21);

      // Percentage & votes
      bCtx.textAlign = 'right';
      bCtx.fillStyle = color;
      bCtx.font = 'bold 28px "Pretendard", monospace';
      bCtx.fillText(`${item.percent}%`, 844, topY + 21);

      bCtx.fillStyle = '#B8C7E0';
      bCtx.font = '600 20px "Pretendard", sans-serif';
      bCtx.fillText(`(${item.votes}표)`, 972, topY + 21);

      // Rounded Pill Bar Track
      bCtx.fillStyle = '#2A3859';
      bCtx.beginPath();
      bCtx.roundRect(114, barY, 858, barH, barH / 2);
      bCtx.fill();

      // Filled Vivid Pastel Pill Bar
      const fillW = Math.max(barH, (858 * item.percent) / 100);
      bCtx.fillStyle = color;
      bCtx.beginPath();
      bCtx.roundRect(114, barY, fillW, barH, barH / 2);
      bCtx.fill();

      // Subtle top gloss highlight on pastel bar
      bCtx.fillStyle = 'rgba(255, 255, 255, 0.24)';
      bCtx.beginPath();
      bCtx.roundRect(120, barY + 3, Math.max(8, fillW - 12), Math.max(4, barH * 0.28), 6);
      bCtx.fill();
    });

    boardTexture.needsUpdate = true;
  };

  // Initial billboard draw with placeholder
  updateBillboardTexture(
    [
      { id: 'c1', title: '따끈한 김치찌개 정식', votes: 12, percent: 43 },
      { id: 'c2', title: '바삭 수제 등심 돈가스', votes: 10, percent: 36 },
      { id: 'c3', title: '아보카도 연어 포케볼', votes: 6, percent: 21 },
    ],
    28,
    '제1회 오늘 점심 메뉴 모의투표'
  );

  // ========================================================
  // Animated Interactive Floor Beacons (Exact coordinates preserved)
  // ========================================================
  const beaconRings: { mesh: THREE.Mesh; step: number }[] = [];

  const createBeacon = (x: number, z: number, step: number) => {
    const ringGeo = new THREE.RingGeometry(0.8, 1.05, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x6eaee8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.03, z);
    sceneGroup.add(ring);
    beaconRings.push({ mesh: ring, step });
  };

  createBeacon(-6.5, -3.2, 1); // Desk beacon
  createBeacon(0.0, -3.6, 2);  // Booth beacon
  createBeacon(5.5, -3.3, 3);  // Box beacon
  createBeacon(6.2, 1.8, 4);   // Billboard beacon

  // Dedicated soft sage floor interaction circle in front of '출구 EXIT ▶'
  const exitRingGeo = new THREE.RingGeometry(0.85, 1.12, 36);
  const exitRingMat = new THREE.MeshBasicMaterial({
    color: 0x5dae74,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const exitRing = new THREE.Mesh(exitRingGeo, exitRingMat);
  exitRing.rotation.x = -Math.PI / 2;
  exitRing.position.set(8.5, 0.032, 4.3);
  sceneGroup.add(exitRing);

  const exitDiscGeo = new THREE.CircleGeometry(0.85, 36);
  const exitDiscMat = new THREE.MeshBasicMaterial({
    color: 0x6dc485,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const exitDisc = new THREE.Mesh(exitDiscGeo, exitDiscMat);
  exitDisc.rotation.x = -Math.PI / 2;
  exitDisc.position.set(8.5, 0.03, 4.3);
  sceneGroup.add(exitDisc);

  const updateBeaconActive = (currentStep: number) => {
    beaconRings.forEach(({ mesh, step }) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (step === currentStep) {
        mat.color.setHex(0xf2a93b); // Warm glowing honey amber
        mat.opacity = 0.85;
      } else if (step < currentStep) {
        mat.color.setHex(0x5dae74); // Completed soft sage green
        mat.opacity = 0.4;
      } else {
        mat.color.setHex(0xb8a898); // Pending warm taupe
        mat.opacity = 0.28;
      }
    });
  };

  // Exact Station Locations (100% preserved)
  const stationLocations: StationLocation[] = [
    { zone: 'desk', position: new THREE.Vector3(-6.5, 0, -3.2), name: '본인확인 및 교부대', stepNumber: 1 },
    { zone: 'booth', position: new THREE.Vector3(0.0, 0, -3.6), name: '기표소', stepNumber: 2 },
    { zone: 'box', position: new THREE.Vector3(5.5, 0, -3.3), name: '투표함', stepNumber: 3 },
    { zone: 'billboard', position: new THREE.Vector3(6.2, 0, 1.8), name: '개표 전광판', stepNumber: 4 },
    { zone: 'exit', position: new THREE.Vector3(8.5, 0, 4.3), name: '출구 (EXIT)', stepNumber: 5 },
  ];

  return {
    sceneGroup,
    stationLocations,
    updateBillboardTexture,
    updateBeaconActive,
    updateBannerTitle,
    updateElectionPosterWall,
    ballotBoxMesh,
  };
}
