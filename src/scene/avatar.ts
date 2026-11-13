import * as THREE from 'three';
import { AvatarType } from '../types';

export interface CharacterController {
  group: THREE.Group;
  update: (isMoving: boolean, dt: number, speed: number) => void;
  lookAtAngle: (angle: number) => void;
  type: AvatarType | 'npc';
}

export function createProceduralAvatar(type: AvatarType | 'npc'): CharacterController {
  const group = new THREE.Group();
  group.name = `avatar_${type}`;

  // Shared reusable materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffdfc4,
    roughness: 0.65,
    metalness: 0.05,
  });

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x1a202c,
    roughness: 0.2,
    metalness: 0.1,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    roughness: 0.35,
    metalness: 0.2,
  });

  const slacksMat = new THREE.MeshStandardMaterial({
    color: 0x1f293d, // dark navy/charcoal slacks
    roughness: 0.8,
    metalness: 0.05,
  });

  // Clothing & hair configuration based on avatar type
  let topMat: THREE.MeshStandardMaterial;
  let hairMat: THREE.MeshStandardMaterial;

  if (type === 'male') {
    // Option A: Adult Male (Navy shirt, dark slacks, clean short hair)
    topMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // crisp deep navy shirt
      roughness: 0.6,
      metalness: 0.08,
    });
    hairMat = new THREE.MeshStandardMaterial({
      color: 0x221f1e, // dark brown/black neat hair
      roughness: 0.7,
      metalness: 0.05,
    });
  } else if (type === 'female') {
    // Option B: Adult Female (Beige knit, dark slacks, stylish bob hair)
    topMat = new THREE.MeshStandardMaterial({
      color: 0xd6bba2, // warm beige / oatmeal knit
      roughness: 0.85,
      metalness: 0.02,
    });
    hairMat = new THREE.MeshStandardMaterial({
      color: 0x3d271d, // rich chestnut dark brown bob
      roughness: 0.65,
      metalness: 0.05,
    });
  } else {
    // NPC Desk Officer (sky blue election official vest over white shirt)
    topMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Korean election official bright blue
      roughness: 0.7,
      metalness: 0.05,
    });
    hairMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.7,
      metalness: 0.05,
    });
  }

  // --- Pelvis / Hips ---
  const pelvisGeo = new THREE.BoxGeometry(0.38, 0.16, 0.24);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, slacksMat);
  pelvisMesh.position.y = 0.74;
  pelvisMesh.castShadow = true;
  pelvisMesh.receiveShadow = true;
  group.add(pelvisMesh);

  // --- Legs ---
  const legGeo = new THREE.BoxGeometry(0.14, 0.66, 0.16);
  const shoeGeo = new THREE.BoxGeometry(0.15, 0.1, 0.24);

  // Left Leg Pivot
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12, 0.7, 0);

  const leftLeg = new THREE.Mesh(legGeo, slacksMat);
  leftLeg.position.y = -0.33;
  leftLeg.castShadow = true;
  leftLeg.receiveShadow = true;
  leftLegPivot.add(leftLeg);

  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(0, -0.66, 0.04);
  leftShoe.castShadow = true;
  leftLegPivot.add(leftShoe);

  group.add(leftLegPivot);

  // Right Leg Pivot
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12, 0.7, 0);

  const rightLeg = new THREE.Mesh(legGeo, slacksMat);
  rightLeg.position.y = -0.33;
  rightLeg.castShadow = true;
  rightLeg.receiveShadow = true;
  rightLegPivot.add(rightLeg);

  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
  rightShoe.position.set(0, -0.66, 0.04);
  rightShoe.castShadow = true;
  rightLegPivot.add(rightShoe);

  group.add(rightLegPivot);

  // --- Torso & Upper Body Pivot (for vertical bobbing) ---
  const upperBody = new THREE.Group();
  upperBody.position.y = 0.74;
  group.add(upperBody);

  // Torso Mesh
  const torsoGeo = new THREE.BoxGeometry(0.42, 0.48, 0.26);
  const torsoMesh = new THREE.Mesh(torsoGeo, topMat);
  torsoMesh.position.y = 0.24;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  upperBody.add(torsoMesh);

  // Collar / neck accent
  if (type === 'male') {
    const collarGeo = new THREE.BoxGeometry(0.22, 0.06, 0.24);
    const collarMesh = new THREE.Mesh(collarGeo, topMat);
    collarMesh.position.set(0, 0.49, 0.02);
    upperBody.add(collarMesh);

    // Subtle button placket
    const placketGeo = new THREE.BoxGeometry(0.04, 0.44, 0.01);
    const placketMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.5 });
    const placket = new THREE.Mesh(placketGeo, placketMat);
    placket.position.set(0, 0.24, 0.135);
    upperBody.add(placket);
  } else if (type === 'female') {
    const knitCollarGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.06, 12);
    const knitCollar = new THREE.Mesh(knitCollarGeo, topMat);
    knitCollar.position.set(0, 0.48, 0);
    upperBody.add(knitCollar);
  } else {
    // NPC official lanyard badge
    const badgeGeo = new THREE.BoxGeometry(0.1, 0.14, 0.02);
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0.08, 0.22, 0.14);
    upperBody.add(badge);

    const stringGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.22);
    const stringMat = new THREE.MeshBasicMaterial({ color: 0x0369a1 });
    const string = new THREE.Mesh(stringGeo, stringMat);
    string.rotation.z = -0.3;
    string.position.set(0.04, 0.34, 0.135);
    upperBody.add(string);
  }

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.1, 10);
  const neckMesh = new THREE.Mesh(neckGeo, skinMat);
  neckMesh.position.y = 0.51;
  upperBody.add(neckMesh);

  // Head Group
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.72;
  upperBody.add(headGroup);

  // Head Base
  const headGeo = new THREE.BoxGeometry(0.3, 0.32, 0.28);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.02);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.08, 0.02, 0.145);
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  rightEye.position.set(0.08, 0.02, 0.145);
  headGroup.add(rightEye);

  // Nose (cute low-poly)
  const noseGeo = new THREE.BoxGeometry(0.035, 0.045, 0.03);
  const noseMesh = new THREE.Mesh(noseGeo, skinMat);
  noseMesh.position.set(0, -0.02, 0.15);
  headGroup.add(noseMesh);

  // Hair Styling
  if (type === 'male' || type === 'npc') {
    // Short neat cut with side parting
    const hairTopGeo = new THREE.BoxGeometry(0.32, 0.1, 0.3);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.16, -0.01);
    headGroup.add(hairTop);

    const hairBackGeo = new THREE.BoxGeometry(0.32, 0.2, 0.08);
    const hairBack = new THREE.Mesh(hairBackGeo, hairMat);
    hairBack.position.set(0, 0.05, -0.12);
    headGroup.add(hairBack);

    const hairSideLeftGeo = new THREE.BoxGeometry(0.04, 0.18, 0.24);
    const hairSideLeft = new THREE.Mesh(hairSideLeftGeo, hairMat);
    hairSideLeft.position.set(-0.15, 0.06, 0);
    headGroup.add(hairSideLeft);

    const hairSideRightGeo = new THREE.BoxGeometry(0.04, 0.18, 0.24);
    const hairSideRight = new THREE.Mesh(hairSideRightGeo, hairMat);
    hairSideRight.position.set(0.15, 0.06, 0);
    headGroup.add(hairSideRight);
  } else {
    // Female: Stylish neat bob hair framing cheeks with rounded volume
    const hairTopGeo = new THREE.BoxGeometry(0.34, 0.12, 0.32);
    const hairTop = new THREE.Mesh(hairTopGeo, hairMat);
    hairTop.position.set(0, 0.16, 0);
    headGroup.add(hairTop);

    // Bob bangs
    const bangsGeo = new THREE.BoxGeometry(0.32, 0.08, 0.06);
    const bangs = new THREE.Mesh(bangsGeo, hairMat);
    bangs.position.set(0, 0.12, 0.13);
    headGroup.add(bangs);

    // Left bob curtain
    const leftBobGeo = new THREE.BoxGeometry(0.06, 0.32, 0.3);
    const leftBob = new THREE.Mesh(leftBobGeo, hairMat);
    leftBob.position.set(-0.16, -0.01, 0);
    headGroup.add(leftBob);

    // Right bob curtain
    const rightBobGeo = new THREE.BoxGeometry(0.06, 0.32, 0.3);
    const rightBob = new THREE.Mesh(rightBobGeo, hairMat);
    rightBob.position.set(0.16, -0.01, 0);
    headGroup.add(rightBob);

    // Back hair
    const backBobGeo = new THREE.BoxGeometry(0.34, 0.32, 0.08);
    const backBob = new THREE.Mesh(backBobGeo, hairMat);
    backBob.position.set(0, -0.01, -0.13);
    headGroup.add(backBob);
  }

  // --- Arms ---
  const armGeo = new THREE.BoxGeometry(0.11, 0.52, 0.12);
  const handGeo = new THREE.BoxGeometry(0.09, 0.11, 0.09);

  // Left Arm
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.28, 0.44, 0);

  const leftArm = new THREE.Mesh(armGeo, topMat);
  leftArm.position.y = -0.22;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);

  const leftHand = new THREE.Mesh(handGeo, skinMat);
  leftHand.position.y = -0.5;
  leftArmPivot.add(leftHand);

  upperBody.add(leftArmPivot);

  // Right Arm
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.28, 0.44, 0);

  const rightArm = new THREE.Mesh(armGeo, topMat);
  rightArm.position.y = -0.22;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);

  const rightHand = new THREE.Mesh(handGeo, skinMat);
  rightHand.position.y = -0.5;
  rightArmPivot.add(rightHand);

  upperBody.add(rightArmPivot);

  // Subtle contact shadow disk beneath avatar
  const shadowGeo = new THREE.CircleGeometry(0.4, 16);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const shadowDisk = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisk.rotation.x = -Math.PI / 2;
  shadowDisk.position.y = 0.015;
  group.add(shadowDisk);

  // Animation state tracking
  let walkPhase = 0;
  let idleTime = Math.random() * 10;
  let currentAngle = 0;

  const update = (isMoving: boolean, dt: number, speed: number) => {
    idleTime += dt;

    if (isMoving) {
      walkPhase += dt * (speed > 0 ? speed * 7.5 : 7.0);

      // Limbs swing back and forth smoothly
      const legAngle = Math.sin(walkPhase) * 0.55;
      leftLegPivot.rotation.x = legAngle;
      rightLegPivot.rotation.x = -legAngle;

      const armAngle = Math.sin(walkPhase) * 0.45;
      leftArmPivot.rotation.x = -armAngle;
      rightArmPivot.rotation.x = armAngle;

      // Vertical bounce on each step
      upperBody.position.y = 0.74 + Math.abs(Math.sin(walkPhase * 2)) * 0.035;
      headGroup.rotation.y = Math.sin(walkPhase) * 0.06;
    } else {
      // Idle relaxation
      leftLegPivot.rotation.x = THREE.MathUtils.damp(leftLegPivot.rotation.x, 0, 10, dt);
      rightLegPivot.rotation.x = THREE.MathUtils.damp(rightLegPivot.rotation.x, 0, 10, dt);

      // If NPC, gentle welcoming posture
      if (type === 'npc') {
        leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, -0.2, 5, dt);
        rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, -0.4 + Math.sin(idleTime * 2.5) * 0.1, 5, dt);
        headGroup.rotation.y = Math.sin(idleTime * 0.8) * 0.15;
      } else {
        leftArmPivot.rotation.x = THREE.MathUtils.damp(leftArmPivot.rotation.x, 0, 10, dt);
        rightArmPivot.rotation.x = THREE.MathUtils.damp(rightArmPivot.rotation.x, 0, 10, dt);
        headGroup.rotation.y = THREE.MathUtils.damp(headGroup.rotation.y, 0, 10, dt);
      }

      // Subtle breathing
      upperBody.position.y = 0.74 + Math.sin(idleTime * 2) * 0.008;
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
    type,
  };
}

/**
 * Creates a floating 3D billboard name tag sprite above the avatar's head
 */
export function createNameTagSprite(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.clearRect(0, 0, 256, 64);

    // Dark sleek pill background with subtle sky/cyan border
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
    ctx.lineWidth = 3;

    const r = 18;
    const x = 6;
    const y = 6;
    const w = 244;
    const h = 52;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crisp white Korean typography
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 33);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(spriteMat);
  sprite.position.set(0, 2.05, 0);
  sprite.scale.set(1.4, 0.35, 1);
  return sprite;
}

