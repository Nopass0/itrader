"use client";

import { useEffect, useState } from 'react';
import { socketApi } from '@/services/socket-api';

export function ConnectionDebug() {
  const [status, setStatus] = useState({
    isConnected: false,
    socketId: null,
    lastCheck: null,
    error: null
  });

  useEffect(() => {
    const checkConnection = async () => {
      try {
        console.log('[ConnectionDebug] Checking connection...');
        
        // Try to connect
        await socketApi.connect();
        
        // Check if connected
        const isConnected = socketApi.isConnected();
        console.log('[ConnectionDebug] Is connected:', isConnected);
        
        if (isConnected) {
          // Try health check
          const healthResponse = await socketApi.emit('health:check');
          console.log('[ConnectionDebug] Health response:', healthResponse);
          
          setStatus({
            isConnected: true,
            socketId: (socketApi as any).socket?.id || 'unknown',
            lastCheck: new Date().toISOString(),
            error: null
          });
        } else {
          setStatus({
            isConnected: false,
            socketId: null,
            lastCheck: new Date().toISOString(),
            error: 'Not connected'
          });
        }
      } catch (err) {
        console.error('[ConnectionDebug] Error:', err);
        setStatus({
          isConnected: false,
          socketId: null,
          lastCheck: new Date().toISOString(),
          error: err.message
        });
      }
    };

    // Check immediately
    checkConnection();

    // Check every 5 seconds
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 10,
      right: 10,
      background: status.isConnected ? '#4CAF50' : '#f44336',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999
    }}>
      <div>Socket: {status.isConnected ? '✅ Connected' : '❌ Disconnected'}</div>
      {status.socketId && <div>ID: {status.socketId}</div>}
      {status.error && <div>Error: {status.error}</div>}
      <div>Last check: {status.lastCheck}</div>
    </div>
  );
}