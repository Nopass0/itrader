"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApiCheck } from '@/hooks/useApiCheck';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ApiStatus() {
  const { isOnline, isChecking, error, checkApi } = useApiCheck();
  const [showRetry, setShowRetry] = useState(false);

  // Show retry button after a delay if offline
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    if (!isOnline && !isChecking) {
      timeout = setTimeout(() => {
        setShowRetry(true);
      }, 3000);
    } else {
      setShowRetry(false);
    }
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [isOnline, isChecking]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg p-4 sm:p-5 md:p-6 bg-card/30 backdrop-blur-sm shadow-sm w-full max-w-md mx-auto glass"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isChecking ? (
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : isOnline ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-destructive" />
          )}
          
          <span className="text-sm font-medium">
            Статус сервера: {isChecking ? "Проверка..." : isOnline ? "Онлайн" : "Офлайн"}
          </span>
        </div>
        
        {showRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => checkApi()}
            disabled={isChecking}
          >
            {isChecking ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Повторить
          </Button>
        )}
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </motion.div>
  );
}