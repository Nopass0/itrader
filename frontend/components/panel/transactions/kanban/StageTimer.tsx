"use client";

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface StageTimerProps {
  timestamp: Date | string;
  className?: string;
}

export function StageTimer({ timestamp, className }: StageTimerProps) {
  const [timeInStage, setTimeInStage] = useState('');

  useEffect(() => {
    const updateTimer = () => {
      const startTime = new Date(timestamp).getTime();
      const currentTime = new Date().getTime();
      const diffInSeconds = Math.floor((currentTime - startTime) / 1000);

      if (diffInSeconds < 0) {
        setTimeInStage('0с');
        return;
      }

      const days = Math.floor(diffInSeconds / 86400);
      const hours = Math.floor((diffInSeconds % 86400) / 3600);
      const minutes = Math.floor((diffInSeconds % 3600) / 60);
      const seconds = diffInSeconds % 60;

      let timeString = '';
      
      if (days > 0) {
        timeString = `${days}д ${hours}ч`;
      } else if (hours > 0) {
        timeString = `${hours}ч ${minutes}м`;
      } else if (minutes > 0) {
        timeString = `${minutes}м ${seconds}с`;
      } else {
        timeString = `${seconds}с`;
      }

      setTimeInStage(timeString);
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div className={`flex items-center gap-1 text-xs text-muted-foreground ${className || ''}`}>
      <Clock size={10} />
      <span className="font-mono">{timeInStage}</span>
    </div>
  );
}