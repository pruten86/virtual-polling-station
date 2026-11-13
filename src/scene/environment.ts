import * as THREE from 'three';
import { StationZone } from '../types';

export interface StationLocation {
  zone: StationZone;
  position: THREE.Vector3;
  name: string;
  stepNumber: number;
}

export interface EnvironmentResult {
  sceneGroup: THREE.Group;
  stationLocations: StationLocation[];
  updateBillboardTexture: (results: { id: string; title: string; votes: number; percent: number }[], totalVotes: number, pollTitle?: string) => void;
  updateBeaconActive: (currentStep: number) => void;
  updateBannerTitle: (title: string, sub?: string) => void;
  ballotBoxMesh: THREE.Group;
}

// Procedural Canvas Texture for High-Resolution Wooden Floor
function createWoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Base warm maple tone
  ctx.fillStyle = '#eedec5';
  ctx.fillRect(0, 0, 1024, 1024);

  // Parquet plank grid
  const plankH = 64;
  const plankW = 256;

  for (let y = 0; y < 1024; y += plankH) {
    const shift = (Math.floor(y / plankH) % 2) * (plankW / 2);
    for (let x = -shift; x < 1024 + shift; x += plankW) {
      // Slight plank shade variation
      const shade = (Math.random() - 0.5) * 16;
      ctx.fillStyle = `rgb(${238 + shade}, ${222 + shade * 0.9}, ${197 + shade * 0.8})`;
      ctx.fillRect(x + 1, y + 1, plankW - 2, plankH - 2);

      // Subtle wood grain lines
      ctx.fillStyle = 'rgba(180, 150, 120, 0.15)';
      for (let g = 0; g < 4; g++) {
        ctx.fillRect(x + Math.random() * plankW, y + 4 + g * 14, Math.random() * 80 + 30, 1.5);
      }
    }
  }

  // Plank grout seams
  ctx.strokeStyle = 'rgba(140, 115, 90, 0.45)';
  ctx.lineWidth = 1.5;
  for (let y = 0; y <= 1024; y += plankH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  for (let y = 0; y < 1024; y += plankH) {
    const shift = (Math.floor(y / plankH) % 2) * (plankW / 2);
    for (let x = -shift; x <= 1024 + shift; x += plankW) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + plankH);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Canvas Texture for Main Banner
function createBannerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 240;
  const ctx = canvas.getContext('2d')!;

  // Clean White Background with soft border
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1200, 240);

  // Top and bottom official color stripes (Blue & Green)
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(0, 0, 1200, 16);
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(0, 224, 1200, 16);

  // Official Election Emblem Mark
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(80, 120, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('선거', 80, 120);

  // Main Banner Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 52px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('제1회 즐거운 점심 메뉴 모의투표소', 150, 95);

  ctx.fillStyle = '#475569';
  ctx.font = '500 28px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('서울특별시 가상 제1투표구  |  소중한 한 표, 맛있는 선택!', 150, 155);

  // Right side stamp mark
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 4;
  ctx.strokeRect(1020, 50, 130, 130);
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('모의선거', 1085, 100);
  ctx.fillText('관리위원회', 1085, 135);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Sign Canvas Maker
function createSignTexture(title: string, sub: string, bgColor = '#0284c7'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 256);

  // Header band
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 512, 80);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 42);

  // Body text
  ctx.fillStyle = '#1e293b';
  ctx.font = '600 28px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText(sub, 256, 140);

  ctx.fillStyle = '#64748b';
  ctx.font = '400 20px "Pretendard", "Noto Sans KR", sans-serif';
  ctx.fillText('가상선거관리위원회', 256, 205);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Procedural Korean Flag (Taegeukgi)
function createKoreanFlagTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 400);

  // Taegeuk Circle in Center
  const cx = 300;
  const cy = 200;
  const r = 80;

  // Red upper hemisphere
  ctx.fillStyle = '#cd2e3a';
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.arc(cx, cy - r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.arc(cx, cy + r / 2, r / 2, Math.PI / 2, -Math.PI / 2, false);
  ctx.fill();

  // Blue lower hemisphere
  ctx.fillStyle = '#0047a0';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2);
  ctx.arc(cx, cy - r / 2, r / 2, -Math.PI / 2, Math.PI / 2, false);
  ctx.arc(cx, cy + r / 2, r / 2, -Math.PI / 2, Math.PI / 2, true);
  ctx.fill();

  // 4 Trigrams (Geon, Gon, Gam, Ri) represented cleanly
  ctx.fillStyle = '#111827';
  const drawBar = (x: number, y: number, angle: number, isBroken: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (!isBroken) {
      ctx.fillRect(-28, -4, 56, 8);
    } else {
      ctx.fillRect(-28, -4, 25, 8);
      ctx.fillRect(3, -4, 25, 8);
    }
    ctx.restore();
  };

  // Top Left (Geon: 3 solid)
  const angleTL = -Math.PI / 4;
  drawBar(170, 90, angleTL, false);
  drawBar(180, 100, angleTL, false);
  drawBar(190, 110, angleTL, false);

  // Bottom Right (Gon: 3 broken)
  const angleBR = -Math.PI / 4;
  drawBar(410, 290, angleBR, true);
  drawBar(420, 300, angleBR, true);
  drawBar(430, 310, angleBR, true);

  // Top Right (Gam: broken, solid, broken)
  const angleTR = Math.PI / 4;
  drawBar(430, 90, angleTR, true);
  drawBar(420, 100, angleTR, false);
  drawBar(410, 110, angleTR, true);

  // Bottom Left (Ri: solid, broken, solid)
  const angleBL = Math.PI / 4;
  drawBar(190, 290, angleBL, false);
  drawBar(180, 300, angleBL, true);
  drawBar(170, 310, angleBL, false);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildPollingStationEnvironment(): EnvironmentResult {
  const sceneGroup = new THREE.Group();

  // Reusable Materials
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.9,
    metalness: 0.02,
  });

  const baseboardMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.7,
  });

  const aluminumMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.35,
    metalness: 0.85,
  });

  const deskTopMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.5,
  });

  // 1. Floor (22m x 18m)
  const floorGeo = new THREE.PlaneGeometry(22, 18);
  const floorTexture = createWoodFloorTexture();
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.45,
    metalness: 0.05,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  sceneGroup.add(floorMesh);

  // 2. Boundary Walls (Back wall and Left wall)
  // Back Wall (Z = -9)
  const backWallGeo = new THREE.BoxGeometry(22, 5.5, 0.4);
  const backWall = new THREE.Mesh(backWallGeo, wallMat);
  backWall.position.set(0, 2.75, -9.2);
  backWall.receiveShadow = true;
  sceneGroup.add(backWall);

  // Left Wall (X = -11)
  const leftWallGeo = new THREE.BoxGeometry(0.4, 5.5, 18);
  const leftWall = new THREE.Mesh(leftWallGeo, wallMat);
  leftWall.position.set(-11.2, 2.75, 0);
  leftWall.receiveShadow = true;
  sceneGroup.add(leftWall);

  // Baseboards
  const bb1Geo = new THREE.BoxGeometry(22, 0.25, 0.1);
  const bb1 = new THREE.Mesh(bb1Geo, baseboardMat);
  bb1.position.set(0, 0.125, -8.95);
  sceneGroup.add(bb1);

  const bb2Geo = new THREE.BoxGeometry(0.1, 0.25, 18);
  const bb2 = new THREE.Mesh(bb2Geo, baseboardMat);
  bb2.position.set(-10.95, 0.125, 0);
  sceneGroup.add(bb2);

  // 3. Overhead Grand Banner with Dynamic Title
  const bannerCanvas = document.createElement('canvas');
  bannerCanvas.width = 1200;
  bannerCanvas.height = 240;
  const bannerCtx = bannerCanvas.getContext('2d')!;
  const bannerTexture = new THREE.CanvasTexture(bannerCanvas);
  bannerTexture.colorSpace = THREE.SRGBColorSpace;

  const updateBannerTitle = (titleText: string, subText = '서울특별시 가상 제1투표구  |  소중한 한 표, 현명한 선택!') => {
    bannerCtx.fillStyle = '#ffffff';
    bannerCtx.fillRect(0, 0, 1200, 240);

    bannerCtx.fillStyle = '#0284c7';
    bannerCtx.fillRect(0, 0, 1200, 16);
    bannerCtx.fillStyle = '#16a34a';
    bannerCtx.fillRect(0, 224, 1200, 16);

    // Official Election Emblem Mark
    bannerCtx.fillStyle = '#0284c7';
    bannerCtx.beginPath();
    bannerCtx.arc(80, 120, 42, 0, Math.PI * 2);
    bannerCtx.fill();

    bannerCtx.fillStyle = '#ffffff';
    bannerCtx.font = 'bold 36px sans-serif';
    bannerCtx.textAlign = 'center';
    bannerCtx.textBaseline = 'middle';
    bannerCtx.fillText('선거', 80, 120);

    // Main Banner Title
    bannerCtx.textAlign = 'left';
    bannerCtx.fillStyle = '#0f172a';
    const fontSize = titleText.length > 22 ? 38 : 48;
    bannerCtx.font = `bold ${fontSize}px "Pretendard", "Noto Sans KR", sans-serif`;
    bannerCtx.fillText(titleText, 150, 95);

    bannerCtx.fillStyle = '#475569';
    bannerCtx.font = '500 26px "Pretendard", "Noto Sans KR", sans-serif';
    bannerCtx.fillText(subText, 150, 155);

    // Right side stamp mark
    bannerCtx.strokeStyle = '#dc2626';
    bannerCtx.lineWidth = 4;
    bannerCtx.strokeRect(1020, 50, 130, 130);
    bannerCtx.fillStyle = '#dc2626';
    bannerCtx.font = 'bold 24px sans-serif';
    bannerCtx.textAlign = 'center';
    bannerCtx.fillText('모의선거', 1085, 100);
    bannerCtx.fillText('관리위원회', 1085, 135);

    bannerTexture.needsUpdate = true;
  };

  updateBannerTitle('제1회 오늘 점심 메뉴 모의투표');

  const bannerGeo = new THREE.PlaneGeometry(10, 2.0);
  const bannerMat = new THREE.MeshStandardMaterial({
    map: bannerTexture,
    roughness: 0.4,
  });
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.position.set(0, 4.0, -8.9);
  sceneGroup.add(bannerMesh);

  // Korean Flag on back wall
  const flagGeo = new THREE.PlaneGeometry(2.4, 1.6);
  const flagMat = new THREE.MeshStandardMaterial({
    map: createKoreanFlagTexture(),
    roughness: 0.5,
  });
  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.position.set(-8.0, 3.8, -8.9);
  sceneGroup.add(flagMesh);

  // 4. Floor Directional Markers and Walking Path Guidance
  const pathCanvas = document.createElement('canvas');
  pathCanvas.width = 1024;
  pathCanvas.height = 256;
  const pctx = pathCanvas.getContext('2d')!;
  pctx.fillStyle = '#0284c7';
  pctx.fillRect(0, 0, 1024, 256);
  pctx.fillStyle = '#ffffff';
  pctx.font = 'bold 42px "Pretendard", sans-serif';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  pctx.fillText('투표 진행 방향  ▶  본인확인  ▶  기표소  ▶  투표함  ▶  개표 전광판', 512, 128);

  const pathTexture = new THREE.CanvasTexture(pathCanvas);
  pathTexture.colorSpace = THREE.SRGBColorSpace;
  const pathMat = new THREE.MeshBasicMaterial({
    map: pathTexture,
    transparent: true,
    opacity: 0.85,
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
  // Located at X = -6.5, Z = -4.5
  // ========================================================
  const deskZoneGroup = new THREE.Group();
  deskZoneGroup.position.set(-6.5, 0, -4.5);

  // Main Desk Table
  const tableTopGeo = new THREE.BoxGeometry(4.2, 0.12, 1.4);
  const tableTop = new THREE.Mesh(tableTopGeo, deskTopMat);
  tableTop.position.set(0, 0.88, 0);
  tableTop.castShadow = true;
  tableTop.receiveShadow = true;
  deskZoneGroup.add(tableTop);

  // Desk modesty panel & legs
  const deskPanelGeo = new THREE.BoxGeometry(4.0, 0.76, 0.08);
  const deskPanelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const deskPanel = new THREE.Mesh(deskPanelGeo, deskPanelMat);
  deskPanel.position.set(0, 0.44, 0.55);
  deskPanel.castShadow = true;
  deskZoneGroup.add(deskPanel);

  // Table Legs
  const legPositions = [
    [-1.9, 0.44, -0.55],
    [1.9, 0.44, -0.55],
    [-1.9, 0.44, 0.55],
    [1.9, 0.44, 0.55],
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.88), aluminumMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    deskZoneGroup.add(leg);
  });

  // Desk Signage Board
  const deskSignGeo = new THREE.BoxGeometry(1.4, 0.4, 0.06);
  const deskSignTex = createSignTexture('1. 본인 확인 및 투표용지 교부대', '신분증 및 전자 서명');
  const deskSignMat = new THREE.MeshStandardMaterial({ map: deskSignTex });
  const deskSign = new THREE.Mesh(deskSignGeo, deskSignMat);
  deskSign.position.set(0, 1.25, 0.6);
  deskSign.rotation.x = -0.15;
  deskZoneGroup.add(deskSign);

  // Acrylic Privacy Partition on Desk
  const partitionGeo = new THREE.BoxGeometry(3.6, 0.6, 0.02);
  const partitionMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
  });
  const partition = new THREE.Mesh(partitionGeo, partitionMat);
  partition.position.set(0, 1.2, 0.2);
  deskZoneGroup.add(partition);

  // Laptop on Desk
  const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.28), aluminumMat);
  laptopBase.position.set(-0.6, 0.95, -0.05);
  deskZoneGroup.add(laptopBase);

  const laptopScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.26, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 })
  );
  laptopScreen.position.set(-0.6, 1.08, -0.18);
  laptopScreen.rotation.x = 0.2;
  deskZoneGroup.add(laptopScreen);

  // Ballot Paper Stack Tray
  const paperStack = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.08, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
  );
  paperStack.position.set(0.6, 0.98, -0.05);
  deskZoneGroup.add(paperStack);

  // Stamp Pad
  const stampPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.03, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
  );
  stampPad.position.set(0.15, 0.95, 0.1);
  deskZoneGroup.add(stampPad);

  sceneGroup.add(deskZoneGroup);

  // ========================================================
  // ZONE 2: Voting Booths (기표소 x 2)
  // Located at X = 0, Z = -5.0
  // ========================================================
  const boothZoneGroup = new THREE.Group();
  boothZoneGroup.position.set(0, 0, -5.0);

  // Create two side-by-side authentic Korean voting booths
  const createSingleBooth = (offsetX: number) => {
    const singleBooth = new THREE.Group();
    singleBooth.position.x = offsetX;

    // Booth frame (lightweight aluminum poles)
    const poleMat = aluminumMat;
    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.2);

    // 4 vertical frame legs
    const corners = [
      [-0.7, 1.1, -0.5],
      [0.7, 1.1, -0.5],
      [-0.7, 1.1, 0.5],
      [0.7, 1.1, 0.5],
    ];
    corners.forEach(([x, y, z]) => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, y, z);
      pole.castShadow = true;
      singleBooth.add(pole);
    });

    // Top crossbars
    const barX = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.04), poleMat);
    barX.position.set(0, 2.2, -0.5);
    singleBooth.add(barX);

    const barZ1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0), poleMat);
    barZ1.position.set(-0.7, 2.2, 0);
    singleBooth.add(barZ1);

    const barZ2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0), poleMat);
    barZ2.position.set(0.7, 2.2, 0);
    singleBooth.add(barZ2);

    // Left and Right Privacy Side Walls (white matte composite panel)
    const sideWallGeo = new THREE.BoxGeometry(0.03, 1.6, 1.0);
    const sideWallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });

    const leftWallMesh = new THREE.Mesh(sideWallGeo, sideWallMat);
    leftWallMesh.position.set(-0.7, 1.2, 0);
    singleBooth.add(leftWallMesh);

    const rightWallMesh = new THREE.Mesh(sideWallGeo, sideWallMat);
    rightWallMesh.position.set(0.7, 1.2, 0);
    singleBooth.add(rightWallMesh);

    // Back Panel
    const backWallMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.03), sideWallMat);
    backWallMesh.position.set(0, 1.2, -0.5);
    singleBooth.add(backWallMesh);

    // Inner Shelf Table
    const shelfGeo = new THREE.BoxGeometry(1.36, 0.05, 0.45);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
    const shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(0, 0.95, -0.22);
    shelf.castShadow = true;
    singleBooth.add(shelf);

    // Stamp tool holder on shelf
    const stampHolder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 })
    );
    stampHolder.position.set(0.4, 1.02, -0.2);
    singleBooth.add(stampHolder);

    // Top Sign: "기표소"
    const boothSignTex = createSignTexture('2. 기표소', '비밀투표 보장 (Secret Ballot)', '#16a34a');
    const boothSignMat = new THREE.MeshStandardMaterial({ map: boothSignTex });
    const boothSign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.35, 0.04), boothSignMat);
    boothSign.position.set(0, 2.38, 0.5);
    singleBooth.add(boothSign);

    // Korean Election Booth Privacy Curtain (Deep Navy Blue Fabric)
    const curtainGeo = new THREE.BoxGeometry(1.38, 1.45, 0.04);
    const curtainMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.9,
    });
    const curtain = new THREE.Mesh(curtainGeo, curtainMat);
    curtain.position.set(0, 1.4, 0.48);
    singleBooth.add(curtain);

    return singleBooth;
  };

  const booth1 = createSingleBooth(-1.0);
  const booth2 = createSingleBooth(1.0);
  boothZoneGroup.add(booth1);
  boothZoneGroup.add(booth2);

  sceneGroup.add(boothZoneGroup);

  // ========================================================
  // ZONE 3: Ballot Box (투표함)
  // Located at X = 5.5, Z = -4.5
  // ========================================================
  const boxZoneGroup = new THREE.Group();
  boxZoneGroup.position.set(5.5, 0, -4.5);

  // Stand table for ballot box
  const boxTableTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.1, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
  );
  boxTableTop.position.set(0, 0.72, 0);
  boxTableTop.castShadow = true;
  boxTableTop.receiveShadow = true;
  boxZoneGroup.add(boxTableTop);

  const boxTableLegs = [
    [-0.75, 0.36, -0.55],
    [0.75, 0.36, -0.55],
    [-0.75, 0.36, 0.55],
    [0.75, 0.36, 0.55],
  ];
  boxTableLegs.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), aluminumMat);
    leg.position.set(x, y, z);
    leg.castShadow = true;
    boxZoneGroup.add(leg);
  });

  // Authentic Korean Election Commission Ballot Box Model
  // White rectangular prism with prominent green frame borders and locks
  const ballotBoxMesh = new THREE.Group();
  ballotBoxMesh.position.set(0, 0.77, 0);

  // Main white box body
  const bodyGeo = new THREE.BoxGeometry(0.85, 0.7, 0.65);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.05,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.position.y = 0.35;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  ballotBoxMesh.add(bodyMesh);

  // Prominent Green Frame Edges (Korean election signature style)
  const greenFrameMat = new THREE.MeshStandardMaterial({
    color: 0x15803d, // vivid forest green
    roughness: 0.3,
    metalness: 0.1,
  });

  // Green lid on top
  const lidGeo = new THREE.BoxGeometry(0.89, 0.08, 0.69);
  const lid = new THREE.Mesh(lidGeo, greenFrameMat);
  lid.position.y = 0.72;
  lid.castShadow = true;
  ballotBoxMesh.add(lid);

  // Green corner posts
  const postGeo = new THREE.BoxGeometry(0.06, 0.7, 0.06);
  const postCoords = [
    [-0.41, 0.35, -0.31],
    [0.41, 0.35, -0.31],
    [-0.41, 0.35, 0.31],
    [0.41, 0.35, 0.31],
  ];
  postCoords.forEach(([x, y, z]) => {
    const post = new THREE.Mesh(postGeo, greenFrameMat);
    post.position.set(x, y, z);
    ballotBoxMesh.add(post);
  });

  // Ballot Slot on Top Lid
  const slotGeo = new THREE.BoxGeometry(0.38, 0.02, 0.04);
  const slotMat = new THREE.MeshBasicMaterial({ color: 0x052e16 });
  const slot = new THREE.Mesh(slotGeo, slotMat);
  slot.position.set(0, 0.765, 0);
  ballotBoxMesh.add(slot);

  // Red Security Seals ("특수 봉인 스티커") on locks
  const sealGeo = new THREE.BoxGeometry(0.12, 0.08, 0.02);
  const sealMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

  const sealLeft = new THREE.Mesh(sealGeo, sealMat);
  sealLeft.position.set(-0.25, 0.68, 0.33);
  ballotBoxMesh.add(sealLeft);

  const sealRight = new THREE.Mesh(sealGeo, sealMat);
  sealRight.position.set(0.25, 0.68, 0.33);
  ballotBoxMesh.add(sealRight);

  // Front official title decal "투표함"
  const ballotCanvas = document.createElement('canvas');
  ballotCanvas.width = 512;
  ballotCanvas.height = 256;
  const bctx = ballotCanvas.getContext('2d')!;
  bctx.fillStyle = '#ffffff';
  bctx.fillRect(0, 0, 512, 256);
  bctx.fillStyle = '#15803d';
  bctx.font = 'bold 72px "Pretendard", sans-serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillText('투  표  함', 256, 100);
  bctx.fillStyle = '#64748b';
  bctx.font = '600 32px sans-serif';
  bctx.fillText('BALLOT BOX', 256, 175);

  const ballotTex = new THREE.CanvasTexture(ballotCanvas);
  ballotTex.colorSpace = THREE.SRGBColorSpace;
  const ballotDecalMat = new THREE.MeshBasicMaterial({
    map: ballotTex,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const ballotDecal = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), ballotDecalMat);
  ballotDecal.position.set(0, 0.35, 0.33);
  ballotBoxMesh.add(ballotDecal);

  boxZoneGroup.add(ballotBoxMesh);

  // Top Sign for Ballot Box
  const boxSignTex = createSignTexture('3. 투표함', '접은 투표용지를 투입구에 넣어주세요', '#15803d');
  const boxSignMat = new THREE.MeshStandardMaterial({ map: boxSignTex });
  const boxSign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.05), boxSignMat);
  boxSign.position.set(0, 1.85, 0);
  boxZoneGroup.add(boxSign);

  sceneGroup.add(boxZoneGroup);

  // ========================================================
  // ZONE 4: Results Billboard (개표 전광판) & Exit Door
  // Located at X = 7.0, Z = 1.5
  // ========================================================
  const billboardGroup = new THREE.Group();
  billboardGroup.position.set(7.0, 0, 1.5);
  billboardGroup.rotation.y = -Math.PI / 4; // Angled toward center aisle

  // Truss pillars for billboard
  const pillarGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2);
  const pillarMat = aluminumMat;
  const p1 = new THREE.Mesh(pillarGeo, pillarMat);
  p1.position.set(-1.6, 1.6, 0);
  billboardGroup.add(p1);

  const p2 = new THREE.Mesh(pillarGeo, pillarMat);
  p2.position.set(1.6, 1.6, 0);
  billboardGroup.add(p2);

  // Large High-Tech LED Display Frame
  const frameGeo = new THREE.BoxGeometry(3.6, 2.2, 0.18);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.6 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 2.3, 0);
  billboardGroup.add(frame);

  // Screen Canvas (Dynamic CanvasTexture)
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 1024;
  boardCanvas.height = 640;
  const bCtx = boardCanvas.getContext('2d')!;

  const boardTexture = new THREE.CanvasTexture(boardCanvas);
  boardTexture.colorSpace = THREE.SRGBColorSpace;
  const boardScreenMat = new THREE.MeshBasicMaterial({ map: boardTexture });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), boardScreenMat);
  screenMesh.position.set(0, 2.3, 0.1);
  billboardGroup.add(screenMesh);

  // Billboard Top Header
  const bbHeaderTex = createSignTexture('4. 개표 현황판', '실시간 투표 결과 집계', '#ea580c');
  const bbHeader = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.35, 0.05),
    new THREE.MeshStandardMaterial({ map: bbHeaderTex })
  );
  bbHeader.position.set(0, 3.6, 0);
  billboardGroup.add(bbHeader);

  sceneGroup.add(billboardGroup);

  // Exit Doorway on Right Wall (Z = 6)
  const exitDoorGroup = new THREE.Group();
  exitDoorGroup.position.set(8.5, 0, 5.5);

  const exitFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 3.2, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
  );
  exitFrame.position.set(0, 1.6, 0);
  exitDoorGroup.add(exitFrame);

  // Glass doors
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
  });
  const glassDoor = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.9, 0.04), glassMat);
  glassDoor.position.set(0, 1.5, 0);
  exitDoorGroup.add(glassDoor);

  // Emergency / Exit Sign
  const exitSignCanvas = document.createElement('canvas');
  exitSignCanvas.width = 512;
  exitSignCanvas.height = 160;
  const ectx = exitSignCanvas.getContext('2d')!;
  ectx.fillStyle = '#16a34a';
  ectx.fillRect(0, 0, 512, 160);
  ectx.fillStyle = '#ffffff';
  ectx.font = 'bold 58px sans-serif';
  ectx.textAlign = 'center';
  ectx.textBaseline = 'middle';
  ectx.fillText('출  구  EXIT  ▶', 256, 80);

  const exitSignTex = new THREE.CanvasTexture(exitSignCanvas);
  exitSignTex.colorSpace = THREE.SRGBColorSpace;
  const exitSignMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.4, 0.06),
    new THREE.MeshBasicMaterial({ map: exitSignTex })
  );
  exitSignMesh.position.set(0, 3.4, 0.1);
  exitDoorGroup.add(exitSignMesh);

  sceneGroup.add(exitDoorGroup);

  // ========================================================
  // Dynamic Billboard Canvas Painter
  // ========================================================
  const updateBillboardTexture = (
    results: { id: string; title: string; votes: number; percent: number }[],
    totalVotes: number,
    pollTitle?: string
  ) => {
    // Dark modern digital dashboard
    bCtx.fillStyle = '#0f172a';
    bCtx.fillRect(0, 0, 1024, 640);

    // Grid lines / scanline aesthetic
    bCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    bCtx.lineWidth = 1;
    for (let y = 0; y < 640; y += 32) {
      bCtx.beginPath();
      bCtx.moveTo(0, y);
      bCtx.lineTo(1024, y);
      bCtx.stroke();
    }

    // Header
    bCtx.fillStyle = '#38bdf8';
    bCtx.font = 'bold 30px "Pretendard", sans-serif';
    bCtx.textAlign = 'left';
    const headerTitle = pollTitle ? `● ${pollTitle}` : '● 실시간 개표 현황 (LIVE TALLY)';
    bCtx.fillText(headerTitle.length > 28 ? headerTitle.slice(0, 28) + '...' : headerTitle, 48, 56);

    bCtx.fillStyle = '#94a3b8';
    bCtx.font = '500 22px sans-serif';
    bCtx.textAlign = 'right';
    bCtx.fillText(`총 투표: ${totalVotes}표 | 개표율: 100%`, 976, 56);

    // Horizontal divider
    bCtx.strokeStyle = '#334155';
    bCtx.lineWidth = 2;
    bCtx.beginPath();
    bCtx.moveTo(48, 80);
    bCtx.lineTo(976, 80);
    bCtx.stroke();

    const barColors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
    const count = Math.max(1, results.length);
    const rowHeight = Math.min(130, 520 / count);

    results.forEach((item, idx) => {
      const topY = 96 + idx * rowHeight;
      const barY = topY + Math.min(38, rowHeight * 0.44);
      const barH = Math.max(18, Math.min(28, rowHeight * 0.32));

      // Candidate Number Badge
      bCtx.fillStyle = barColors[idx % barColors.length];
      bCtx.beginPath();
      bCtx.arc(76, topY + 20, 20, 0, Math.PI * 2);
      bCtx.fill();

      bCtx.fillStyle = '#ffffff';
      bCtx.font = 'bold 22px sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillText(`${idx + 1}`, 76, topY + 20);

      // Title
      bCtx.textAlign = 'left';
      bCtx.fillStyle = '#f8fafc';
      bCtx.font = 'bold 26px "Pretendard", sans-serif';
      const displayTitle = item.title.length > 22 ? item.title.slice(0, 22) + '...' : item.title;
      bCtx.fillText(displayTitle, 115, topY + 20);

      // Percentage & votes
      bCtx.textAlign = 'right';
      bCtx.fillStyle = barColors[idx % barColors.length];
      bCtx.font = 'bold 28px monospace';
      bCtx.fillText(`${item.percent}%`, 840, topY + 20);

      bCtx.fillStyle = '#94a3b8';
      bCtx.font = '500 20px sans-serif';
      bCtx.fillText(`(${item.votes}표)`, 976, topY + 20);

      // Bar Track Background
      bCtx.fillStyle = '#1e293b';
      bCtx.beginPath();
      bCtx.roundRect(115, barY, 861, barH, 6);
      bCtx.fill();

      // Filled Animated Bar
      const fillW = Math.max(12, (861 * item.percent) / 100);
      bCtx.fillStyle = barColors[idx % barColors.length];
      bCtx.beginPath();
      bCtx.roundRect(115, barY, fillW, barH, 6);
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
  // Animated Interactive Floor Beacons
  // ========================================================
  const beaconRings: { mesh: THREE.Mesh; step: number }[] = [];

  const createBeacon = (x: number, z: number, step: number) => {
    const ringGeo = new THREE.RingGeometry(0.8, 1.05, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
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

  // Dedicated bright green floor interaction circle in front of '출구 EXIT ▶'
  const exitRingGeo = new THREE.RingGeometry(0.85, 1.12, 36);
  const exitRingMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
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
    color: 0x16a34a,
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
        mat.color.setHex(0xf59e0b); // Active glowing golden amber
        mat.opacity = 0.85;
      } else if (step < currentStep) {
        mat.color.setHex(0x10b981); // Completed green
        mat.opacity = 0.35;
      } else {
        mat.color.setHex(0x94a3b8); // Pending subtle grey
        mat.opacity = 0.2;
      }
    });
  };

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
    ballotBoxMesh,
  };
}
