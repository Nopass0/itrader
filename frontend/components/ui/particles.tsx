'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Particles from 'react-tsparticles';
import type { Engine } from 'tsparticles-engine';
import { loadSlim } from 'tsparticles-slim';

interface ParticlesContainerProps {
  className?: string;
  quantity?: number;
  color?: string;
  particleSize?: number;
  speed?: number;
}

export function ParticlesContainer({
  className,
  quantity = 30,
  particleSize = 3,
  speed = 1.5,
}: ParticlesContainerProps) {
  const { theme } = useTheme();
  const [color, setColor] = useState('#646cff');

  // Update color based on theme
  useEffect(() => {
    // For dark theme, use white color for particles
    // For light theme, use darker blue particles
    setColor(theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(60, 65, 176, 0.8)');
  }, [theme]);

  const particlesInit = useCallback(async (engine: Engine) => {
    await loadSlim(engine);
  }, []);

  return (
    <div className={className}>
      <Particles
        id="tsparticles"
        init={particlesInit}
        options={{
          fullScreen: {
            enable: false,
          },
          background: {
            color: {
              value: 'transparent',
            },
          },
          fpsLimit: 60,
          particles: {
            color: {
              value: color,
            },
            links: {
              color: color,
              distance: 150,
              enable: true,
              opacity: 0.2,
              width: 1,
            },
            move: {
              direction: 'none',
              enable: true,
              outModes: {
                default: 'bounce',
              },
              random: true,
              speed: speed,
              straight: false,
            },
            number: {
              density: {
                enable: true,
                area: 800,
              },
              value: quantity,
            },
            opacity: {
              value: 0.5,
              random: true,
              anim: {
                enable: true,
                speed: 0.5,
                opacity_min: 0.1,
                sync: false,
              },
            },
            shape: {
              type: 'circle',
            },
            size: {
              value: { min: 1, max: particleSize },
            },
          },
          detectRetina: true,
        }}
        className="absolute inset-0 -z-10"
      />
    </div>
  );
}

export function DotPattern({
  className,
  dotColor = 'rgba(100, 108, 255, 0.4)',
  dotSize = 1,
  dotSpacing = 20,
}: {
  className?: string;
  dotColor?: string;
  dotSize?: number;
  dotSpacing?: number;
}) {
  const { theme } = useTheme();
  const [color, setColor] = useState(dotColor);

  // Update color based on theme
  useEffect(() => {
    // Use a brighter white for dark theme with higher opacity
    // Use darker dots for light theme
    setColor(theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(52, 58, 138, 0.6)');
  }, [theme]);

  return (
    <div
      className={className}
      style={{
        backgroundImage: `radial-gradient(${color} ${dotSize}px, transparent 0)`,
        backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
        backgroundPosition: '0 0',
      }}
    />
  );
}

export function FlickeringGrid({ className }: { className?: string }) {
  return (
    <div className={`grid grid-cols-8 gap-6 ${className}`}>
      {Array.from({ length: 64 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{
            backgroundColor: 'rgba(100, 108, 255, 0.3)',
            animation: `flicker ${Math.random() * 5 + 2}s ease-in-out infinite ${Math.random() * 5}s`,
          }}
        />
      ))}
      <style jsx global>{`
        @keyframes flicker {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

export function AnimatedText({
  text,
  className,
  highlightColor = 'text-blue-500',
  children,
}: {
  text?: string;
  className?: string;
  highlightColor?: string;
  children?: React.ReactNode;
}) {
  const content = text || (children ? String(children) : '');

  return (
    <span className={className}>
      {content.split('').map((char, index) => (
        <span
          key={index}
          className={`inline-block transition-all ${highlightColor}`}
          style={{
            animation: `textReveal 0.5s ease forwards ${index * 0.05}s`,
            opacity: 0,
            transform: 'translateY(10px)',
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
      <style jsx global>{`
        @keyframes textReveal {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </span>
  );
}

export function AuroraText({
  text,
  className,
  gradientColors = ['#ff7eb9', '#7eb8ff', '#ff65a7', '#7ea0ff'],
  children,
}: {
  text?: string;
  className?: string;
  gradientColors?: string[];
  children?: React.ReactNode;
}) {
  const content = text || (children ? String(children) : '');
  
  return (
    <span
      className={`relative inline-block ${className}`}
      style={{
        background: `linear-gradient(to right, ${gradientColors.join(', ')})`,
        backgroundSize: '200% 200%',
        animation: 'gradient 8s ease infinite',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}
    >
      {content}
      <style jsx global>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </span>
  );
}