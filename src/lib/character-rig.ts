/**
 * Helpers shared by the 3D characters (landing page + login/sign-up).
 */
import * as THREE from 'three';

export const HD_MODEL = '/human.glb';    // 2K textures (~1.2 MB)
export const UHD_MODEL = '/human-4k.glb'; // 4K textures (~2.3 MB, ~300 MB GPU memory)

/**
 * Picks the 4K model for desktop-class screens and the HD model for phones /
 * tablets / low-memory devices, where 4K textures can run out of GPU memory.
 * Only call in the browser.
 */
export function pickCharacterModel(): string {
  if (typeof window === 'undefined') return HD_MODEL;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const desktop = window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches;
  return desktop && memory >= 4 ? UHD_MODEL : HD_MODEL;
}

export function findBone(root: THREE.Object3D, name: string) {
  // GLTFLoader strips ':' from node names ("mixamorig:Head" -> "mixamorigHead").
  return (root.getObjectByName(`mixamorig${name}`) || root.getObjectByName(`mixamorig:${name}`)) as THREE.Bone | undefined;
}

interface ArmChain { arm: THREE.Bone; points: THREE.Bone[] }
export interface HeadClearanceRig { head: THREE.Bone; headTop: THREE.Bone; arms: ArmChain[] }

export function getHeadClearanceRig(root: THREE.Object3D): HeadClearanceRig | null {
  const head = findBone(root, 'Head');
  const headTop = findBone(root, 'HeadTop_End');
  if (!head || !headTop) return null;
  const arms: ArmChain[] = [];
  for (const side of ['Left', 'Right']) {
    const arm = findBone(root, `${side}Arm`);
    const points = ['Hand', 'HandMiddle2', 'HandMiddle3', 'HandIndex3', 'HandThumb3']
      .map((n) => findBone(root, `${side}${n}`))
      .filter((b): b is THREE.Bone => !!b);
    if (arm && points.length) arms.push({ arm, points });
  }
  return { head, headTop, arms };
}

const _center = new THREE.Vector3();
const _top = new THREE.Vector3();
const _p = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _qWorld = new THREE.Quaternion();
const _qParent = new THREE.Quaternion();
const _qArm = new THREE.Quaternion();

/**
 * Stops the hands from sinking into the head (the idle animation scratches the
 * head, and head-turning can rotate the head into the hand). Call every frame
 * after the animation and any head tweaks. If a hand/finger point is inside a
 * sphere around the head (sized to include hair and cap), the upper arm is
 * rotated just enough to put that point back on the surface.
 */
export function keepHandsOffHead(rig: HeadClearanceRig, root: THREE.Object3D, clearance = 0.95) {
  root.updateMatrixWorld(true);
  rig.head.getWorldPosition(_center);
  rig.headTop.getWorldPosition(_top);
  const headHeight = _center.distanceTo(_top);
  _center.lerp(_top, 0.45); // middle of the skull
  const radius = headHeight * clearance;

  for (const { arm, points } of rig.arms) {
    // Find the point that is deepest inside the head sphere.
    let deepest: THREE.Bone | null = null;
    let minDist = radius;
    for (const b of points) {
      const d = b.getWorldPosition(_p).distanceTo(_center);
      if (d < minDist) { minDist = d; deepest = b; }
    }
    if (!deepest) continue;

    deepest.getWorldPosition(_p);
    _desired.copy(_p).sub(_center);
    if (_desired.lengthSq() < 1e-8) _desired.set(1, 0, 0);
    _desired.normalize().multiplyScalar(radius).add(_center);

    arm.getWorldPosition(_shoulder);
    _from.copy(_p).sub(_shoulder).normalize();
    _to.copy(_desired).sub(_shoulder).normalize();
    _qWorld.setFromUnitVectors(_from, _to);

    // Apply the world-space correction to the upper arm's local rotation.
    arm.parent!.getWorldQuaternion(_qParent);
    arm.getWorldQuaternion(_qArm);
    arm.quaternion.copy(_qParent.invert().multiply(_qWorld.multiply(_qArm)));
    arm.updateMatrixWorld(true);
  }
}
