"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Copy, 
  Eye, 
  Hash, 
  Building2,
  MessageSquare,
  DollarSign,
  TrendingUp,
  TrendingDown,
  User,
  ArrowRightLeft
} from 'lucide-react';
import { ReceiptPopover } from '@/components/ReceiptPopover';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Transaction } from '@/hooks/useTransactions';
import { StageTimer } from '../StageTimer';
import { getStageTimestamp } from '../utils/getStageTimestamp';
import { ReleaseMoneyButton } from '@/components/ReleaseMoneyButton';

interface TransactionCardProps {
  transaction: Transaction;
  stage: number;
  unreadCount?: number;
  onViewDetails: () => void;
  onOpenChat?: () => void;
  currentUser?: any;
}

export function TransactionCard({ 
  transaction, 
  stage, 
  unreadCount = 0,
  onViewDetails,
  onOpenChat,
  currentUser
}: TransactionCardProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано",
      description: `${label} скопирован в буфер обмена`,
    });
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number | null | undefined, currency: string = 'RUB') => {
    if (amount === null || amount === undefined) return '-';
    if (currency === 'USDT') {
      return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT`;
    }
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const getStageSpecificInfo = () => {
    switch (stage) {
      case 2: // Order
        return (
          <>
            <div className="text-xs text-muted-foreground mb-1">
              Ожидание начала чата
            </div>
          </>
        );
      case 3: // Chat
        return (
          <>
            <div className="text-xs text-muted-foreground mb-1">
              Чат начат {transaction.chatStartedAt ? formatDate(transaction.chatStartedAt) : ''}
            </div>
          </>
        );
      case 4: // Paid
        return (
          <>
            <div className="text-xs text-green-600 mb-1">
              Оплачено контрагентом
            </div>
          </>
        );
      case 5: // Check confirmed
        return (
          <>
            <div className="text-xs text-blue-600 mb-1">
              Чек получен {transaction.checkReceivedAt ? formatDate(transaction.checkReceivedAt) : ''}
            </div>
          </>
        );
      case 6: // Release money
        return (
          <>
            <div className="text-xs text-purple-600 mb-1">
              Ожидание отпуска средств
            </div>
          </>
        );
      case 7: // Completed
        return (
          <>
            <div className="text-xs text-green-600 mb-1">
              Завершено {transaction.completedAt ? formatDate(transaction.completedAt) : ''}
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="p-3 hover:shadow-md transition-all hover:border-primary/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
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
          <span className="text-xs text-muted-foreground">
            {formatDate(transaction.createdAt)}
          </span>
        </div>
        {/* Stage timer */}
        {(() => {
          const stageTimestamp = getStageTimestamp(transaction, stage);
          return stageTimestamp ? <StageTimer timestamp={stageTimestamp} /> : null;
        })()}
      </div>

      {/* Stage specific info */}
      {getStageSpecificInfo()}

      {/* Amount and Price */}
      <div className="space-y-1 mb-2">
        <div className="font-semibold text-lg">
          {formatAmount(transaction.amount)}
        </div>
        {transaction.advertisement?.price && (
          <div className="text-xs text-muted-foreground">
            Курс: {transaction.advertisement.price} ₽/USDT
          </div>
        )}
        {transaction.amount && transaction.advertisement?.price && (
          <div className="text-xs text-muted-foreground">
            USDT: {(transaction.amount / transaction.advertisement.price).toFixed(2)}
          </div>
        )}
      </div>

      {/* Order ID */}
      {transaction.orderId && (
        <div className="flex items-center gap-1 text-xs mb-2">
          <Hash size={12} className="text-muted-foreground" />
          <span className="font-mono">{transaction.orderId}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0"
            onClick={() => copyToClipboard(transaction.orderId!, 'Order ID')}
          >
            <Copy size={10} />
          </Button>
        </div>
      )}

      {/* Counterparty */}
      {transaction.counterpartyName && (
        <div className="flex items-center gap-1 text-xs mb-2">
          <User size={12} className="text-muted-foreground" />
          <span>{transaction.counterpartyName}</span>
        </div>
      )}

      {/* Exchange Rate from payout meta */}
      {transaction.payout?.meta?.courses?.trader && (
        <div className="flex items-center gap-1 text-xs mb-2 text-muted-foreground">
          <ArrowRightLeft size={12} />
          <span>Курс захода: {(transaction.payout.meta.courses.trader * 0.979).toFixed(2)} RUB/USDT</span>
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

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t">
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
            className="h-7 px-2 text-xs flex-1 relative"
            onClick={onOpenChat}
          >
            <MessageSquare size={12} className="mr-1" />
            Чат
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 text-[10px] font-bold"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        )}
        {transaction.payout?.id && (
          <ReceiptPopover 
            payoutId={transaction.payout.id}
            transactionId={transaction.id}
          />
        )}
        {currentUser?.role === 'admin' && 
         (transaction.status === 'appeal' || transaction.status === 'waiting_payment' || transaction.status === 'payment_sent') && (
          <ReleaseMoneyButton
            transactionId={transaction.id}
            orderId={transaction.orderId}
            amount={transaction.amount || 0}
            status={transaction.status}
            size="sm"
            variant="destructive"
            className="h-7 px-2 text-xs flex-1"
          />
        )}
      </div>
    </Card>
  );
}