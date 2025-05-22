'use client'

import { useEffect } from 'react'
import { websocketService } from '@/services/websocket'

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // WebSocket service is automatically initialized when imported
    // We just need to ensure it's connected when the app starts
    
    const cleanup = () => {
      websocketService.disconnect()
    }

    // Cleanup on unmount
    return cleanup
  }, [])

  return <>{children}</>
}