"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/hooks/useSocket';
import { Unlock, AlertTriangle, RefreshCw } from 'lucide-react';

interface ReleaseMoneyButtonProps {
  transactionId: string;
  orderId?: string;
  amount: number;
  status: string;
  className?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  onSuccess?: () => void;
}

export function ReleaseMoneyButton({
  transactionId,
  orderId,
  amount,
  status,
  className,
  size = 'sm',
  variant = 'destructive',
  onSuccess
}: ReleaseMoneyButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const { socket } = useSocket();
  const { toast } = useToast();

  // Get current user
  const userStr = localStorage.getItem('systemAccount');
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Only show for admin users and specific statuses
  const canRelease = currentUser?.role === 'admin' && 
    (status === 'appeal' || status === 'waiting_payment' || status === 'payment_sent');

  if (!canRelease) {
    return null;
  }

  const handleRelease = async () => {
    if (!socket?.connected) {
      toast({
        title: 'Ошибка',
        description: 'Нет соединения с сервером',
        variant: 'destructive'
      });
      return;
    }

    setReleasing(true);

    try {
      socket.emit('transactions:releaseMoney', {
        transactionId,
        orderId
      }, (response: any) => {
        if (response.success) {
          toast({
            title: 'Успешно',
            description: 'Деньги успешно отпущены покупателю'
          });
          setShowDialog(false);
          onSuccess?.();
        } else {
          toast({
            title: 'Ошибка',
            description: response.error?.message || 'Не удалось отпустить деньги',
            variant: 'destructive'
          });
        }
        setReleasing(false);
      });
    } catch (error) {
      console.error('Release money error:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при отпуске денег',
        variant: 'destructive'
      });
      setReleasing(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowDialog(true)}
      >
        <Unlock size={size === 'sm' ? 12 : 16} className="mr-1" />
        Отпустить деньги
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive" size={20} />
              Подтверждение отпуска денег
            </DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите отпустить деньги покупателю?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm font-medium text-destructive">
                Внимание! Это действие необратимо.
              </p>
              <p className="text-sm mt-2">
                Деньги будут отправлены покупателю без получения чека об оплате.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ID транзакции:</span>
                <span className="font-mono text-sm">{transactionId}</span>
              </div>
              {orderId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">ID ордера:</span>
                  <span className="font-mono text-sm">{orderId}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Сумма:</span>
                <span className="font-semibold">{amount.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={releasing}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={handleRelease}
              disabled={releasing}
            >
              {releasing ? (
                <>
                  <RefreshCw className="animate-spin mr-2" size={16} />
                  Отпускаем...
                </>
              ) : (
                <>
                  <Unlock className="mr-2" size={16} />
                  Отпустить деньги
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}