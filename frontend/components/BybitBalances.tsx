"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/use-toast';
import {
  Wallet,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BybitBalance {
  accountId: string;
  email: string;
  balance: number;
  currency: string;
  lastUpdate: string;
  isActive: boolean;
}

export function BybitBalances({ className }: { className?: string }) {
  const [balances, setBalances] = useState<BybitBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { socket } = useSocket();
  const { toast } = useToast();

  const loadBalances = async () => {
    if (!socket?.connected) return;

    try {
      setLoading(true);
      
      socket.emit('bybit:getBalances', {}, (response: any) => {
        if (response.success) {
          setBalances(response.data.balances || []);
        } else {
          console.error('Failed to load Bybit balances:', response.error);
          toast({
            title: 'Ошибка',
            description: 'Не удалось загрузить балансы Bybit',
            variant: 'destructive'
          });
        }
        setLoading(false);
      });
    } catch (error) {
      console.error('Error loading balances:', error);
      setLoading(false);
    }
  };

  const refreshBalances = async () => {
    if (!socket?.connected || refreshing) return;

    setRefreshing(true);
    
    socket.emit('bybit:refreshBalances', {}, (response: any) => {
      if (response.success) {
        setBalances(response.data.balances || []);
        toast({
          title: 'Успешно',
          description: 'Балансы обновлены'
        });
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось обновить балансы',
          variant: 'destructive'
        });
      }
      setRefreshing(false);
    });
  };

  useEffect(() => {
    if (socket?.connected) {
      loadBalances();
    }
  }, [socket?.connected]);

  // Subscribe to balance updates
  useEffect(() => {
    if (!socket) return;

    const handleBalanceUpdate = (data: any) => {
      setBalances(data.balances || []);
    };

    socket.on('bybit:balanceUpdate', handleBalanceUpdate);

    return () => {
      socket.off('bybit:balanceUpdate', handleBalanceUpdate);
    };
  }, [socket]);

  const formatBalance = (balance: number) => {
    return balance.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const getTotalBalance = () => {
    return balances.reduce((sum, account) => sum + account.balance, 0);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet size={20} />
            Балансы Bybit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet size={20} />
            Балансы Bybit
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshBalances}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={cn("mr-1", refreshing && "animate-spin")} />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {balances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet size={48} className="mx-auto mb-2 opacity-50" />
            <p>Нет активных аккаунтов Bybit</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Total balance */}
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-primary" />
                  <span className="font-medium">Общий баланс</span>
                </div>
                <span className="text-lg font-bold">
                  {formatBalance(getTotalBalance())} RUB
                </span>
              </div>
            </div>

            {/* Individual accounts */}
            {balances.map((account) => (
              <div
                key={account.accountId}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  account.isActive 
                    ? "bg-card hover:bg-muted/50" 
                    : "bg-muted/30 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    account.isActive ? "bg-green-100 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-900/20"
                  )}>
                    <User size={16} className={account.isActive ? "text-green-600" : "text-gray-600"} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{account.email}</span>
                      {account.isActive ? (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle2 size={10} className="mr-1" />
                          Активен
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <AlertCircle size={10} className="mr-1" />
                          Неактивен
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Обновлено: {new Date(account.lastUpdate).toLocaleTimeString('ru-RU')}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-mono font-semibold">
                    {formatBalance(account.balance)}
                  </div>
                  <span className="text-xs text-muted-foreground">{account.currency}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}