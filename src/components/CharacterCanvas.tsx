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

function HoloPedestal() {
  const wireRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (wireRef.current) {
      wireRef.current.rotation.y -= 0.005;
    }
  });

  return (
    <group position={[0, -2, 0]}>
      {/* 1. Translucent glass pedestal platform */}
      <mesh>
        <cylinderGeometry args={[1.1, 1.2, 0.15, 32]} />
        <meshPhysicalMaterial 
          color="#a855f7" 
          transparent 
          opacity={0.35} 
          roughness={0.1}
          metalness={0.9}
          transmission={0.6}
          thickness={1.5}
        />
      </mesh>
      
      {/* 2. Outer neon rotating wireframe overlay */}
      <mesh ref={wireRef as any}>
        <cylinderGeometry args={[1.12, 1.22, 0.16, 16]} />
        <meshBasicMaterial color="#06b6d4" wireframe transparent opacity={0.4} />
      </mesh>
      
      {/* 3. Subtle laser projection halo cone */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.01, 1.1, 3.2, 32, 1, true]} />
        <meshBasicMaterial 
          color="#a855f7" 
          transparent 
          opacity={0.06} 
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Sparkles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 25;
  
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
        size={0.06}
        color="#06b6d4"
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

export default function CharacterCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 48 }}>
      {/* Immersive Studio and Projection Lighting Setup */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 5, 4]} intensity={1.8} /> {/* Key Light */}
      <directionalLight position={[-4, 1, -4]} intensity={0.6} color="#67e8f9" /> {/* Cool Fill Light */}
      <directionalLight position={[0, -4, 4]} intensity={1.0} color="#c084fc" /> {/* Warm Rim Light */}
      
      {/* Spotlight radiating from the projector base to illuminate the model upward */}
      <spotLight 
        position={[0, -2.5, 0]} 
        angle={Math.PI / 4} 
        penumbra={1} 
        intensity={6} 
        color="#a855f7" 
      />

      <Suspense fallback={null}>
        <HoloPedestal />
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
