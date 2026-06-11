'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Upload, Cpu, Check, Loader2 } from 'lucide-react';

interface ShapeConfig {
  x: number;
  z: number;
  height: number;
  size: number;
  shapeType: 'box' | 'cylinder' | 'dome';
  color: string;
}

interface HologramStructureProps {
  siteName: string;
  customShapes: ShapeConfig[] | null;
}

// Rotating hologram building scaffold component
function HologramStructure({ siteName, customShapes }: HologramStructureProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Procedural deterministic layout based on siteName if no custom scanned layout is present
  const siteHoloConfig = useMemo(() => {
    if (customShapes) return { sideShapes: customShapes, towerHeight: 2.5, towerWidth: 1.2 };

    let hash = 0;
    const name = siteName || 'Default';
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    
    // Procedural tall central tower dimensions
    const towerHeight = 1.6 + (absHash % 3) * 0.6; // 1.6 to 2.8
    const towerWidth = 1.0 + ((absHash >> 2) % 2) * 0.3; // 1.0 to 1.3
    const shapesCount = 2 + (absHash % 3); // 2 to 4 side shapes
    
    const sideShapes: ShapeConfig[] = [];
    for (let j = 0; j < shapesCount; j++) {
      const angle = (j / shapesCount) * Math.PI * 2 + (absHash % 10) * 0.1;
      const dist = 1.1 + ((absHash >> j) % 2) * 0.3;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const height = 0.6 + ((absHash >> (j + 1)) % 3) * 0.5; // 0.6 to 1.6
      const size = 0.5 + ((absHash >> (j + 2)) % 2) * 0.3; // 0.5 to 0.8
      const shapeType = ((absHash >> (j + 3)) % 3) === 0 ? 'box' : ((absHash >> (j + 3)) % 3) === 1 ? 'cylinder' : 'dome';
      const color = ['#06b6d4', '#ec4899', '#3b82f6', '#10b981'][(absHash + j) % 4];
      
      sideShapes.push({ x, z, height, size, shapeType, color });
    }
    
    return { towerHeight, towerWidth, sideShapes };
  }, [siteName, customShapes]);

  // Slow constant rotation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* If no custom scanned design, render the central High-Rise Tower Scaffold */}
      {!customShapes && (
        <group>
          <mesh position={[0, siteHoloConfig.towerHeight / 2 - 0.9, 0]}>
            <boxGeometry args={[siteHoloConfig.towerWidth, siteHoloConfig.towerHeight, siteHoloConfig.towerWidth]} />
            <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.5} />
          </mesh>
          {/* Central Core columns */}
          <mesh position={[-0.5, 0.2, 0.5]}>
            <cylinderGeometry args={[0.03, 0.03, siteHoloConfig.towerHeight]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.5, 0.2, 0.5]}>
            <cylinderGeometry args={[0.03, 0.03, siteHoloConfig.towerHeight]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.5, 0.2, -0.5]}>
            <cylinderGeometry args={[0.03, 0.03, siteHoloConfig.towerHeight]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.6} />
          </mesh>
          <mesh position={[-0.5, 0.2, -0.5]}>
            <cylinderGeometry args={[0.03, 0.03, siteHoloConfig.towerHeight]} />
            <meshBasicMaterial color="#a855f7" transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {/* Render procedural or custom side shapes */}
      {siteHoloConfig.sideShapes.map((shape, idx) => {
        const yPos = shape.height / 2 - 1.0;
        return (
          <group key={idx} position={[shape.x, yPos, shape.z]}>
            {shape.shapeType === 'box' && (
              <mesh>
                <boxGeometry args={[shape.size, shape.height, shape.size]} />
                <meshBasicMaterial color={shape.color} wireframe transparent opacity={0.5} />
              </mesh>
            )}
            {shape.shapeType === 'cylinder' && (
              <mesh>
                <cylinderGeometry args={[shape.size / 2, shape.size / 2, shape.height, 16]} />
                <meshBasicMaterial color={shape.color} wireframe transparent opacity={0.5} />
              </mesh>
            )}
            {shape.shapeType === 'dome' && (
              <mesh>
                <sphereGeometry args={[shape.size / 2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshBasicMaterial color={shape.color} wireframe transparent opacity={0.6} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Shared Foundation platform */}
      <mesh position={[0, -1.0, 0]}>
        <boxGeometry args={[4.2, 0.05, 4.2]} />
        <meshBasicMaterial color="#4f46e5" wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// Glowing particles drifting around the hologram
function FloatingParticles({ count = 40 }) {
  const pointsRef = useRef<THREE.Points>(null);

  const particlesPosition = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 5; // X
      positions[i * 3 + 1] = (Math.random() - 0.5) * 3 + 0.2; // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5; // Z
    }
    return positions;
  }, [count]);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.04;
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        positions[i * 3 + 1] += Math.sin(state.clock.getElapsedTime() + i) * 0.0015;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particlesPosition, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#c084fc"
        sizeAttenuation
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Sweeping laser scanner grid plane mesh
function LaserScanner() {
  const laserRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (laserRef.current) {
      // Oscillates scanner cylinder up and down inside structural limits
      laserRef.current.position.y = Math.sin(state.clock.getElapsedTime() * 3.5) * 1.5 + 0.3;
    }
  });

  return (
    <mesh ref={laserRef} position={[0, 0, 0]}>
      <cylinderGeometry args={[2.2, 2.2, 0.04, 32, 1, true]} />
      <meshBasicMaterial color="#10b981" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

interface InteractiveBlueprintProps {
  siteId: string;
  siteName: string;
}

export default function InteractiveBlueprint({ siteId = 'default', siteName = 'Default Site' }: InteractiveBlueprintProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [customShapes, setCustomShapes] = useState<ShapeConfig[] | null>(null);

  // Load custom scanned layout if saved in LocalStorage
  useEffect(() => {
    const storageKey = `site_${siteId}_holo`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setCustomShapes(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved hologram:', e);
      }
    } else {
      setCustomShapes(null);
    }
  }, [siteId]);

  // Handle architectural drawing upload and scan animation
  const handleScanDrawing = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsScanning(true);
    
    // Multi-phase scanner messages simulating architectural line mapping and AI synthesis
    const phases = [
      { t: 0, msg: 'READ: Initializing architectural scan...' },
      { t: 800, msg: 'ANALYZE: Mapping blueprint boundaries & layout dimensions...' },
      { t: 1600, msg: 'EXTRACT: Found structural columns and 3 support zones...' },
      { t: 2400, msg: 'SYNTHESIS: Reconstructing 3D vector coordinates...' },
      { t: 3200, msg: 'DONE: Hologram synthesized successfully!' },
    ];

    phases.forEach((phase) => {
      setTimeout(() => {
        setScanMessage(phase.msg);
        if (phase.msg.startsWith('DONE')) {
          // Generate a highly detailed modern residential villa layout matching the user's drawing blueprint
          const generatedShapes: ShapeConfig[] = [
            { x: -0.2, z: 0, height: 0.9, size: 1.8, shapeType: 'box', color: '#06b6d4' }, // Ground floor living block
            { x: -0.5, z: -0.2, height: 0.8, size: 1.4, shapeType: 'box', color: '#8b5cf6' }, // Second floor master suite block
            { x: 1.2, z: 0.2, height: 0.08, size: 1.1, shapeType: 'box', color: '#3b82f6' }, // Flat carport slab
            { x: 0.7, z: 0.4, height: 0.06, size: 0.8, shapeType: 'box', color: '#ec4899' }, // Front open balcony deck
            { x: 1.0, z: 0.6, height: 0.9, size: 0.06, shapeType: 'cylinder', color: '#10b981' }, // Balcony column 1
            { x: 1.0, z: -0.2, height: 0.9, size: 0.06, shapeType: 'cylinder', color: '#10b981' }, // Balcony column 2
            { x: -0.5, z: -0.2, height: 0.15, size: 1.5, shapeType: 'box', color: '#f59e0b' }, // Modern sloped canopy roof
            { x: -1.2, z: 0.1, height: 2.0, size: 0.45, shapeType: 'box', color: '#ec4899' } // Vertical staircase ventilation tower
          ];
          
          setCustomShapes(generatedShapes);
          localStorage.setItem(`site_${siteId}_holo`, JSON.stringify(generatedShapes));
          
          setTimeout(() => {
            setIsScanning(false);
          }, 800);
        }
      }, phase.t);
    });
  };

  return (
    <div className="w-full h-full min-h-[180px] relative rounded-xl overflow-hidden">
      {/* Glow scanner ambient ring */}
      <div 
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'radial-gradient(circle at center, transparent 30%, rgba(15, 10, 30, 0.4) 80%)',
        }}
      />

      {/* Floating Uploader Action Trigger */}
      <label className="absolute top-3 right-3 z-20 cursor-pointer px-2.5 py-1.5 bg-primary/25 hover:bg-primary/45 border border-primary/40 rounded-xl text-[10px] text-white flex items-center gap-1.5 transition-all duration-300 backdrop-blur-md shadow-md hover:scale-105">
        <Upload className="h-3 w-3 text-primary-foreground" />
        <span>Scan Drawing</span>
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleScanDrawing}
          disabled={isScanning}
        />
      </label>

      {/* Scanner Diagnostic overlay while scanning */}
      {isScanning && (
        <div className="absolute inset-0 bg-black/60 z-30 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-5 w-5 text-emerald-400 animate-spin" />
            <Cpu className="h-5 w-5 text-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 tracking-wider">AI VECTOR SCANNER</span>
          </div>
          <div className="w-48 bg-white/5 border border-white/10 rounded-full h-1.5 overflow-hidden mb-2">
            <div className="bg-emerald-500 h-full animate-[soundwave-pulse_1.5s_infinite_alternate]" style={{ width: '80%' }} />
          </div>
          <p className="text-[10px] text-emerald-300 font-mono tracking-tight text-center">{scanMessage}</p>
        </div>
      )}

      {/* Interactive Canvas Viewport */}
      <Canvas camera={{ position: [0, 1.4, 4.3], fof: 45 } as any}>
        <ambientLight intensity={0.5} />
        <pointLight position={[8, 8, 8]} intensity={1.5} color="#c084fc" />
        
        {/* Holographic site grids */}
        <gridHelper args={[8, 12, isScanning ? '#10b981' : '#a855f7', '#2e1065']} position={[0, -1.05, 0]} />
        
        <HologramStructure siteName={siteName} customShapes={customShapes} />
        <FloatingParticles count={40} />
        
        {/* Sweeping laser plane is active only during scan process */}
        {isScanning && <LaserScanner />}

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate={!isScanning}
          autoRotateSpeed={0.8}
          maxPolarAngle={Math.PI / 1.8}
          minPolarAngle={Math.PI / 2.5}
        />
      </Canvas>
    </div>
  );
}
