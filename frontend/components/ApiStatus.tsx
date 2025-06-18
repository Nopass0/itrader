"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApiCheck } from '@/hooks/useApiCheckSingleton';
import { AlertCircle, CheckCircle2, RefreshCw, ToggleLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth';
import { Badge } from '@/components/ui/badge';
import { RobotEmoji } from '@/components/ui/animated-emoji';

export default function ApiStatus() {
  const { isOnline, isChecking, error, checkApi } = useApiCheck();
  const { isMockMode, setMockMode } = useAuthStore();
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

  // Don't auto-enable mock mode - let user decide
  // useEffect(() => {
  //   if (!isOnline && !isChecking) {
  //     setMockMode(true);
  //   }
  // }, [isOnline, isChecking, setMockMode]);

  // Toggle mock mode manually
  const toggleMockMode = () => {
    setMockMode(!isMockMode);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-lg p-4 sm:p-5 md:p-6 bg-card/30 backdrop-blur-sm shadow-sm w-full max-w-md mx-auto glass"
    >
      <div className="flex items-center justify-between mb-3">
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

      {/* Mock mode status and toggle */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary/10">
        <div className="flex items-center gap-2">
          <RobotEmoji size={18} />
          <span className="text-sm font-medium">Демо-режим:</span>

          {isMockMode ? (
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
              Включен
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20">
              Выключен
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleMockMode}
          className={`text-xs ${isMockMode ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <ToggleLeft className="h-4 w-4 mr-1" />
          {isMockMode ? "Выключить" : "Включить"}
        </Button>
      </div>

      {isMockMode && (
        <p className="mt-2 text-xs text-muted-foreground">
          В демо-режиме используются тестовые данные. Для регистрации используйте токен: <code className="bg-primary/10 px-1 py-0.5 rounded text-primary">demo</code>
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </motion.div>
  );
}