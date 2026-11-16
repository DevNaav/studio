'use client';

import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, useAnimations } from '@react-three/drei';
import * as THREE from 'three';
import { getHeadClearanceRig, keepHandsOffHead, pickCharacterModel } from '@/lib/character-rig';

// 4K textures on desktop, HD on phones (chosen once per page load).
const MODEL_URL = pickCharacterModel();

function Model() {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const handRig = React.useMemo(() => getHeadClearanceRig(scene), [scene]);
  const { actions } = useAnimations(animations, group as any);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      const firstAnimationName = Object.keys(actions)[0];
      actions[firstAnimationName]?.play();
    }
  }, [actions]);

  // Slow horizontal scanning oscillation to simulate a live holographic supervisor looking around
  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.6) * 0.25;
    }
    // Keep the head-scratching hand from sinking into the head.
    if (handRig) keepHandsOffHead(handRig, scene);
  });

  return <primitive ref={group} object={scene} scale={2} position={[0, -2, 0]} />;
}

/** A clean round stage with a soft shadow (replaces the old neon hologram pedestal). */
function Stage() {
  return (
    <group position={[0, -2, 0]}>
      {/* soft contact shadow */}
      <mesh position={[0, 0.081, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.75, 48]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {/* stage disc */}
      <mesh>
        <cylinderGeometry args={[1.05, 1.1, 0.16, 64]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.05} />
      </mesh>
      {/* brand-blue rim */}
      <mesh position={[0, -0.02, 0]}>
        <torusGeometry args={[1.09, 0.025, 12, 96]} />
        <meshStandardMaterial color="#3b82f6" emissive="#3b82f6" emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Sparkles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 14;
  
  const [positions] = React.useState(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 1.8;      // X
      arr[i * 3 + 1] = Math.random() * 4 - 2;        // Y
      arr[i * 3 + 2] = (Math.random() - 0.5) * 1.8;  // Z
    }
    return arr;
  });

  useFrame((state) => {
    if (pointsRef.current) {
      const positionsArr = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        // Drift sparks upwards
        positionsArr[i * 3 + 1] += 0.008;
        // Wrap back around once they exit the display area
        if (positionsArr[i * 3 + 1] > 2) {
          positionsArr[i * 3 + 1] = -2;
          positionsArr[i * 3] = (Math.random() - 0.5) * 1.8;
          positionsArr[i * 3 + 2] = (Math.random() - 0.5) * 1.8;
        }
        // Micro wave oscillation
        positionsArr[i * 3] += Math.sin(state.clock.getElapsedTime() + i) * 0.001;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef as any}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#60a5fa"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function CharacterCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 48 }}>
      {/* Soft studio lighting: warm key, cool fill, gentle rim */}
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 5, 4]} intensity={1.6} color="#fff7ed" />
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#dbeafe" />
      <directionalLight position={[0, 3, -5]} intensity={0.6} color="#93c5fd" />

      <Suspense fallback={null}>
        <Stage />
        <Sparkles />
        <Model />
      </Suspense>
      
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 2.2}
        maxPolarAngle={Math.PI / 2.2}
      />
    </Canvas>
  );
}
