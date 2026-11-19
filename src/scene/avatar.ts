import * as THREE from 'three';
import { AvatarType, normalizeAvatarType } from '../types';

export type EmoteId = 'hello' | 'clap' | 'think' | 'voted';

export interface CharacterController {
  group: THREE.Group;
  update: (isMoving: boolean, dt: number, speed: number) => void;
  lookAtAngle: (angle: number) => void;
  triggerEmote: (emojiOrId: string, text?: string, emoteId?: EmoteId) => void;
  type: AvatarType | 'npc';
}

const EMOTE_DEFAULTS: Record<EmoteId, { emoji: string; text: string }> = {
  hello: { emoji: '😊', text: '반가워요' },
  clap: { emoji: '👏', text: '박수' },
  think: { emoji: '🤔', text: '신중고민' },
  voted: { emoji: '🗳️', text: '투표완료!' },
};

export function resolveEmoteId(emojiOrId?: string, text?: string, explicitId?: EmoteId): EmoteId {
  if (
    explicitId === 'hello' ||
    explicitId === 'clap' ||
    explicitId === 'think' ||
    explicitId === 'voted'
  ) {
    return explicitId;
  }
  const combined = `${emojiOrId || ''} ${text || ''}`.toLowerCase();
  if (combined.includes('clap') || combined.includes('👏') || combined.includes('박수')) {
    return 'clap';
  }
  if (combined.includes('think') || combined.includes('🤔') || combined.includes('고민')) {
    return 'think';
  }
  if (combined.includes('voted') || combined.includes('🗳') || combined.includes('투표완료')) {
    return 'voted';
  }
  return 'hello';
}

type HairStyleKind =
  | 'shortNeat'
  | 'partedVolume'
  | 'shortDandy'
  | 'bob'
  | 'lowBun'
  | 'longStraight';

interface ClayAvatarSpec {
  top: number;
  sleeves: number;
  collar: number;
  pants: number;
  shoes: number;
  hair: number;
  hairStyle: HairStyleKind;
  accent: number;
  hasGlasses?: boolean;
  outfitKind:
    | 'mustardKnit'
    | 'mintSweat'
    | 'cardiganShirt'
    | 'coralKnit'
    | 'vestWhiteSleeves'
    | 'lavenderDress'
    | 'npcOfficial';
}

const AVATAR_SPECS: Record<AvatarType | 'npc', ClayAvatarSpec> = {
  // 1) male_1 (따뜻한 머스타드남): 코코아 브라운 숏컷 + 머스타드 옐로 니트(#E8B84B) + 웜 브라운 팬츠(#6B5443)
  male_1: {
    top: 0xe8b84b,
    sleeves: 0xe8b84b,
    collar: 0xf1cc75,
    pants: 0x6b5443,
    shoes: 0xf4ede2,
    hair: 0x4a3428,
    hairStyle: 'shortNeat',
    accent: 0xc9962b,
    outfitKind: 'mustardKnit',
  },
  // 2) male_2 (산뜻한 민트남): 짙은 흑갈색 볼륨 가르마 + 세이지 민트 맨투맨(#7BC4A4) + 소프트 네이비 팬츠(#455A75)
  male_2: {
    top: 0x7bc4a4,
    sleeves: 0x7bc4a4,
    collar: 0x9bd6bc,
    pants: 0x455a75,
    shoes: 0xf6f1e9,
    hair: 0x2b1f1b,
    hairStyle: 'partedVolume',
    accent: 0x5ca485,
    outfitKind: 'mintSweat',
  },
  // 3) male_3 (댄디 안경남): 다크 브라운 숏컷 + 동그란 뿔테 안경 + 더스티 블루 가디건(#6C93B8) + 크림 셔츠 + 차콜 슬랙스(#4A4E57)
  male_3: {
    top: 0x6c93b8,
    sleeves: 0x6c93b8,
    collar: 0xfaf3e7,
    pants: 0x4a4e57,
    shoes: 0x4a372c,
    hair: 0x3a2820,
    hairStyle: 'shortDandy',
    accent: 0xfaf3e7,
    hasGlasses: true,
    outfitKind: 'cardiganShirt',
  },
  // 4) female_1 (포근한 단발녀): 코코아 브라운 볼륨 단발 + 피치 코랄 니트(#F09684) + 크림 베이지 팬츠(#D8C9B8)
  female_1: {
    top: 0xf09684,
    sleeves: 0xf09684,
    collar: 0xf7b8ab,
    pants: 0xd8c9b8,
    shoes: 0x8d674f,
    hair: 0x4e3529,
    hairStyle: 'bob',
    accent: 0xf6e2a4,
    outfitKind: 'coralKnit',
  },
  // 5) female_2 (상큼한 묶음머리녀): 짙은 밤색 로우번 + 버터 옐로 니트 조끼(#F2D16B) & 화이트 소매 + 웜 그레이 팬츠(#6F727A)
  female_2: {
    top: 0xf2d16b,
    sleeves: 0xfffdf8,
    collar: 0xfffdf8,
    pants: 0x6f727a,
    shoes: 0xf5efe6,
    hair: 0x362219,
    hairStyle: 'lowBun',
    accent: 0xf2d16b,
    outfitKind: 'vestWhiteSleeves',
  },
  // 6) female_3 (차분한 긴머리녀): 초코 브라운 긴 생머리 + 소프트 라벤더 니트 원피스(#B49BD6) + 딥 브라운 슈즈
  female_3: {
    top: 0xb49bd6,
    sleeves: 0xb49bd6,
    collar: 0xd1bfe8,
    pants: 0xf2d2bc,
    shoes: 0x4b3226,
    hair: 0x3f281e,
    hairStyle: 'longStraight',
    accent: 0x997ec2,
    outfitKind: 'lavenderDress',
  },
  // NPC Election Official (warm pastel sky-blue vest & clay style)
  npc: {
    top: 0x6fa5c9,
    sleeves: 0xf7f1e6,
    collar: 0xf7f1e6,
    pants: 0x5c5149,
    shoes: 0x4b3d35,
    hair: 0x392820,
    hairStyle: 'shortNeat',
    accent: 0x5086ab,
    outfitKind: 'npcOfficial',
  },
};

const PASTEL_FX_COLORS = [0xf7b2bd, 0xf6d57a, 0x8fd6b4, 0x9bc7f4, 0xcab6f2, 0xf7bfa0];

function smoothStep(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
}

