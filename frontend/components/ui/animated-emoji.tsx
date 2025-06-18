'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type TelegramEmojiCategory =
  | 'Activity'
  | 'Animals'
  | 'Food-Drink'
  | 'Flags'
  | 'Hands'
  | 'Nature'
  | 'Objects'
  | 'People'
  | 'Smileys'
  | 'Symbols'
  | 'Travel-Places';

export interface AnimatedEmojiProps {
  name: string;
  category?: TelegramEmojiCategory;
  size?: number;
  className?: string;
}

/**
 * AnimatedEmoji component that renders a Telegram animated emoji
 * Using the collection from: https://github.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis
 */
export const AnimatedEmoji: React.FC<AnimatedEmojiProps> = ({
  name,
  category = 'Smileys',
  size = 24,
  className,
  ...props
}) => {
  // Format the emoji name for the URL (spaces become %20, etc.)
  const formattedName = encodeURIComponent(name);
  
  // Base URL for the emoji
  const baseUrl = 'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis/main';
  
  // Construct the full URL
  const url = `${baseUrl}/${category}/${formattedName}.webp`;
  
  // Add key to ensure proper render/hydration
  // Ensure consistent uniqueness with a fixed key pattern
  const uniqueKey = `emoji-${category}-${name.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <img
      key={uniqueKey}
      src={url}
      alt={name}
      width={size}
      height={size}
      className={cn('inline-block', className)}
      {...props}
    />
  );
};

/**
 * Robot emoji, specifically for the iTrader logo and branding
 */
export const RobotEmoji: React.FC<Omit<AnimatedEmojiProps, 'name' | 'category'>> = (props) => {
  return (
    <AnimatedEmoji
      name="Robot"
      category="Smileys"
      {...props}
    />
  );
};

/**
 * Money Face emoji, useful for financial app
 */
export const MoneyFaceEmoji: React.FC<Omit<AnimatedEmojiProps, 'name' | 'category'>> = (props) => {
  return (
    <AnimatedEmoji
      name="Money-Mouth Face"
      category="Smileys"
      {...props}
    />
  );
};

/**
 * Chart Increasing emoji for positive trends
 */
export const ChartIncreasingEmoji: React.FC<Omit<AnimatedEmojiProps, 'name' | 'category'>> = (props) => {
  return (
    <AnimatedEmoji
      name="Chart Increasing"
      category="Objects"
      {...props}
    />
  );
};

/**
 * Money Bag emoji
 */
export const MoneyBagEmoji: React.FC<Omit<AnimatedEmojiProps, 'name' | 'category'>> = (props) => {
  return (
    <AnimatedEmoji
      name="Money Bag"
      category="Objects"
      {...props}
    />
  );
};

/**
 * Dollar Banknote emoji
 */
export const DollarEmoji: React.FC<Omit<AnimatedEmojiProps, 'name' | 'category'>> = (props) => {
  return (
    <AnimatedEmoji
      name="Dollar Banknote"
      category="Objects"
      {...props}
    />
  );
};