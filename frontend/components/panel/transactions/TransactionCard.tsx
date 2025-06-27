"use client";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  MessageSquare,
  Copy,
  Hash,
  User,
  DollarSign,
  Building2,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Transaction } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { copyToClipboard } from '@/lib/clipboard';

interface TransactionCardProps {
  transaction: Transaction;
  onOpenChat?: () => void;
  onViewDetails: () => void;
}

export function TransactionCard({ 
  transaction, 
  onOpenChat,
  onViewDetails 
}: TransactionCardProps) {
  const { toast } = useToast();

  const handleCopyToClipboard = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      toast({
        title: "Скопировано",
        description: `${label} скопирован в буфер обмена`,
      });
    } else {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать в буфер обмена",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'pending': { label: 'Ожидание', className: 'bg-yellow-500/10 text-yellow-500' },
      'order_created': { label: 'Ордер создан', className: 'bg-blue-500/10 text-blue-500' },
      'chat_started': { label: 'Чат начат', className: 'bg-purple-500/10 text-purple-500' },
      'payment_received': { label: 'Оплачено', className: 'bg-green-500/10 text-green-500' },
      'check_received': { label: 'Чек получен', className: 'bg-indigo-500/10 text-indigo-500' },
      'release_money': { label: 'Отпуск средств', className: 'bg-pink-500/10 text-pink-500' },
      'completed': { label: 'Завершено', className: 'bg-green-600/10 text-green-600' },
      'cancelled': { label: 'Отменено', className: 'bg-red-500/10 text-red-500' },
      'failed': { label: 'Ошибка', className: 'bg-red-600/10 text-red-600' },
    };

    const config = statusMap[status] || { label: status, className: 'bg-gray-500/10 text-gray-500' };
    
    return (
      <Badge variant="outline" className={cn("text-xs", config.className)}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card className="hover:shadow-md transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                transaction.advertisement?.type === 'buy' 
                  ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              )}
            >
              {transaction.advertisement?.type === 'buy' ? (
                <>
                  <TrendingDown size={12} className="mr-1" />
                  ПОКУПКА
                </>
              ) : (
                <>
                  <TrendingUp size={12} className="mr-1" />
                  ПРОДАЖА
                </>
              )}
            </Badge>
            {getStatusBadge(transaction.status)}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDate(transaction.createdAt)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Amount */}
        <div>
          <div className="font-semibold text-lg">
            {formatAmount(transaction.amount)}
          </div>
          {transaction.advertisement?.price && (
            <div className="text-xs text-muted-foreground">
              Курс: {transaction.advertisement.price} ₽/USDT
            </div>
          )}
        </div>

        {/* Order ID */}
        {transaction.orderId && (
          <div className="flex items-center gap-1 text-xs">
            <Hash size={12} className="text-muted-foreground" />
            <span className="font-mono">{transaction.orderId}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0"
              onClick={() => handleCopyToClipboard(transaction.orderId!, 'Order ID')}
            >
              <Copy size={10} />
            </Button>
          </div>
        )}

        {/* Counterparty */}
        {transaction.counterpartyName && (
          <div className="flex items-center gap-1 text-xs">
            <User size={12} className="text-muted-foreground" />
            <span>{transaction.counterpartyName}</span>
          </div>
        )}

        {/* Accounts */}
        <div className="space-y-1 text-xs">
          {transaction.advertisement?.bybitAccount && (
            <div className="flex items-center gap-1">
              <Building2 size={12} className="text-muted-foreground" />
              <span>Bybit: {transaction.advertisement.bybitAccount.accountId}</span>
            </div>
          )}
          {transaction.payout?.gateAccount && (
            <div className="flex items-center gap-1">
              <Building2 size={12} className="text-muted-foreground" />
              <span>Платформа 1: {transaction.payout.gateAccount}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        {transaction.stageProgress !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Прогресс</span>
              <span>{transaction.stageProgress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div 
                className="bg-primary rounded-full h-1.5 transition-all"
                style={{ width: `${transaction.stageProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs flex-1"
            onClick={onViewDetails}
          >
            <Eye size={12} className="mr-1" />
            Детали
          </Button>
          {transaction.orderId && onOpenChat && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs flex-1"
              onClick={onOpenChat}
            >
              <MessageSquare size={12} className="mr-1" />
              Чат
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}