// Shared radial-gradient soft contact shadow texture (created once, zero external assets)
let cachedShadowBlobTexture: THREE.CanvasTexture | null = null;
function getSoftShadowBlobTexture(): THREE.CanvasTexture {
  if (cachedShadowBlobTexture) return cachedShadowBlobTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(62, 44, 32, 0.34)');
  grad.addColorStop(0.55, 'rgba(62, 44, 32, 0.16)');
  grad.addColorStop(1, 'rgba(62, 44, 32, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  cachedShadowBlobTexture = tex;
  return tex;
}

function createEmoteBubbleTexture(emoji: string, text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 420;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Warm cozy speech bubble pill + bottom pointer
  const x = 14;
  const y = 10;
  const w = canvas.width - 28;
  const h = 86;
  const r = 40;

  ctx.fillStyle = 'rgba(255, 251, 245, 0.96)';
  ctx.strokeStyle = '#d9a482';
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(canvas.width / 2 + 14, y + h);
  ctx.lineTo(canvas.width / 2, y + h + 18);
  ctx.lineTo(canvas.width / 2 - 14, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#3b2b22';
  ctx.font = 'bold 34px "Pretendard", "Noto Sans KR", -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${emoji} ${text}`, canvas.width / 2, y + h / 2 + 1);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

interface MicroParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  isRing: boolean;
  age: number;
  life: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  spinX: number;
  spinY: number;
  baseScale: number;
}

export function createProceduralAvatar(
  rawType: AvatarType | 'male' | 'female' | 'npc',
  _colorSeed?: string
): CharacterController {
  const type: AvatarType | 'npc' = rawType === 'npc' ? 'npc' : normalizeAvatarType(rawType);
  const spec = AVATAR_SPECS[type];

  const group = new THREE.Group();
  group.name = `avatar_${type}`;

  // Matte clay & knit PBR materials (roughness: 0.82, metalness: 0.0)
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf8d5bc,
    roughness: 0.8,
    metalness: 0.0,
  });

  const blushMat = new THREE.MeshStandardMaterial({
    color: 0xf29f9f,
    roughness: 0.86,
    metalness: 0.0,
    transparent: true,
    opacity: 0.58,
  });

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x261c17,
    roughness: 0.18,
    metalness: 0.05,
  });

  const eyeHighlightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  const topMat = new THREE.MeshStandardMaterial({
    color: spec.top,
    roughness: 0.82,
    metalness: 0.0,
  });

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: spec.sleeves,
    roughness: 0.82,
    metalness: 0.0,
  });

  const collarMat = new THREE.MeshStandardMaterial({
    color: spec.collar,
    roughness: 0.84,
    metalness: 0.0,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: spec.pants,
    roughness: 0.82,
    metalness: 0.0,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: spec.shoes,
    roughness: 0.72,
    metalness: 0.0,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: spec.hair,
    roughness: 0.8,
    metalness: 0.0,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accent,
    roughness: 0.82,
    metalness: 0.0,
  });

  // Base vertical anchors for adorable ~2.7-head-tall miniature clay proportions
  const PELVIS_BASE_Y = 0.54;
  const LEG_PIVOT_BASE_Y = 0.5;
  const TORSO_BASE_Y = 0.55;

  // Snug shoulder rest anchors (arm length +18% for expressive claps & chin rest)
  const LEFT_SHOULDER_BASE_X = -0.23;
  const RIGHT_SHOULDER_BASE_X = 0.23;
  const SHOULDER_BASE_Y = 0.405;
  const SHOULDER_BASE_Z = 0.012;

  // Inner animated body rig (pivot at feet y=0 so clay squash & stretch stays grounded!)
  const rigGroup = new THREE.Group();
  group.add(rigGroup);

  // --- Pelvis / Rounded Hips ---
  const pelvisMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.195, 18, 14),
    spec.outfitKind === 'lavenderDress' ? topMat : pantsMat
  );
  pelvisMesh.scale.set(1.06, 0.58, 0.86);
  pelvisMesh.position.y = PELVIS_BASE_Y;
  pelvisMesh.castShadow = true;
  pelvisMesh.receiveShadow = true;
  rigGroup.add(pelvisMesh);

  // --- Rounded Clay Legs & Plump Shoes ---
  const legGeo = new THREE.CapsuleGeometry(0.068, 0.25, 8, 14);
  const shoeGeo = new THREE.CapsuleGeometry(0.066, 0.09, 8, 14);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.11, LEG_PIVOT_BASE_Y, 0);

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.y = -0.22;
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  leftLegPivot.add(leftLeg);

  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.rotation.x = Math.PI / 2;
  leftShoe.scale.set(1.02, 1.0, 0.82);
  leftShoe.position.set(0, -0.445, 0.045);
  leftShoe.castShadow = true;
  leftShoe.receiveShadow = true;
  leftLegPivot.add(leftShoe);

  rigGroup.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.11, LEG_PIVOT_BASE_Y, 0);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.y = -0.22;
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  rightLegPivot.add(rightLeg);

  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.rotation.x = Math.PI / 2;
  rightShoe.scale.set(1.02, 1.0, 0.82);
  rightShoe.position.set(0, -0.445, 0.045);
  rightShoe.castShadow = true;
  rightShoe.receiveShadow = true;
  rightLegPivot.add(rightShoe);

  rigGroup.add(rightLegPivot);

  // --- Torso Waist Pivot (`torsoGroup`: torso + head + both articulated arms) ---
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = TORSO_BASE_Y;
  rigGroup.add(torsoGroup);

  const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.19, 10, 20), topMat);
  torsoMesh.scale.set(1.08, 1.0, 0.88);
  torsoMesh.position.y = 0.24;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torsoGroup.add(torsoMesh);

  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.032, 10, 20), collarMat);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.set(0, 0.455, 0.0);
  torsoGroup.add(collarRing);

  // Outfit-specific sculpted clay details (100% preserved across all 6 variants + NPC)
  if (spec.outfitKind === 'mustardKnit') {
    const hemMesh = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.032, 10, 22), collarMat);
    hemMesh.rotation.x = Math.PI / 2;
    hemMesh.scale.set(1.06, 0.86, 1.0);
    hemMesh.position.y = 0.05;
    torsoGroup.add(hemMesh);

    const buttonGeo = new THREE.SphereGeometry(0.017, 10, 8);
    [0.35, 0.25, 0.15].forEach((by) => {
      const btn = new THREE.Mesh(buttonGeo, accentMat);
      btn.scale.set(1, 1, 0.5);
      btn.position.set(0, by, 0.172);
      torsoGroup.add(btn);
    });
  } else if (spec.outfitKind === 'mintSweat') {
    const hemMesh = new THREE.Mesh(new THREE.TorusGeometry(0.182, 0.034, 10, 22), collarMat);
    hemMesh.rotation.x = Math.PI / 2;
    hemMesh.scale.set(1.06, 0.86, 1.0);
    hemMesh.position.y = 0.05;
    torsoGroup.add(hemMesh);

    const chestPatch = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.028, 0.025, 6, 10),
      new THREE.MeshStandardMaterial({ color: 0xf7f2e8, roughness: 0.85 })
    );
    chestPatch.scale.set(1.2, 0.85, 0.35);
    chestPatch.position.set(0.085, 0.31, 0.165);
    torsoGroup.add(chestPatch);
  } else if (spec.outfitKind === 'cardiganShirt') {
    const creamShirtMat = new THREE.MeshStandardMaterial({
      color: 0xfaf3e7,
      roughness: 0.84,
      metalness: 0.0,
    });
    const innerShirt = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.22, 8, 12), creamShirtMat);
    innerShirt.scale.set(1.0, 1.0, 0.45);
    innerShirt.position.set(0, 0.28, 0.152);
    torsoGroup.add(innerShirt);

    const btnMat = new THREE.MeshStandardMaterial({ color: 0x3f434c, roughness: 0.6 });
    const btnGeo = new THREE.SphereGeometry(0.015, 10, 8);
    [0.24, 0.16, 0.09].forEach((by) => {
      const btn = new THREE.Mesh(btnGeo, btnMat);
      btn.scale.set(1, 1, 0.55);
      btn.position.set(0.052, by, 0.172);
      torsoGroup.add(btn);
    });

    const hemMesh = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 10, 22), topMat);
    hemMesh.rotation.x = Math.PI / 2;
    hemMesh.scale.set(1.06, 0.86, 1.0);
    hemMesh.position.y = 0.05;
    torsoGroup.add(hemMesh);
  } else if (spec.outfitKind === 'coralKnit') {
    const hemMesh = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.032, 10, 22), collarMat);
    hemMesh.rotation.x = Math.PI / 2;
    hemMesh.scale.set(1.06, 0.86, 1.0);
    hemMesh.position.y = 0.05;
    torsoGroup.add(hemMesh);

    const trimGeo = new THREE.SphereGeometry(0.025, 12, 10);
    [-0.045, 0.045].forEach((tx) => {
      const trim = new THREE.Mesh(trimGeo, accentMat);
      trim.position.set(tx, 0.43, 0.125);
      torsoGroup.add(trim);
    });
  } else if (spec.outfitKind === 'vestWhiteSleeves') {
    const whiteHem = new THREE.Mesh(new THREE.TorusGeometry(0.182, 0.032, 10, 22), collarMat);
    whiteHem.rotation.x = Math.PI / 2;
    whiteHem.scale.set(1.06, 0.86, 1.0);
    whiteHem.position.y = 0.045;
    torsoGroup.add(whiteHem);

    const shirtFront = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), collarMat);
    shirtFront.scale.set(1.15, 0.85, 0.45);
    shirtFront.position.set(0, 0.405, 0.135);
    torsoGroup.add(shirtFront);

    [-0.2, 0.2].forEach((sx) => {
      const armhole = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.018, 8, 14), topMat);
      armhole.rotation.y = Math.PI / 2;
      armhole.position.set(sx, 0.36, 0);
      torsoGroup.add(armhole);
    });
  } else if (spec.outfitKind === 'lavenderDress') {
    const skirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.255, 0.25, 22), topMat);
    skirtMesh.scale.set(1.05, 1.0, 0.9);
    skirtMesh.position.y = -0.02;
    skirtMesh.castShadow = true;
    skirtMesh.receiveShadow = true;
    torsoGroup.add(skirtMesh);

    const skirtHem = new THREE.Mesh(new THREE.TorusGeometry(0.246, 0.025, 10, 24), collarMat);
    skirtHem.rotation.x = Math.PI / 2;
    skirtHem.scale.set(1.04, 0.9, 1.0);
    skirtHem.position.y = -0.14;
    torsoGroup.add(skirtHem);

    const beltMesh = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 22), accentMat);
    beltMesh.rotation.x = Math.PI / 2;
    beltMesh.scale.set(1.07, 0.88, 1.0);
    beltMesh.position.y = 0.11;
    torsoGroup.add(beltMesh);
  } else {
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.13, 0.022),
      new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.6, metalness: 0.0 })
    );
    badge.position.set(0.075, 0.23, 0.175);
    torsoGroup.add(badge);

    const badgeStripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.095, 0.03, 0.025),
      new THREE.MeshStandardMaterial({ color: 0x5dae74, roughness: 0.6 })
    );
    badgeStripe.position.set(0.075, 0.27, 0.176);
    torsoGroup.add(badgeStripe);

    const lanyard = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8), accentMat);
    lanyard.rotation.z = -0.35;
    lanyard.position.set(0.04, 0.36, 0.155);
    torsoGroup.add(lanyard);
  }

  // Short rounded neck
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, 0.1, 14), skinMat);
  neckMesh.position.y = 0.5;
  torsoGroup.add(neckMesh);

  // --- Head Group (Preserved facial features, blush, glasses, and 6 sculpted hairstyles) ---
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.74;
  torsoGroup.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.285, 28, 22), skinMat);
  headMesh.scale.set(1.04, 0.96, 1.0);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headGroup.add(headMesh);

  const earGeo = new THREE.SphereGeometry(0.056, 14, 12);
  const leftEar = new THREE.Mesh(earGeo, skinMat);
  leftEar.scale.set(0.65, 1.0, 0.85);
  leftEar.position.set(-0.285, -0.02, -0.01);
  headGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, skinMat);
  rightEar.scale.set(0.65, 1.0, 0.85);
  rightEar.position.set(0.285, -0.02, -0.01);
  headGroup.add(rightEar);

  const eyeGeo = new THREE.SphereGeometry(0.028, 14, 12);
  const catchlightGeo = new THREE.SphereGeometry(0.008, 8, 8);

  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.scale.set(1.0, 1.08, 0.7);
  leftEye.position.set(-0.095, 0.015, 0.268);
  headGroup.add(leftEye);

  const leftCatch = new THREE.Mesh(catchlightGeo, eyeHighlightMat);
  leftCatch.position.set(-0.086, 0.026, 0.287);
  headGroup.add(leftCatch);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.scale.set(1.0, 1.08, 0.7);
  rightEye.position.set(0.095, 0.015, 0.268);
  headGroup.add(rightEye);

  const rightCatch = new THREE.Mesh(catchlightGeo, eyeHighlightMat);
  rightCatch.position.set(0.104, 0.026, 0.287);
  headGroup.add(rightCatch);

  const blushGeo = new THREE.SphereGeometry(0.048, 14, 10);
  const leftBlush = new THREE.Mesh(blushGeo, blushMat);
  leftBlush.scale.set(1.25, 0.72, 0.28);
  leftBlush.position.set(-0.155, -0.042, 0.244);
  leftBlush.rotation.y = -0.35;
  headGroup.add(leftBlush);

  const rightBlush = new THREE.Mesh(blushGeo, blushMat);
  rightBlush.scale.set(1.25, 0.72, 0.28);
  rightBlush.position.set(0.155, -0.042, 0.244);
  rightBlush.rotation.y = 0.35;
  headGroup.add(rightBlush);

  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), skinMat);
  noseMesh.scale.set(1.0, 0.85, 0.9);
  noseMesh.position.set(0, -0.022, 0.286);
  headGroup.add(noseMesh);

  const smileMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.036, 0.0075, 8, 14, Math.PI * 0.72),
    new THREE.MeshStandardMaterial({ color: 0xb66f5d, roughness: 0.7, metalness: 0.0 })
  );
  smileMesh.rotation.z = Math.PI + Math.PI * 0.14;
  smileMesh.position.set(0, -0.068, 0.273);
  headGroup.add(smileMesh);

  // Cute Round Horn-Rimmed Glasses for male_3 (댄디 안경남)
  if (spec.hasGlasses) {
    const glassesGroup = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x2c1e18,
      roughness: 0.35,
      metalness: 0.08,
    });
    const lensMat = new THREE.MeshStandardMaterial({
      color: 0xeef7ff,
      transparent: true,
      opacity: 0.22,
      roughness: 0.12,
      metalness: 0.05,
    });

    const rimGeo = new THREE.TorusGeometry(0.068, 0.011, 10, 24);
    const lensGeo = new THREE.CircleGeometry(0.062, 20);

    [-0.098, 0.098].forEach((gx) => {
      const rim = new THREE.Mesh(rimGeo, frameMat);
      rim.position.set(gx, 0.014, 0.288);
      glassesGroup.add(rim);

      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(gx, 0.014, 0.286);
      glassesGroup.add(lens);
    });

    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.06, 8), frameMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.02, 0.292);
    glassesGroup.add(bridge);

    const templeGeo = new THREE.CylinderGeometry(0.0075, 0.0075, 0.24, 8);
    [-1, 1].forEach((side) => {
      const temple = new THREE.Mesh(templeGeo, frameMat);
      temple.rotation.x = Math.PI / 2;
      temple.rotation.z = side * -0.42;
      temple.position.set(side * 0.22, 0.012, 0.17);
      glassesGroup.add(temple);
    });

    headGroup.add(glassesGroup);
  }

  // Sculpted Rounded Clay Hairstyles
  const crownMesh = new THREE.Mesh(new THREE.SphereGeometry(0.302, 26, 20), hairMat);
  crownMesh.scale.set(1.05, 0.96, 1.03);
  crownMesh.position.set(0, 0.055, -0.032);
  crownMesh.castShadow = true;
  headGroup.add(crownMesh);

  if (spec.hairStyle === 'shortNeat' || spec.hairStyle === 'shortDandy') {
    const fringeSpecs =
      spec.hairStyle === 'shortDandy'
        ? [
            { x: -0.15, y: 0.16, z: 0.18, r: 0.095 },
            { x: -0.04, y: 0.185, z: 0.21, r: 0.105 },
            { x: 0.08, y: 0.175, z: 0.205, r: 0.1 },
            { x: 0.175, y: 0.135, z: 0.16, r: 0.088 },
          ]
        : [
            { x: -0.14, y: 0.16, z: 0.185, r: 0.096 },
            { x: -0.02, y: 0.18, z: 0.215, r: 0.106 },
            { x: 0.1, y: 0.165, z: 0.205, r: 0.1 },
            { x: 0.18, y: 0.12, z: 0.15, r: 0.085 },
          ];
    fringeSpecs.forEach(({ x, y, z, r }) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 14), hairMat);
      puff.scale.set(1.15, 0.85, 0.85);
      puff.position.set(x, y, z);
      puff.castShadow = true;
      headGroup.add(puff);
    });

    const sideTuftGeo = new THREE.CapsuleGeometry(0.048, 0.09, 6, 12);
    [-0.26, 0.26].forEach((sx) => {
      const side = new THREE.Mesh(sideTuftGeo, hairMat);
      side.position.set(sx, 0.05, 0.05);
      headGroup.add(side);
    });

    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), hairMat);
    nape.scale.set(1.06, 0.88, 0.82);
    nape.position.set(0, -0.05, -0.13);
    headGroup.add(nape);
  } else if (spec.hairStyle === 'partedVolume') {
    const leftWave = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), hairMat);
    leftWave.scale.set(1.22, 0.92, 0.92);
    leftWave.position.set(-0.12, 0.185, 0.185);
    leftWave.rotation.z = 0.2;
    leftWave.castShadow = true;
    headGroup.add(leftWave);

    const rightWave = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 14), hairMat);
    rightWave.scale.set(1.18, 0.88, 0.9);
    rightWave.position.set(0.13, 0.17, 0.185);
    rightWave.rotation.z = -0.22;
    rightWave.castShadow = true;
    headGroup.add(rightWave);

    const topVolume = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), hairMat);
    topVolume.scale.set(1.28, 0.72, 1.05);
    topVolume.position.set(-0.04, 0.275, 0.04);
    topVolume.castShadow = true;
    headGroup.add(topVolume);

    const sideLockGeo = new THREE.CapsuleGeometry(0.054, 0.11, 8, 12);
    [-0.265, 0.265].forEach((sx) => {
      const side = new THREE.Mesh(sideLockGeo, hairMat);
      side.position.set(sx, 0.045, 0.055);
      headGroup.add(side);
    });

    const nape = new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 14), hairMat);
    nape.scale.set(1.08, 0.9, 0.84);
    nape.position.set(0, -0.05, -0.13);
    headGroup.add(nape);
  } else if (spec.hairStyle === 'bob') {
    const bangSpecs = [
      { x: -0.15, y: 0.15, z: 0.19, r: 0.098 },
      { x: -0.05, y: 0.175, z: 0.22, r: 0.102 },
      { x: 0.055, y: 0.175, z: 0.22, r: 0.102 },
      { x: 0.155, y: 0.145, z: 0.19, r: 0.095 },
    ];
    bangSpecs.forEach(({ x, y, z, r }) => {
      const bang = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 14), hairMat);
      bang.scale.set(1.08, 0.86, 0.8);
      bang.position.set(x, y, z);
      bang.castShadow = true;
      headGroup.add(bang);
    });

    const sideBobGeo = new THREE.CapsuleGeometry(0.092, 0.22, 10, 16);
    const leftBob = new THREE.Mesh(sideBobGeo, hairMat);
    leftBob.position.set(-0.245, -0.045, 0.02);
    leftBob.rotation.z = -0.12;
    leftBob.castShadow = true;
    headGroup.add(leftBob);

    const rightBob = new THREE.Mesh(sideBobGeo, hairMat);
    rightBob.position.set(0.245, -0.045, 0.02);
    rightBob.rotation.z = 0.12;
    rightBob.castShadow = true;
    headGroup.add(rightBob);

    const backBob = new THREE.Mesh(new THREE.SphereGeometry(0.285, 20, 16), hairMat);
    backBob.scale.set(1.12, 1.05, 0.86);
    backBob.position.set(0, -0.05, -0.115);
    backBob.castShadow = true;
    headGroup.add(backBob);
  } else if (spec.hairStyle === 'lowBun') {
    const bangSpecs = [
      { x: -0.14, y: 0.155, z: 0.195, r: 0.095 },
      { x: -0.03, y: 0.175, z: 0.22, r: 0.1 },
      { x: 0.09, y: 0.165, z: 0.21, r: 0.098 },
      { x: 0.18, y: 0.13, z: 0.175, r: 0.088 },
    ];
    bangSpecs.forEach(({ x, y, z, r }) => {
      const bang = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 14), hairMat);
      bang.scale.set(1.12, 0.82, 0.78);
      bang.position.set(x, y, z);
      bang.castShadow = true;
      headGroup.add(bang);
    });

    const wispGeo = new THREE.CapsuleGeometry(0.052, 0.14, 8, 12);
    const leftWisp = new THREE.Mesh(wispGeo, hairMat);
    leftWisp.position.set(-0.25, -0.02, 0.06);
    leftWisp.rotation.z = -0.1;
    headGroup.add(leftWisp);

    const rightWisp = new THREE.Mesh(wispGeo, hairMat);
    rightWisp.position.set(0.25, -0.02, 0.06);
    rightWisp.rotation.z = 0.1;
    headGroup.add(rightWisp);

    const tieMesh = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.024, 10, 18), accentMat);
    tieMesh.position.set(0, -0.06, -0.295);
    headGroup.add(tieMesh);

    const bunMesh = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), hairMat);
    bunMesh.scale.set(1.08, 0.98, 0.98);
    bunMesh.position.set(0, -0.07, -0.38);
    bunMesh.castShadow = true;
    headGroup.add(bunMesh);
  } else {
    const bangSpecs = [
      { x: -0.155, y: 0.15, z: 0.185, r: 0.098 },
      { x: -0.055, y: 0.178, z: 0.215, r: 0.102 },
      { x: 0.065, y: 0.172, z: 0.21, r: 0.1 },
      { x: 0.165, y: 0.14, z: 0.18, r: 0.094 },
    ];
    bangSpecs.forEach(({ x, y, z, r }) => {
      const bang = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 14), hairMat);
      bang.scale.set(1.1, 0.84, 0.8);
      bang.position.set(x, y, z);
      bang.castShadow = true;
      headGroup.add(bang);
    });

    const longSideGeo = new THREE.CapsuleGeometry(0.068, 0.36, 10, 14);
    const leftStrand = new THREE.Mesh(longSideGeo, hairMat);
    leftStrand.position.set(-0.245, -0.14, 0.01);
    leftStrand.rotation.z = -0.06;
    leftStrand.castShadow = true;
    headGroup.add(leftStrand);

    const rightStrand = new THREE.Mesh(longSideGeo, hairMat);
    rightStrand.position.set(0.245, -0.14, 0.01);
    rightStrand.rotation.z = 0.06;
    rightStrand.castShadow = true;
    headGroup.add(rightStrand);

    const backCascade = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 12, 20), hairMat);
    backCascade.scale.set(1.22, 1.0, 0.56);
    backCascade.position.set(0, -0.25, -0.22);
    backCascade.rotation.x = 0.08;
    backCascade.castShadow = true;
    backCascade.receiveShadow = true;
    headGroup.add(backCascade);

    [-0.14, 0.14].forEach((bx) => {
      const endLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.26, 8, 14), hairMat);
      endLock.scale.set(1.0, 1.0, 0.72);
      endLock.position.set(bx, -0.27, -0.19);
      endLock.rotation.x = 0.08;
      endLock.castShadow = true;
      headGroup.add(endLock);
    });
  }

  // ========================================================
  // 2-Segment Articulated Clay Arms (Shoulder + Elbow + Hand)
  // Upper arm: 0.185m + Forearm & hand: 0.195m = 0.38m reach (+18% vs old 0.32m)
  // ========================================================
  const upperArmGeo = new THREE.CapsuleGeometry(0.055, 0.115, 8, 14);
  const elbowBallGeo = new THREE.SphereGeometry(0.052, 12, 10);
  const forearmGeo = new THREE.CapsuleGeometry(0.049, 0.095, 8, 14);
  const handGeo = new THREE.SphereGeometry(0.054, 14, 12);

  // Left Arm (Shoulder Pivot -> Upper Arm -> Elbow Pivot -> Forearm + Hand)
  const leftArm = new THREE.Group();
  leftArm.name = 'leftArm';
  leftArm.position.set(LEFT_SHOULDER_BASE_X, SHOULDER_BASE_Y, SHOULDER_BASE_Z);

  const leftUpperArm = new THREE.Mesh(upperArmGeo, sleeveMat);
  leftUpperArm.position.y = -0.092;
  leftUpperArm.castShadow = true;
  leftUpperArm.receiveShadow = true;
  leftArm.add(leftUpperArm);

  const leftElbowBall = new THREE.Mesh(elbowBallGeo, sleeveMat);
  leftElbowBall.position.y = -0.185;
  leftArm.add(leftElbowBall);

  const leftElbow = new THREE.Group();
  leftElbow.name = 'leftElbow';
  leftElbow.position.set(0, -0.185, 0);
  leftArm.add(leftElbow);

  const leftForearm = new THREE.Mesh(forearmGeo, sleeveMat);
  leftForearm.position.y = -0.085;
  leftForearm.castShadow = true;
  leftForearm.receiveShadow = true;
  leftElbow.add(leftForearm);

  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.y = -0.195;
  leftHand.castShadow = true;
  leftElbow.add(leftHand);

  torsoGroup.add(leftArm);

  // Right Arm (Shoulder Pivot -> Upper Arm -> Elbow Pivot -> Forearm + Hand)
  const rightArm = new THREE.Group();
  rightArm.name = 'rightArm';
  rightArm.position.set(RIGHT_SHOULDER_BASE_X, SHOULDER_BASE_Y, SHOULDER_BASE_Z);

  const rightUpperArm = new THREE.Mesh(upperArmGeo, sleeveMat);
  rightUpperArm.position.y = -0.092;
  rightUpperArm.castShadow = true;
  rightUpperArm.receiveShadow = true;
  rightArm.add(rightUpperArm);

  const rightElbowBall = new THREE.Mesh(elbowBallGeo, sleeveMat);
  rightElbowBall.position.y = -0.185;
  rightArm.add(rightElbowBall);

  const rightElbow = new THREE.Group();
  rightElbow.name = 'rightElbow';
  rightElbow.position.set(0, -0.185, 0);
  rightArm.add(rightElbow);

  const rightForearm = new THREE.Mesh(forearmGeo, sleeveMat);
  rightForearm.position.y = -0.085;
  rightForearm.castShadow = true;
  rightForearm.receiveShadow = true;
  rightElbow.add(rightForearm);

  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.position.y = -0.195;
  rightHand.castShadow = true;
  rightElbow.add(rightHand);

  torsoGroup.add(rightArm);

  // ========================================================
  // Pre-Allocated Micro 3D Pastel Particle Pool (Clap Sparkles/Rings & Jump Confetti)
  // Zero per-frame GPU/GC allocations!
  // ========================================================
  const fxGroup = new THREE.Group();
  group.add(fxGroup);

  const sparkGeo = new THREE.OctahedronGeometry(0.036, 0);
  const ringFxGeo = new THREE.TorusGeometry(0.06, 0.012, 8, 18);
  const particles: MicroParticle[] = [];

  for (let i = 0; i < 14; i++) {
    const isRing = i < 2;
    const mat = new THREE.MeshBasicMaterial({
      color: PASTEL_FX_COLORS[i % PASTEL_FX_COLORS.length],
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(isRing ? ringFxGeo : sparkGeo, mat);
    mesh.visible = false;
    fxGroup.add(mesh);
    particles.push({
      mesh,
      mat,
      active: false,
      isRing,
      age: 0,
      life: 0.45,
      vx: 0,
      vy: 0,
      vz: 0,
      gravity: 0,
      spinX: 0,
      spinY: 0,
      baseScale: 1,
    });
  }

  let ringCursor = 0;
  let sparkCursor = 2;

  const spawnClapSparkleBurst = () => {
    // 1 subtle expanding pastel ring at chest-front midpoint where hands meet
    const ringP = particles[ringCursor];
    ringCursor = (ringCursor + 1) % 2;
    ringP.active = true;
    ringP.age = 0;
    ringP.life = 0.28;
    ringP.vx = 0;
    ringP.vy = 0.08;
    ringP.vz = 0.04;
    ringP.gravity = 0;
    ringP.spinX = 0;
    ringP.spinY = 0;
    ringP.baseScale = 0.7;
    ringP.mat.color.setHex(PASTEL_FX_COLORS[Math.floor(Math.random() * PASTEL_FX_COLORS.length)]);
    ringP.mat.opacity = 0.85;
    ringP.mesh.position.set(0, 0.91, 0.305);
    ringP.mesh.rotation.set(0, 0, 0);
    ringP.mesh.scale.setScalar(0.5);
    ringP.mesh.visible = true;

    // 3 cute pastel sparkle pips popping from between hands
    for (let k = 0; k < 3; k++) {
      const p = particles[sparkCursor];
      sparkCursor = 2 + ((sparkCursor - 2 + 1) % 12);
      const angle = (k / 3) * Math.PI * 2 + Math.random() * 0.6;
      const spd = 0.55 + Math.random() * 0.35;
      p.active = true;
      p.age = 0;
      p.life = 0.34 + Math.random() * 0.1;
      p.vx = Math.cos(angle) * spd;
      p.vy = 0.35 + Math.abs(Math.sin(angle)) * 0.45;
      p.vz = 0.22 + Math.random() * 0.25;
      p.gravity = -1.6;
      p.spinX = (Math.random() - 0.5) * 10;
      p.spinY = (Math.random() - 0.5) * 10;
      p.baseScale = 0.72 + Math.random() * 0.32;
      p.mat.color.setHex(PASTEL_FX_COLORS[(sparkCursor + k) % PASTEL_FX_COLORS.length]);
      p.mat.opacity = 0.95;
      p.mesh.position.set((Math.random() - 0.5) * 0.04, 0.91, 0.295);
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
    }
  };

  const spawnJumpConfettiBurst = (originY: number) => {
    for (let k = 0; k < 7; k++) {
      const p = particles[sparkCursor];
      sparkCursor = 2 + ((sparkCursor - 2 + 1) % 12);
      const angle = (k / 7) * Math.PI * 2 + Math.random() * 0.35;
      const radSpd = 0.85 + Math.random() * 0.55;
      p.active = true;
      p.age = 0;
      p.life = 0.62 + Math.random() * 0.22;
      p.vx = Math.cos(angle) * radSpd;
      p.vy = 0.65 + Math.random() * 0.55;
      p.vz = Math.sin(angle) * radSpd;
      p.gravity = -2.1;
      p.spinX = (Math.random() - 0.5) * 12;
      p.spinY = (Math.random() - 0.5) * 12;
      p.baseScale = 0.82 + Math.random() * 0.38;
      p.mat.color.setHex(PASTEL_FX_COLORS[(k + sparkCursor) % PASTEL_FX_COLORS.length]);
      p.mat.opacity = 0.95;
      p.mesh.position.set(Math.cos(angle) * 0.16, originY, Math.sin(angle) * 0.16);
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
    }
  };

  const updateParticles = (dt: number) => {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      const u = p.age / p.life;
      p.vy += p.gravity * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      if (p.isRing) {
        const s = p.baseScale * (0.55 + u * 1.9);
        p.mesh.scale.setScalar(s);
        p.mat.opacity = (1 - u) * 0.78;
      } else {
        p.mesh.rotation.x += p.spinX * dt;
        p.mesh.rotation.y += p.spinY * dt;
        const s = p.baseScale * (1 - u * 0.65);
        p.mesh.scale.setScalar(Math.max(0.05, s));
        p.mat.opacity = u < 0.25 ? 0.95 : (1 - (u - 0.25) / 0.75) * 0.95;
      }
    }
  };

  // --- Soft Semi-Transparent Circular Ground Shadow Blob ---
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getSoftShadowBlobTexture(),
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadowDisk = new THREE.Mesh(new THREE.CircleGeometry(0.46, 28), shadowMat);
  shadowDisk.rotation.x = -Math.PI / 2;
  shadowDisk.position.y = 0.015;
  group.add(shadowDisk);

  // Floating 3D Emote Speech Bubble Sprite (above nametag)
  const emoteMat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: false,
  });
  const emoteSprite = new THREE.Sprite(emoteMat);
  emoteSprite.position.set(0, 2.46, 0);
  emoteSprite.scale.set(2.05, 0.62, 1);
  emoteSprite.visible = false;
  group.add(emoteSprite);

  // Animation state tracking
  const EMOTE_TOTAL_DURATION = 2.9;
  const EMOTE_FADE_DURATION = 0.25;

  let walkPhase = 0;
  let idleTime = Math.random() * 10;
  let currentAngle = 0;
  let emoteRemaining = 0;
  let emoteElapsed = 0;
  let activeEmoteId: EmoteId = 'hello';
  let lastClapBeat = -1;
  let jumpBurst1Fired = false;
  let jumpBurst2Fired = false;
  let currentHopY = 0;

  const triggerEmote = (emojiOrId: string, text?: string, explicitId?: EmoteId) => {
    const resolvedId = resolveEmoteId(emojiOrId, text, explicitId);
    const defaults = EMOTE_DEFAULTS[resolvedId];
    const displayEmoji =
      emojiOrId === 'hello' ||
      emojiOrId === 'clap' ||
      emojiOrId === 'think' ||
      emojiOrId === 'voted'
        ? defaults.emoji
        : emojiOrId || defaults.emoji;
    const displayText = text && text.trim() ? text.trim() : defaults.text;

    const prevMap = emoteMat.map;
    const nextMap = createEmoteBubbleTexture(displayEmoji, displayText);
    emoteMat.map = nextMap;
    emoteMat.needsUpdate = true;
    if (prevMap) {
      prevMap.dispose();
    }
    emoteSprite.visible = true;
    activeEmoteId = resolvedId;
    emoteRemaining = EMOTE_TOTAL_DURATION;
    emoteElapsed = 0;
    lastClapBeat = -1;
    jumpBurst1Fired = false;
    jumpBurst2Fired = false;
  };

  const update = (isMoving: boolean, dt: number, speed: number) => {
    const clampedDt = Math.min(Math.max(dt, 0.0001), 0.05);
    const smooth = 1 - Math.exp(-12 * clampedDt);
    const snappy = 1 - Math.exp(-20 * clampedDt);

    idleTime += clampedDt;
    updateParticles(clampedDt);

    // Update emote timer
    if (emoteRemaining > 0) {
      emoteRemaining -= clampedDt;
      emoteElapsed += clampedDt;
      if (emoteRemaining <= 0) {
        emoteRemaining = 0;
        emoteSprite.visible = false;
      }
    }

    // Subtle alive Idle baseline targets (always computed so emote ease-in-out blends seamlessly)
    const breathe = Math.sin(idleTime * 2.1);
    const idleArmSway = Math.sin(idleTime * 1.65);

    let tHopY = 0;
    let tRigRotY = 0;
    let tScaleX = 1 - breathe * 0.007;
    let tScaleY = 1 + breathe * 0.012;
    let tScaleZ = 1 - breathe * 0.007;

    let tTorsoY = TORSO_BASE_Y + breathe * 0.015;
    let tTorsoRotX = 0;
    let tTorsoRotY = 0;
    let tTorsoRotZ = 0;

    let tHeadRotX = breathe * 0.02;
    let tHeadRotY = 0;
    let tHeadRotZ = Math.sin(idleTime * 1.1) * 0.02;

    let tLeftArmX = LEFT_SHOULDER_BASE_X;
    let tLeftArmY = SHOULDER_BASE_Y;
    let tLeftArmZ = SHOULDER_BASE_Z;
    let tLeftArmRotX = 0.03 + idleArmSway * 0.035;
    let tLeftArmRotY = 0;
    let tLeftArmRotZ = -0.075 + idleArmSway * 0.025;
    let tLeftElbowRotX = -0.14;
    let tLeftElbowRotY = 0;
    let tLeftElbowRotZ = 0.04;

    let tRightArmX = RIGHT_SHOULDER_BASE_X;
    let tRightArmY = SHOULDER_BASE_Y;
    let tRightArmZ = SHOULDER_BASE_Z;
    let tRightArmRotX = 0.03 - idleArmSway * 0.035;
    let tRightArmRotY = 0;
    let tRightArmRotZ = 0.075 - idleArmSway * 0.025;
    let tRightElbowRotX = -0.14;
    let tRightElbowRotY = 0;
    let tRightElbowRotZ = -0.04;

    let tLeftLegRotX = 0;
    let tRightLegRotX = 0;
    let useFastArmLerp = false;

    const isPlayingBodyEmote = emoteRemaining > 0 && !isMoving && type !== 'npc';

    if (isMoving) {
      // Immediately clear body emote spin/offset when user starts walking
      walkPhase += clampedDt * (speed > 0 ? speed * 7.8 : 7.2);
      const stride = Math.sin(walkPhase);
      const stepBounce = Math.abs(Math.sin(walkPhase));

      tHopY = stepBounce * 0.032;
      // Gentle bouncy clay squash & stretch synchronized to footsteps
      tScaleY = 1 + (stepBounce - 0.45) * 0.06;
      tScaleX = 1 - (stepBounce - 0.45) * 0.035;
      tScaleZ = tScaleX;

      // Legs swing briskly
      tLeftLegRotX = stride * 0.58;
      tRightLegRotX = -stride * 0.58;

      // Charming clay waddle + slight forward momentum lean + torso counter-twist
      tTorsoY = TORSO_BASE_Y + stepBounce * 0.028;
      tTorsoRotX = 0.06;
      tTorsoRotY = -stride * 0.095;
      tTorsoRotZ = stride * 0.075;

      // Head gently counter-stabilizes
      tHeadRotX = -0.03;
      tHeadRotY = stride * 0.08;
      tHeadRotZ = -stride * 0.04;

      // Arms cross-swing naturally with bent elbows (deeper bend on forward swing)
      tLeftArmRotX = -stride * 0.52;
      tLeftArmRotZ = -0.09;
      tLeftElbowRotX = -0.32 - Math.max(0, stride) * 0.38;
      tLeftElbowRotZ = 0.06;

      tRightArmRotX = stride * 0.52;
      tRightArmRotZ = 0.09;
      tRightElbowRotX = -0.32 - Math.max(0, -stride) * 0.38;
      tRightElbowRotZ = -0.06;
    } else if (isPlayingBodyEmote) {
      const t = emoteElapsed;
      // Smooth 0.25s ease-in & 0.25s ease-out envelope
      const enterW = smoothStep(t / EMOTE_FADE_DURATION);
      const exitW = smoothStep(emoteRemaining / EMOTE_FADE_DURATION);
      const w = enterW * exitW;

      if (activeEmoteId === 'hello') {
        // a) [😊 반가워요]: Polite gentle bow, raised shoulder, 65~72° bent elbow waving smoothly + phase-lag head tilt
        const bowArc = t < 0.9 ? Math.sin((t / 0.9) * Math.PI) : 0;
        const waveOsc = Math.sin(t * 11.5);
        const headLagOsc = Math.sin(t * 11.5 - 0.85);
        const bounce = Math.abs(Math.sin(t * 5.2));

        tHopY = bounce * 0.042 * w;
        tScaleY = 1 + (bounce - 0.35) * 0.045 * w;
        tScaleX = 1 - (bounce - 0.35) * 0.025 * w;
        tScaleZ = tScaleX;

        tTorsoY = TORSO_BASE_Y + bounce * 0.022 * w;
        tTorsoRotX = bowArc * 0.17 * w;
        tTorsoRotY = -0.08 * w;
        tTorsoRotZ = headLagOsc * 0.045 * w;

        // Head tilts warmly with subtle phase lag behind hand wave
        tHeadRotX = (bowArc * 0.12 - 0.03) * w;
        tHeadRotY = Math.sin(t * 3.6) * 0.1 * w;
        tHeadRotZ = headLagOsc * 0.15 * w;

        // Left arm softly relaxed & balanced
        tLeftArmRotX = THREE.MathUtils.lerp(tLeftArmRotX, 0.08, w);
        tLeftArmRotZ = THREE.MathUtils.lerp(tLeftArmRotZ, -0.18, w);
        tLeftElbowRotX = THREE.MathUtils.lerp(tLeftElbowRotX, -0.26, w);
        tLeftElbowRotZ = THREE.MathUtils.lerp(tLeftElbowRotZ, 0.08, w);

        // Right arm raised cleanly & elbow bent ~65~72° waving forearm/hand cheerfully
        tRightArmX = THREE.MathUtils.lerp(RIGHT_SHOULDER_BASE_X, RIGHT_SHOULDER_BASE_X + 0.015, w);
        tRightArmY = THREE.MathUtils.lerp(SHOULDER_BASE_Y, SHOULDER_BASE_Y + 0.025, w);
        tRightArmZ = THREE.MathUtils.lerp(SHOULDER_BASE_Z, 0.045, w);
        tRightArmRotX = THREE.MathUtils.lerp(tRightArmRotX, -0.34, w);
        tRightArmRotZ = THREE.MathUtils.lerp(tRightArmRotZ, 1.94 + waveOsc * 0.09, w);
        tRightElbowRotX = THREE.MathUtils.lerp(tRightElbowRotX, -0.22, w);
        // Elbow ~66° (1.15 rad) bent with breezy ±22° forearm wave
        tRightElbowRotZ = THREE.MathUtils.lerp(tRightElbowRotZ, 1.15 + waveOsc * 0.38, w);
      } else if (activeEmoteId === 'clap') {
        // b) [👏 박수]: Synced 0.16s clap rhythm, shoulders pulled inward/forward,
        //    both elbows deeply folded ~90° so hands physically meet at chest center + sparkle burst!
        useFastArmLerp = true;
        const beatInterval = 0.16;
        // Continuous energetic clap cadence during active window (6 primary claps + light encore)
        const inActiveClap = t >= 0.06 && t <= 2.35;
        const beatPos = Math.max(0, (t - 0.06) / beatInterval);
        const beatIdx = Math.floor(beatPos);
        const beatFrac = beatPos - beatIdx;

        // Sharp contact impulse around beatFrac ≈ 0.55 so hands meet crisply then rebound open
        const rawWave = inActiveClap ? Math.pow(Math.max(0, Math.sin(beatFrac * Math.PI)), 1.55) : 0;
        const clapClose = rawWave; // 1 = hands touching at center, 0 = hands open apart

        // Trigger pastel 3D sparkle/ring micro-particles right at each hand impact!
        if (inActiveClap && beatFrac >= 0.48 && beatIdx !== lastClapBeat && beatIdx < 10) {
          lastClapBeat = beatIdx;
          spawnClapSparkleBurst();
        }

        // Rhythmic shoulder & head perk-up on every clap contact
        const impactBounce = clapClose * 0.028 * w;
        tTorsoY = TORSO_BASE_Y + impactBounce;
        tTorsoRotX = (0.045 + clapClose * 0.05) * w;
        tScaleY = 1 + (clapClose * 0.045 - 0.015) * w;
        tScaleX = 1 - (clapClose * 0.025 - 0.01) * w;
        tScaleZ = tScaleX;

        tHeadRotX = (0.04 + clapClose * 0.13) * w;
        tHeadRotZ = Math.sin(t * 6.5) * 0.065 * w;

        // Pull both shoulders slightly inward (±x) & forward (+z) so forearms comfortably cross chest
        tLeftArmX = THREE.MathUtils.lerp(LEFT_SHOULDER_BASE_X, -0.192, w);
        tLeftArmY = THREE.MathUtils.lerp(SHOULDER_BASE_Y, SHOULDER_BASE_Y + clapClose * 0.014, w);
        tLeftArmZ = THREE.MathUtils.lerp(SHOULDER_BASE_Z, 0.072, w);

        tRightArmX = THREE.MathUtils.lerp(RIGHT_SHOULDER_BASE_X, 0.192, w);
        tRightArmY = THREE.MathUtils.lerp(SHOULDER_BASE_Y, SHOULDER_BASE_Y + clapClose * 0.014, w);
        tRightArmZ = THREE.MathUtils.lerp(SHOULDER_BASE_Z, 0.072, w);

        // Upper arms angled forward; open -> closed sweep
        tLeftArmRotX = THREE.MathUtils.lerp(tLeftArmRotX, -0.94, w);
        tLeftArmRotZ = THREE.MathUtils.lerp(tLeftArmRotZ, -0.28 + clapClose * 0.18, w);
        // Elbow folded deeply inward ~89° (1.56 rad) at impact, opening to ~50° (0.86 rad)
        tLeftElbowRotX = THREE.MathUtils.lerp(tLeftElbowRotX, -0.18, w);
        tLeftElbowRotY = THREE.MathUtils.lerp(tLeftElbowRotY, -0.44 * (0.65 + 0.35 * clapClose), w);
        tLeftElbowRotZ = THREE.MathUtils.lerp(tLeftElbowRotZ, 0.86 + clapClose * 0.70, w);

        tRightArmRotX = THREE.MathUtils.lerp(tRightArmRotX, -0.94, w);
        tRightArmRotZ = THREE.MathUtils.lerp(tRightArmRotZ, 0.28 - clapClose * 0.18, w);
        tRightElbowRotX = THREE.MathUtils.lerp(tRightElbowRotX, -0.18, w);
        tRightElbowRotY = THREE.MathUtils.lerp(tRightElbowRotY, 0.44 * (0.65 + 0.35 * clapClose), w);
        tRightElbowRotZ = THREE.MathUtils.lerp(tRightElbowRotZ, -0.86 - clapClose * 0.70, w);
      } else if (activeEmoteId === 'think') {
        // c) [🤔 신중고민]: Shifted weight, slight torso twist, left hand on hip,
        //    right shoulder raised + right elbow deeply bent so rightHand rests directly under chin!
        const ponderWave = Math.sin(t * 2.1);
        const ponderCos = Math.cos(t * 1.75);

        tTorsoY = TORSO_BASE_Y + Math.sin(t * 1.9) * 0.01 * w;
        tTorsoRotX = 0.06 * w;
        tTorsoRotY = -0.13 * w;
        tTorsoRotZ = (-0.07 + ponderWave * 0.025) * w;

        // Thoughtful slow head sway while keeping chin nestled onto right hand
        tHeadRotX = (-0.03 + Math.sin(t * 2.0) * 0.035) * w;
        tHeadRotY = ponderCos * 0.15 * w;
        tHeadRotZ = (0.06 + ponderWave * 0.14) * w;

        // Left arm folded naturally onto waist/hip
        tLeftArmX = THREE.MathUtils.lerp(LEFT_SHOULDER_BASE_X, -0.225, w);
        tLeftArmZ = THREE.MathUtils.lerp(SHOULDER_BASE_Z, 0.02, w);
        tLeftArmRotX = THREE.MathUtils.lerp(tLeftArmRotX, -0.16, w);
        tLeftArmRotZ = THREE.MathUtils.lerp(tLeftArmRotZ, -0.54, w);
        tLeftElbowRotX = THREE.MathUtils.lerp(tLeftElbowRotX, -0.24, w);
        tLeftElbowRotZ = THREE.MathUtils.lerp(tLeftElbowRotZ, 1.18, w);

        // Right arm raised & deeply bent so hand physically touches under the chin
        tRightArmX = THREE.MathUtils.lerp(RIGHT_SHOULDER_BASE_X, 0.198, w);
        tRightArmY = THREE.MathUtils.lerp(SHOULDER_BASE_Y, SHOULDER_BASE_Y + 0.015, w);
        tRightArmZ = THREE.MathUtils.lerp(SHOULDER_BASE_Z, 0.052, w);
        tRightArmRotX = THREE.MathUtils.lerp(tRightArmRotX, -1.16, w);
        tRightArmRotZ = THREE.MathUtils.lerp(tRightArmRotZ, -0.18, w);
        tRightElbowRotX = THREE.MathUtils.lerp(tRightElbowRotX, -1.94 + ponderWave * 0.05, w);
        tRightElbowRotZ = THREE.MathUtils.lerp(tRightElbowRotZ, -0.78, w);

        // Slight relaxed weight shift in legs
        tLeftLegRotX = 0.06 * w;
        tRightLegRotX = -0.05 * w;
      } else {
        // d) [🗳️ 투표완료!]: 0.2s anticipation crouch (squash) -> 2 elastic 360° V-hurrah jumps
        //    with airborne stretch, juicy landing squash, and apex 3D confetti bursts!
        useFastArmLerp = true;

        const ANTICIPATION_END = 0.2;
        const J1_START = 0.2;
        const J1_END = 1.15;
        const LAND1_END = 1.28;
        const J2_START = 1.28;
        const J2_END = 2.22;
        const LAND2_END = 2.44;

        if (t < ANTICIPATION_END) {
          // Phase 1: 0.2s elastic crouch anticipation (scale.y = 0.86, scale.xz = 1.10)
          const u = smoothStep(t / ANTICIPATION_END);
          tHopY = 0;
          tScaleY = THREE.MathUtils.lerp(1, 0.86, u);
          tScaleX = THREE.MathUtils.lerp(1, 1.1, u);
          tScaleZ = tScaleX;
          tTorsoRotX = 0.2 * u;
          tHeadRotX = -0.12 * u;

          // Pull arms back & bend elbows to coil energy for the jump
          tLeftArmRotX = 0.45 * u;
          tLeftArmRotZ = -0.26 * u;
          tLeftElbowRotX = -0.85 * u;
          tRightArmRotX = 0.45 * u;
          tRightArmRotZ = 0.26 * u;
          tRightElbowRotX = -0.85 * u;
          tLeftLegRotX = -0.24 * u;
          tRightLegRotX = -0.24 * u;
        } else if (t < J1_END) {
          // Jump 1: Stretch + V-hurrah arms + smooth 360° spin + apex confetti burst
          const u = (t - J1_START) / (J1_END - J1_START);
          const arc = Math.sin(u * Math.PI);
          tHopY = arc * 0.48;

          const stretch = Math.sin(u * Math.PI);
          tScaleY = 1 + stretch * 0.12;
          tScaleX = 1 - stretch * 0.08;
          tScaleZ = tScaleX;

          tRigRotY = smoothStep(u) * Math.PI * 2;
          tTorsoRotX = -0.09 * arc;
          tHeadRotX = -0.15 * arc;
          tHeadRotZ = Math.sin(u * Math.PI * 2) * 0.09;

          // Wide joyful V-arms with elbows open
          tLeftArmRotX = -2.78;
          tLeftArmRotZ = -0.45;
          tLeftElbowRotX = -0.06;
          tLeftElbowRotZ = 0.06;

          tRightArmRotX = -2.78;
          tRightArmRotZ = 0.45;
          tRightElbowRotX = -0.06;
          tRightElbowRotZ = -0.06;

          const kick = Math.sin(u * Math.PI * 3) * 0.42;
          tLeftLegRotX = kick;
          tRightLegRotX = -kick;

          if (u >= 0.44 && !jumpBurst1Fired) {
            jumpBurst1Fired = true;
            spawnJumpConfettiBurst(1.45);
          }
        } else if (t < LAND1_END) {
          // Juicy clay squash on first landing before second springy jump
          const u = (t - J1_END) / (LAND1_END - J1_END);
          const sq = Math.sin(u * Math.PI);
          tHopY = 0;
          tRigRotY = Math.PI * 2;
          tScaleY = 1 - sq * 0.14; // dips to 0.86
          tScaleX = 1 + sq * 0.1; // bulges to 1.10
          tScaleZ = tScaleX;
          tTorsoRotX = 0.16 * sq;

          tLeftArmRotX = -1.6;
          tLeftArmRotZ = -0.42;
          tLeftElbowRotX = -0.55;
          tRightArmRotX = -1.6;
          tRightArmRotZ = 0.42;
          tRightElbowRotX = -0.55;
        } else if (t < J2_END) {
          // Jump 2: Second elastic 360° V-hurrah jump + second apex confetti burst
          const u = (t - J2_START) / (J2_END - J2_START);
          const arc = Math.sin(u * Math.PI);
          tHopY = arc * 0.44;

          const stretch = Math.sin(u * Math.PI);
          tScaleY = 1 + stretch * 0.12;
          tScaleX = 1 - stretch * 0.08;
          tScaleZ = tScaleX;

          tRigRotY = Math.PI * 2 + smoothStep(u) * Math.PI * 2;
          tTorsoRotX = -0.08 * arc;
          tHeadRotX = -0.14 * arc;
          tHeadRotZ = Math.sin(u * Math.PI * 2) * 0.08;

          tLeftArmRotX = -2.76;
          tLeftArmRotZ = -0.46;
          tLeftElbowRotX = -0.06;
          tLeftElbowRotZ = 0.06;

          tRightArmRotX = -2.76;
          tRightArmRotZ = 0.46;
          tRightElbowRotX = -0.06;
          tRightElbowRotZ = -0.06;

          const kick = Math.sin(u * Math.PI * 3) * 0.38;
          tLeftLegRotX = -kick;
          tRightLegRotX = kick;

          if (u >= 0.44 && !jumpBurst2Fired) {
            jumpBurst2Fired = true;
            spawnJumpConfettiBurst(1.42);
          }
        } else if (t < LAND2_END) {
          // Soft elastic landing cushion & triumphant V-pose hold fading out cleanly
          const u = (t - J2_END) / (LAND2_END - J2_END);
          const sq = Math.sin(u * Math.PI);
          tHopY = 0;
          tRigRotY = Math.PI * 4;
          tScaleY = 1 - sq * 0.12;
          tScaleX = 1 + sq * 0.085;
          tScaleZ = tScaleX;
          tTorsoRotX = 0.1 * sq;

          tLeftArmRotX = THREE.MathUtils.lerp(-2.5, tLeftArmRotX, u * 0.5);
          tLeftArmRotZ = THREE.MathUtils.lerp(-0.4, tLeftArmRotZ, u * 0.5);
          tRightArmRotX = THREE.MathUtils.lerp(-2.5, tRightArmRotX, u * 0.5);
          tRightArmRotZ = THREE.MathUtils.lerp(0.4, tRightArmRotZ, u * 0.5);
        } else {
          // Final 0.25s+ gentle settle back to idle neutral
          tRigRotY = Math.PI * 4;
          tLeftArmRotX = THREE.MathUtils.lerp(tLeftArmRotX, -1.2, exitW * 0.5);
          tRightArmRotX = THREE.MathUtils.lerp(tRightArmRotX, -1.2, exitW * 0.5);
        }
      }
    } else if (type === 'npc') {
      // Friendly clay NPC waving gently behind the verification desk
      tLeftArmRotX = -0.18;
      tLeftArmRotZ = -0.1;
      tLeftElbowRotX = -0.35;

      tRightArmRotX = -0.35;
      tRightArmRotZ = 0.52;
      tRightElbowRotX = -0.55;
      tRightElbowRotZ = 0.35 + Math.sin(idleTime * 2.8) * 0.22;
      tHeadRotY = Math.sin(idleTime * 0.85) * 0.16;
      tHeadRotZ = Math.sin(idleTime * 1.4) * 0.05;
    }

    // Wrap rigGroup.rotation.y smoothly to nearest 0 when returning to idle/walk
    if (!isPlayingBodyEmote || activeEmoteId !== 'voted') {
      const wrapped = ((rigGroup.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      rigGroup.rotation.y = wrapped;
    }

    // Apply frame-independent smooth Lerp damping across ALL joints, offsets, & squash/stretch
    const armSmooth = useFastArmLerp ? snappy : smooth;

    currentHopY = THREE.MathUtils.lerp(currentHopY, tHopY, snappy);
    rigGroup.position.y = currentHopY;
    rigGroup.rotation.y = THREE.MathUtils.lerp(
      rigGroup.rotation.y,
      tRigRotY,
      activeEmoteId === 'voted' && isPlayingBodyEmote ? snappy : smooth
    );
    rigGroup.scale.set(
      THREE.MathUtils.lerp(rigGroup.scale.x, tScaleX, snappy),
      THREE.MathUtils.lerp(rigGroup.scale.y, tScaleY, snappy),
      THREE.MathUtils.lerp(rigGroup.scale.z, tScaleZ, snappy)
    );

    pelvisMesh.position.y = PELVIS_BASE_Y;
    leftLegPivot.position.y = LEG_PIVOT_BASE_Y;
    rightLegPivot.position.y = LEG_PIVOT_BASE_Y;
    leftLegPivot.rotation.x = THREE.MathUtils.lerp(leftLegPivot.rotation.x, tLeftLegRotX, smooth);
    rightLegPivot.rotation.x = THREE.MathUtils.lerp(rightLegPivot.rotation.x, tRightLegRotX, smooth);

    torsoGroup.position.y = THREE.MathUtils.lerp(torsoGroup.position.y, tTorsoY, smooth);
    torsoGroup.rotation.x = THREE.MathUtils.lerp(torsoGroup.rotation.x, tTorsoRotX, smooth);
    torsoGroup.rotation.y = THREE.MathUtils.lerp(torsoGroup.rotation.y, tTorsoRotY, smooth);
    torsoGroup.rotation.z = THREE.MathUtils.lerp(torsoGroup.rotation.z, tTorsoRotZ, smooth);

    headGroup.rotation.x = THREE.MathUtils.lerp(headGroup.rotation.x, tHeadRotX, smooth);
    headGroup.rotation.y = THREE.MathUtils.lerp(headGroup.rotation.y, tHeadRotY, smooth);
    headGroup.rotation.z = THREE.MathUtils.lerp(headGroup.rotation.z, tHeadRotZ, smooth);

    leftArm.position.x = THREE.MathUtils.lerp(leftArm.position.x, tLeftArmX, armSmooth);
    leftArm.position.y = THREE.MathUtils.lerp(leftArm.position.y, tLeftArmY, armSmooth);
    leftArm.position.z = THREE.MathUtils.lerp(leftArm.position.z, tLeftArmZ, armSmooth);
    leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, tLeftArmRotX, armSmooth);
    leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, tLeftArmRotY, armSmooth);
    leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, tLeftArmRotZ, armSmooth);

    leftElbow.rotation.x = THREE.MathUtils.lerp(leftElbow.rotation.x, tLeftElbowRotX, armSmooth);
    leftElbow.rotation.y = THREE.MathUtils.lerp(leftElbow.rotation.y, tLeftElbowRotY, armSmooth);
    leftElbow.rotation.z = THREE.MathUtils.lerp(leftElbow.rotation.z, tLeftElbowRotZ, armSmooth);

    rightArm.position.x = THREE.MathUtils.lerp(rightArm.position.x, tRightArmX, armSmooth);
    rightArm.position.y = THREE.MathUtils.lerp(rightArm.position.y, tRightArmY, armSmooth);
    rightArm.position.z = THREE.MathUtils.lerp(rightArm.position.z, tRightArmZ, armSmooth);
    rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, tRightArmRotX, armSmooth);
    rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, tRightArmRotY, armSmooth);
    rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, tRightArmRotZ, armSmooth);

    rightElbow.rotation.x = THREE.MathUtils.lerp(rightElbow.rotation.x, tRightElbowRotX, armSmooth);
    rightElbow.rotation.y = THREE.MathUtils.lerp(rightElbow.rotation.y, tRightElbowRotY, armSmooth);
    rightElbow.rotation.z = THREE.MathUtils.lerp(rightElbow.rotation.z, tRightElbowRotZ, armSmooth);

    // Ground shadow blob gently tightens when jumping for realistic miniature contact depth
    const shadowScale = Math.max(0.62, 1.0 - currentHopY * 0.55);
    shadowDisk.scale.set(shadowScale, shadowScale, 1);
    shadowMat.opacity = Math.max(0.42, 0.95 - currentHopY * 0.85);

    if (emoteSprite.visible) {
      emoteSprite.position.y = 2.46 + currentHopY + Math.sin(emoteElapsed * 4.5) * 0.05;
    }
  };

  const lookAtAngle = (angle: number) => {
    currentAngle = angle;
    group.rotation.y = currentAngle;
  };

  return {
    group,
    update,
    lookAtAngle,
    triggerEmote,
    type,
  };
}

/**
 * Creates a soft rounded pill-shaped 3D billboard name tag sprite above the clay figure's head
 */
export function createNameTagSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 76;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const x = 10;
    const y = 10;
    const w = canvas.width - 20;
    const h = canvas.height - 20;
    const r = h / 2;

    ctx.save();
    ctx.shadowColor = 'rgba(72, 52, 36, 0.22)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    ctx.fillStyle = 'rgba(255, 250, 242, 0.92)';
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(196, 165, 134, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#3b2b22';
    ctx.font =
      'bold 26px "Pretendard", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const trimmed = name.length > 14 ? `${name.slice(0, 14)}…` : name;
    ctx.fillText(trimmed, canvas.width / 2, canvas.height / 2 + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(0, 1.9, 0);
  sprite.scale.set(1.52, 0.36, 1);
  return sprite;
}
