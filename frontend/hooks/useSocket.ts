"use client";

import { useSocketContext } from '../contexts/SocketContext';

// Для обратной совместимости
export function useSocket() {
  return useSocketContext();
}