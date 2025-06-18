'use client'

import { useEffect, useRef } from 'react'
import { getWebSocketService } from '@/services/websocket'

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false)
  const mounted = useRef(true)
  
  useEffect(() => {
    // Set mounted flag
    mounted.current = true
    
    // Prevent double initialization in StrictMode
    if (initialized.current) {
      console.log('WebSocketProvider: Already initialized, skipping')
      return
    }
    
    // Add a small delay to ensure we're not in a rapid mount/unmount cycle
    const timer = setTimeout(() => {
      if (mounted.current && !initialized.current) {
        console.log('WebSocketProvider: Initializing WebSocket')
        initialized.current = true
        getWebSocketService().initialize()
      }
    }, 100)
    
    // Cleanup on unmount
    return () => {
      mounted.current = false
      clearTimeout(timer)
      
      // In development with StrictMode, this will be called immediately
      // So we use a timeout to check if we're really unmounting
      setTimeout(() => {
        if (!mounted.current) {
          console.log('WebSocketProvider: Component unmounted, resetting')
          initialized.current = false
          // Only disconnect in production
          if (process.env.NODE_ENV === 'production') {
            getWebSocketService().disconnect()
          }
        }
      }, 200)
    }
  }, [])

  return <>{children}</>
}