"use client";

import { useEffect, useState } from "react";

interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  size?: number;
  color?: string;
  label: string;
  detail: string;
}

export function RetroSpeedometer({ 
  value, 
  min = 0, 
  max = 100, 
  size = 160,
  color = "text-primary",
  label,
  detail
}: GaugeProps) {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 600;
    const start = displayValue;
    const end = value;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutBack = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + (end - start) * easeOutBack));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);

  const percentage = Math.min(Math.max((displayValue - min) / (max - min), 0), 1);
  const angle = percentage * 270 - 135;
  
  const getColorClass = () => {
    if (displayValue >= 90) return "text-red-500";
    if (displayValue >= 75) return "text-amber-500";
    if (displayValue >= 50) return "text-yellow-400";
    return "text-green-500";
  };

  const getNeedleColor = () => {
    if (displayValue >= 90) return "#ef4444";
    if (displayValue >= 75) return "#f59e0b";
    if (displayValue >= 50) return "#facc15";
    return "#22c55e";
  };

  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  
  return (
    <div className="relative rounded-xl border-2 border-slate-700 bg-slate-900 p-4 shadow-inner">
      <div className="absolute inset-0 rounded-xl border border-slate-600 opacity-50" />
      
      <div className="relative" style={{ width: size, height: size * 0.6 }}>
        <svg
          width={size}
          height={size * 0.6}
          viewBox="0 0 160 100"
          className="drop-shadow-lg"
        >
          <defs>
            <radialGradient id="gaugeBg" cx="50%" cy="100%" r="80%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
            
            <filter id="needleGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <path
            d="M 20 80 A 60 60 0 0 1 140 80"
            fill="none"
            stroke="#334155"
            strokeWidth="12"
            strokeLinecap="round"
          />
          
          { /* Green zone (0-50%) */ }
          <path
            d="M 20 80 A 60 60 0 0 1 50 28"
            fill="none"
            stroke="#22c55e"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.6"
          />
          { /* Yellow zone (50-75%) */ }
          <path
            d="M 50 28 A 60 60 0 0 1 95 28"
            fill="none"
            stroke="#eab308"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.6"
          />
          { /* Amber zone (75-90%) */ }
          <path
            d="M 95 28 A 60 60 0 0 1 125 50"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.6"
          />
          { /* Red zone (90-100%) */ }
          <path
            d="M 125 50 A 60 60 0 0 1 140 80"
            fill="none"
            stroke="#ef4444"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.6"
          />
          
          {ticks.map((tick) => {
            const tickAngle = (tick / 100) * 270 - 135;
            const rad = (tickAngle * Math.PI) / 180;
            const innerR = 52;
            const outerR = tick % 50 === 0 ? 62 : tick % 10 === 0 ? 58 : 55;
            const x1 = 80 + innerR * Math.cos(rad);
            const y1 = 80 + innerR * Math.sin(rad);
            const x2 = 80 + outerR * Math.cos(rad);
            const y2 = 80 + outerR * Math.sin(rad);
            const labelR = 45;
            const lx = 80 + labelR * Math.cos(rad);
            const ly = 80 + labelR * Math.sin(rad);
            
            return (
              <g key={tick}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={tick % 50 === 0 ? "#94a3b8" : "#64748b"}
                  strokeWidth={tick % 50 === 0 ? 2 : 1}
                />
                {tick % 25 === 0 && (
                  <text
                    x={lx}
                    y={ly}
                    fill="#94a3b8"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {tick}
                  </text>
                )}
              </g>
            );
          })}
          
          <g transform={`rotate(${angle} 80 80)`}>
            <polygon
              points="80,20 76,78 80,75 84,78"
              fill={getNeedleColor()}
              filter="url(#needleGlow)"
            />
            <circle cx="80" cy="80" r="4" fill="#475569" />
            <circle cx="80" cy="80" r="2" fill="#94a3b8" />
          </g>
          
          <defs>
            <linearGradient id="glass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.1" />
              <stop offset="50%" stopColor="white" stopOpacity="0" />
              <stop offset="100%" stopColor="white" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <ellipse
            cx="80"
            cy="60"
            rx="50"
            ry="35"
            fill="url(#glass)"
          />
        </svg>
        
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <div className="bg-slate-800 border border-slate-600 rounded px-3 py-1 shadow-inner">
            <span className={`text-xl font-bold font-mono ${getColorClass()}`}>
              {displayValue.toString().padStart(3, '0')}
            </span>
            <span className="text-xs text-slate-400 ml-1">%</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 text-center">
        <p className="text-sm font-semibold text-slate-200 tracking-wide uppercase">
          {label}
        </p>
        <p className="text-[10px] text-slate-400 mt-1 font-mono">{detail}</p>
      </div>
    </div>
  );
}

export function RetroCircularGauge({ 
  value, 
  size = 100,
  color = "text-primary",
  label
}: { 
  value: number; 
  size?: number;
  color?: string;
  label: string;
}) {
  const percentage = Math.min(Math.max(value, 0), 100);
  const angle = (percentage / 100) * 360;
  
  const getColor = () => {
    if (value >= 90) return "#ef4444";
    if (value >= 75) return "#f59e0b";
    if (value >= 50) return "#eab308";
    return "#22c55e";
  };

  return (
    <div className="relative rounded-full border-2 border-slate-700 bg-slate-900 p-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100">
          <defs>
            <radialGradient id="retroGaugeBg" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
          </defs>
          
          <circle cx="50" cy="50" r="45" fill="url(#retroGaugeBg)" />
          
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="#334155"
            strokeWidth="2"
          />
          
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke={getColor()}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${(percentage / 100) * 239} 239`}
            transform="rotate(-90 50 50)"
            className="transition-all duration-500"
          />
          
          {[0, 25, 50, 75, 100].map((tick) => {
            const tickAngle = (tick / 100) * 360 - 90;
            const rad = (tickAngle * Math.PI) / 180;
            const x = 50 + 32 * Math.cos(rad);
            const y = 50 + 32 * Math.sin(rad);
            return (
              <circle
                key={tick}
                cx={x}
                cy={y}
                r={tick % 50 === 0 ? 2 : 1}
                fill="#64748b"
              />
            );
          })}
        </svg>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className="text-lg font-bold font-mono" style={{ color: getColor() }}>
              {Math.round(value)}
            </span>
            <span className="text-xs text-slate-400">%</span>
          </div>
        </div>
      </div>
      
      <span className="text-[10px] text-slate-400 mt-1 block text-center font-mono uppercase">
        {label}
      </span>
    </div>
  );
}
