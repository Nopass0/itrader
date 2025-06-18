'use client'

import { useWebSocketConnection } from '@/hooks/useWebSocketEvents'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wifi, WifiOff, RotateCcw } from 'lucide-react'

export function WebSocketStatus() {
  const { isConnected, reconnect } = useWebSocketConnection()

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant={isConnected ? "default" : "destructive"}
        className="flex items-center gap-1"
      >
        {isConnected ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        {isConnected ? 'Подключен' : 'Отключен'}
      </Badge>
      
      {!isConnected && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={reconnect}
          className="h-6 px-2"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Переподключить
        </Button>
      )}
    </div>
  )
}