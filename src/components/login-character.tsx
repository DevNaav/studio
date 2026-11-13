'use client';

/**
 * Interactive 3D character for the login page. It reacts to the form:
 * looks around / follows the mouse when idle, watches the form while you type
 * your email, turns its back while you type your password, peeks when the
 * password is shown, shakes its head on a failed login and jumps on success.
 */
import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { findBone, getHeadClearanceRig, keepHandsOffHead, pickCharacterModel } from '@/lib/character-rig';

// 4K textures on desktop, HD on phones (chosen once per page load).
const MODEL_URL = pickCharacterModel();

export type CharacterMood = 'idle' | 'email' | 'password' | 'peek' | 'error' | 'success';

interface CharacterProps {
  mood: CharacterMood;
  /** 0–1: how far through the email the user is (the head follows along). */
  emailProgress: number;
}

const damp = THREE.MathUtils.damp;

function Character({ mood, emailProgress }: CharacterProps) {
  const { scene, animations } = useGLTF(MODEL_URL);
  // Own copy of the rig so the landing page's character is unaffected.
  const model = useMemo(() => {
    const m = cloneSkinned(scene);
    m.visible = false; // shown after the first animated frame, so the default T-pose never flashes
    return m;
  }, [scene]);
  const root = useRef<THREE.Group>(null);
  const { actions } = useAnimations(animations, root);
  const gl = useThree((state) => state.gl);

  // Crisper textures when surfaces are seen at an angle (anisotropic filtering),
  // and soft-but-defined shadows on the character itself.
  useEffect(() => {
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    model.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats as THREE.MeshStandardMaterial[]) {
        for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, (mat as any).specularIntensityMap, (mat as any).specularColorMap]) {
          if (tex) { tex.anisotropy = maxAniso; tex.needsUpdate = true; }
        }
        mat.envMapIntensity = 0.9;
      }
    });
  }, [model, gl]);

  const bones = useMemo(() => ({
    head: findBone(model, 'Head'),
    neck: findBone(model, 'Neck'),
    spine: findBone(model, 'Spine2'),
  }), [model]);
  const handRig = useMemo(() => getHeadClearanceRig(model), [model]);

  // Smoothed values that the frame loop eases toward their targets.
  const s = useRef({ yaw: 0, pitch: 0, bodyYaw: 0, jump: 0, spin: 0, lean: 0 });
  const moodStart = useRef(0);
  const moodRef = useRef<CharacterMood>(mood);
  const offset = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);

  useEffect(() => {
    const first = actions && Object.values(actions)[0];
    first?.reset().setEffectiveWeight(1).play();
    return () => { first?.stop(); };
  }, [actions]);

  useEffect(() => {
    moodRef.current = mood;
    moodStart.current = performance.now() / 1000;
    if (mood === 'success') s.current.spin = 0;
  }, [mood]);

  // Runs after useAnimations' mixer update (registered later), so these
  // tweaks are layered on top of the idle animation each frame.
  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    // The mixer has applied the animation by now (it updates before this callback).
    if (!model.visible && actions && Object.values(actions)[0]?.isRunning()) model.visible = true;
    const st = s.current;
    const t = state.clock.getElapsedTime();
    const since = performance.now() / 1000 - moodStart.current;
    const m = moodRef.current;

    // --- targets per mood ---
    let headYaw = 0, headPitch = 0, bodyYaw = Math.sin(t * 0.6) * 0.12, lean = 0;
    switch (m) {
      case 'idle':
        headYaw = THREE.MathUtils.clamp(state.pointer.x * 0.7, -0.7, 0.7);
        headPitch = THREE.MathUtils.clamp(-state.pointer.y * 0.35, -0.3, 0.35);
        break;
      case 'email':
        // The form is on the character's left (viewer's right): look at it and follow the typing.
        bodyYaw = 0.35;
        headYaw = 0.25 + emailProgress * 0.35;
        headPitch = 0.22;
        lean = 0.05;
        break;
      case 'password':
        bodyYaw = Math.PI; // turn around: "not looking"
        headPitch = 0.15;
        break;
      case 'peek':
        bodyYaw = Math.PI * 0.62; // over-the-shoulder peek
        headYaw = 0.75;
        headPitch = 0.1;
        lean = 0.08;
        break;
      case 'error':
        // Head shake that settles after ~1.2s
        headYaw = Math.sin(since * 18) * 0.45 * Math.max(0, 1 - since / 1.2);
        headPitch = 0.12;
        break;
      case 'success':
        headPitch = -0.2;
        break;
    }

    st.yaw = damp(st.yaw, headYaw, m === 'error' ? 30 : 6, delta);
    st.pitch = damp(st.pitch, headPitch, 6, delta);
    st.bodyYaw = damp(st.bodyYaw, bodyYaw, m === 'password' || m === 'peek' ? 5 : 3.5, delta);
    st.lean = damp(st.lean, lean, 4, delta);

    // Success: one jump with a full spin, then settle.
    if (m === 'success') {
      const p = Math.min(since / 0.9, 1);
      st.jump = Math.sin(p * Math.PI) * 0.6;
      st.spin = p * Math.PI * 2;
    } else {
      st.jump = damp(st.jump, 0, 8, delta);
      st.spin = damp(st.spin, 0, 8, delta);
    }

    g.rotation.y = st.bodyYaw + st.spin;
    g.position.y = -2 + st.jump + Math.sin(t * 1.6) * 0.02;

    // Head: split the turn between neck and head for a natural look.
    if (bones.neck) {
      offset.setFromEuler(euler.set(st.pitch * 0.4, st.yaw * 0.4, 0));
      bones.neck.quaternion.multiply(offset);
    }
    if (bones.head) {
      offset.setFromEuler(euler.set(st.pitch * 0.6, st.yaw * 0.6, 0));
      bones.head.quaternion.multiply(offset);
    }
    if (bones.spine && st.lean) {
      offset.setFromEuler(euler.set(st.lean, 0, 0));
      bones.spine.quaternion.multiply(offset);
    }

    // Last: make sure no hand ends up inside the head after the tweaks above.
    if (handRig) keepHandsOffHead(handRig, model);
  });

  return (
    <group ref={root} position={[0, -2, 0]}>
      <primitive object={model} scale={2} />
    </group>
  );
}

