'use client';

import React, { useState, useEffect } from 'react';

interface InteractiveMascotProps {
  isTalking?: boolean;
  isThinking?: boolean;
  onClick?: () => void;
}

export default function InteractiveMascot({ isTalking = false, isThinking = false, onClick }: InteractiveMascotProps) {
  const [expression, setExpression] = useState<'calm' | 'happy' | 'thinking' | 'speaking'>('calm');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (isThinking) {
      setExpression('thinking');
    } else if (isTalking) {
      setExpression('speaking');
    } else if (isHovered) {
      setExpression('happy');
    } else {
      setExpression('calm');
    }
  }, [isTalking, isThinking, isHovered]);

  return (
    <div 
      className="relative w-full h-full flex items-center justify-center cursor-pointer select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <style>{`
        @keyframes float-body {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-shadow {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(0.8); opacity: 0.15; }
        }
        @keyframes eye-blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes thruster-fire {
          0%, 100% { transform: scaleY(1) scaleX(1); opacity: 0.8; }
          50% { transform: scaleY(1.3) scaleX(0.9); opacity: 1; }
        }
        @keyframes beacon-glow {
          0%, 100% { filter: drop-shadow(0 0 2px #3b82f6); opacity: 0.6; }
          50% { filter: drop-shadow(0 0 12px #3b82f6); opacity: 1; }
        }
        
        .mascot-container {
          animation: float-body 4s ease-in-out infinite;
        }
        .mascot-shadow {
          animation: float-shadow 4s ease-in-out infinite;
        }
        .mascot-eye {
          transform-origin: center;
          animation: eye-blink 5s infinite;
        }
        .mascot-fire {
          transform-origin: top center;
          animation: thruster-fire 0.15s infinite;
        }
        .mascot-beacon {
          animation: beacon-glow 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* Main Droid Wrapper */}
      <div className="relative w-48 h-48 flex flex-col items-center justify-center">
        {/* Glow Aura behind Droid */}
        <div 
          className={`absolute w-32 h-32 rounded-full filter blur-2xl transition-all duration-500 -translate-y-4 ${
            expression === 'happy' ? 'bg-emerald-500/20 scale-125' :
            expression === 'thinking' ? 'bg-amber-500/20 scale-110' :
            expression === 'speaking' ? 'bg-purple-500/30 scale-125' : 'bg-primary/20'
          }`} 
        />

        {/* Floating Droid Body */}
        <div className="mascot-container w-full h-full relative z-10 flex flex-col items-center justify-center">
          <svg 
            viewBox="0 0 200 200" 
            className="w-40 h-40 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
          >
            <defs>
              {/* Metallic body gradient */}
              <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e2e8f0" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              {/* Visor gradient */}
              <linearGradient id="visorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              {/* Hardhat yellow gradient */}
              <linearGradient id="hatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="40%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#854d0e" />
              </linearGradient>
              {/* Thruster fire gradient */}
              <linearGradient id="fireGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* 1. Thruster Fire */}
            <path 
              d="M 85,145 L 100,185 L 115,145 Z" 
              fill="url(#fireGrad)" 
              className="mascot-fire"
            />
            {/* Inner fire core */}
            <path 
              d="M 92,145 L 100,170 L 108,145 Z" 
              fill="#93c5fd" 
              className="mascot-fire"
              style={{ animationDelay: '0.07s' }}
            />

            {/* 2. Metallic Neck / Thruster Mount */}
            <ellipse cx="100" cy="142" rx="18" ry="6" fill="#334155" />
            <rect x="92" y="132" width="16" height="12" fill="#475569" rx="2" />

            {/* 3. Spherical Robot Body */}
            <circle cx="100" cy="100" r="42" fill="url(#bodyGrad)" stroke="#1e293b" strokeWidth="2" />

            {/* 4. Sleek Visor Area */}
            <path 
              d="M 68,96 C 68,82 132,82 132,96 C 132,110 68,110 68,96 Z" 
              fill="url(#visorGrad)" 
              stroke="#475569" 
              strokeWidth="2.5" 
            />

            {/* 5. Glowing LED Eyes based on expression state */}
            {expression === 'calm' && (
              <g>
                <circle cx="86" cy="96" r="5" fill="#38bdf8" className="mascot-eye" />
                <circle cx="114" cy="96" r="5" fill="#38bdf8" className="mascot-eye" />
                <circle cx="86" cy="96" r="2" fill="#ffffff" opacity="0.8" />
                <circle cx="114" cy="96" r="2" fill="#ffffff" opacity="0.8" />
              </g>
            )}

            {expression === 'happy' && (
              <g>
                {/* Happy arch eyes `^ ^` */}
                <path d="M 80,98 Q 86,88 92,98" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M 108,98 Q 114,88 120,98" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" />
              </g>
            )}

            {expression === 'thinking' && (
              <g>
                {/* Asymmetric eyes (one arched, one straight/flat) */}
                <path d="M 80,94 L 92,94" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
                <circle cx="114" cy="96" r="5.5" fill="#f59e0b" className="mascot-eye" />
              </g>
            )}

            {expression === 'speaking' && (
              <g>
                {/* Wider excited/speaking circular eyes */}
                <circle cx="86" cy="96" r="6" fill="#a855f7" />
                <circle cx="114" cy="96" r="6" fill="#a855f7" />
                <circle cx="86" cy="96" r="2.5" fill="#ffffff" />
                <circle cx="114" cy="96" r="2.5" fill="#ffffff" />
                {/* Cute mini talking wave in center */}
                <path d="M 97,102 Q 100,99 103,102" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}

            {/* 6. Site Supervisor Hardhat (Yellow Construction Helmet) */}
            <path 
              d="M 54,72 C 54,42 146,42 146,72 C 146,76 54,76 54,72 Z" 
              fill="url(#hatGrad)" 
              stroke="#854d0e" 
              strokeWidth="2" 
            />
            {/* Hardhat Visor/Brim */}
            <path 
              d="M 48,72 Q 100,64 152,72 L 148,78 Q 100,70 52,78 Z" 
              fill="#eab308" 
              stroke="#854d0e" 
              strokeWidth="1.5" 
            />
            {/* Helmet ridge */}
            <path 
              d="M 100,42 Q 100,56 100,70" 
              fill="none" 
              stroke="#fef08a" 
              strokeWidth="4" 
              strokeLinecap="round" 
              opacity="0.6"
            />

            {/* 7. Supervisor Beacon Light (On top of hardhat) */}
            <rect x="94" y="32" width="12" height="12" fill="#475569" rx="2" />
            <circle cx="100" cy="28" r="6" fill="#3b82f6" className="mascot-beacon" />
            <circle cx="100" cy="28" r="3" fill="#ffffff" opacity="0.8" />
          </svg>
        </div>

        {/* Futuristic glowing drop shadow below the floating droid */}
        <div className="mascot-shadow w-24 h-3 bg-black/40 rounded-full filter blur-sm transition-transform duration-300" />
      </div>
    </div>
  );
}
