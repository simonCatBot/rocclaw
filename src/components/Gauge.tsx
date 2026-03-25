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

export function Speedometer({ 
  value, 
  min = 0, 
  max = 100, 
  size = 140,
  color = "text-primary",
  label,
  detail
}: GaugeProps) {
  const [displayValue, setDisplayValue] = useState(0);
  
  // Animate the value
  useEffect(() => {
    const duration = 500;
    const start = displayValue;
    const end = value;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.round(start + (end - start) * easeOutQuart));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value]);

  const percentage = Math.min(Math.max((displayValue - min) / (max - min), 0), 1);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (percentage * circumference * 0.75); // 270 degrees (3/4 circle)
  
  // Determine color based on value
  const getColorClass = () => {
    if (displayValue >= 80) return "text-red-500";
    if (displayValue >= 60) return "text-yellow-500";
    return color;
  };

  const getStrokeColor = () => {
    if (displayValue >= 80) return "#ef4444";
    if (displayValue >= 60) return "#eab308";
    return "currentColor";
  };

  return (
    <div className="ui-panel p-4 flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size * 0.75 }}>
        <svg
          width={size}
          height={size * 0.75}
          viewBox="0 0 100 75"
          className="transform -rotate-[135deg]"
        >
          {/* Background arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-surface-2"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
          />
          
          {/* Value arc */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={getStrokeColor()}
            strokeWidth="8"
            strokeLinecap="round"
            className={`transition-all duration-500 ${getColorClass()}`}
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: "drop-shadow(0 0 4px currentColor)",
            }}
          />
          
          {/* Ticks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (tick / 100) * 270 - 135;
            const rad = (angle * Math.PI) / 180;
            const x1 = 50 + 35 * Math.cos(rad);
            const y1 = 50 + 35 * Math.sin(rad);
            const x2 = 50 + 42 * Math.cos(rad);
            const y2 = 50 + 42 * Math.sin(rad);
            return (
              <g key={tick}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground"
                />
                <text
                  x={50 + 30 * Math.cos(rad)}
                  y={50 + 30 * Math.sin(rad)}
                  fill="currentColor"
                  fontSize="6"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-muted-foreground"
                >
                  {tick}
                </text>
              </g>
            );
          })}
        </svg>
        
        {/* Center value display */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className={`text-3xl font-bold ${getColorClass()}`}>
            {displayValue}
            <span className="text-lg">%</span>
          </span>
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{detail}</p>
      </div>
    </div>
  );
}

// Simple circular gauge for smaller displays
export function CircularGauge({ 
  value, 
  size = 80,
  color = "text-primary",
  label
}: { 
  value: number; 
  size?: number;
  color?: string;
  label: string;
}) {
  const percentage = Math.min(Math.max(value, 0), 100);
  const circumference = 2 * Math.PI * 35;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getColorClass = () => {
    if (value >= 80) return "text-red-500";
    if (value >= 60) return "text-yellow-500";
    return color;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 80 80">
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-surface-2"
          />
          <circle
            cx="40"
            cy="40"
            r="35"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className={`transition-all duration-500 ${getColorClass()}`}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 40 40)"
          />
        </svg>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${getColorClass()}`}>
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1">{label}</span>
    </div>
  );
}
