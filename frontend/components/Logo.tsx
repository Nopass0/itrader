'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { RobotEmoji } from '@/components/ui/animated-emoji';
import { AuroraText } from '@/components/ui/particles';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className,
  size = 'md',
  withText = true,
}) => {
  // Determine emoji size based on logo size
  const emojiSizes = {
    sm: 24,
    md: 36,
    lg: 48,
  };

  // Determine text size based on logo size
  const textSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  return (
    <div className={cn('flex flex-col items-center', withText ? 'gap-1' : '', className)}>
      <RobotEmoji size={withText ? emojiSizes[size] : emojiSizes[size]} />

      {withText && (
        <AuroraText
          gradientColors={['#4f46e5', '#06b6d4', '#8b5cf6', '#3b82f6']}
          className={cn(
            'font-bold tracking-tight',
            textSizes[size]
          )}>
          iTrader
        </AuroraText>
      )}
    </div>
  );
};

export default Logo;