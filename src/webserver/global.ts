/**
 * Глобальный экземпляр WebSocket сервера для использования в других модулях
 */

import { Server } from 'socket.io';

let globalIO: Server | null = null;

export function setGlobalIO(io: Server) {
  globalIO = io;
}

export function getGlobalIO(): Server | null {
  return globalIO;
}