function Pedestal({ mood }: { mood: CharacterMood }) {
  const ring = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.MeshBasicMaterial>(null);
  const target = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    if (ring.current) ring.current.rotation.z -= delta * 0.6;
    if (glow.current) {
      target.set(mood === 'error' ? '#ef4444' : mood === 'success' ? '#22c55e' : '#38bdf8');
      glow.current.color.lerp(target, Math.min(1, delta * 6));
    }
  });
  return (
    <group position={[0, -2, 0]}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <circleGeometry args={[1.25, 64]} />
        <meshBasicMaterial ref={glow} color="#38bdf8" transparent opacity={0.18} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[1.18, 1.3, 64, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.015}>
        <ringGeometry args={[1.45, 1.48, 64]} />
        <meshBasicMaterial color="#a855f7" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export default function LoginCharacterCanvas(props: CharacterProps) {
  return (
    <Canvas
      camera={{ position: [0, -0.1, 6.4], fov: 36 }}
      // Render at the screen's full pixel density (Retina / 4K displays) up to 2.5x.
      dpr={[1, 2.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ background: 'transparent' }}
    >
      {/* Studio lighting: key, fill and coloured rim lights */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={2.2} />
      <directionalLight position={[-3, 2.5, 3]} intensity={0.7} color="#dbeafe" />
      <directionalLight position={[-4, 2, -3]} intensity={1.2} color="#a855f7" />
      <directionalLight position={[4, 1, -3]} intensity={0.9} color="#38bdf8" />
      {/* Soft reflections built in code (no HDR download): a softbox-style studio environment */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 4, 4]} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#e0f2fe" position={[-5, 1, 2]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ede9fe" position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#38bdf8" position={[0, 0, -6]} scale={3} />
      </Environment>
      <Suspense fallback={null}>
        <Character {...props} />
        <Pedestal mood={props.mood} />
        <ContactShadows position={[0, -1.99, 0]} opacity={0.45} scale={4} blur={2.4} far={2} />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
