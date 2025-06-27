"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ShoppingCart,
  Eye, 
  Hash, 
  DollarSign,
  User,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: any;
  onViewDetails: () => void;
}

export function OrderCard({ order, onViewDetails }: OrderCardProps) {
  const { toast } = useToast();

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

  const getStatusBadge = (status: string | number) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      'PENDING': { text: 'Ожидание', className: 'bg-yellow-500/10 text-yellow-500' },
      'ONGOING': { text: 'В процессе', className: 'bg-blue-500/10 text-blue-500' },
      'BUYER_PAID': { text: 'Оплачено', className: 'bg-purple-500/10 text-purple-500' },
      'COMPLETED': { text: 'Завершено', className: 'bg-green-500/10 text-green-500' },
      'CANCELLED': { text: 'Отменено', className: 'bg-red-500/10 text-red-500' },
      'APPEAL': { text: 'Апелляция', className: 'bg-orange-500/10 text-orange-500' }
    };

    const statusKey = typeof status === 'string' ? status : String(status);
    const config = statusMap[statusKey] || { text: statusKey, className: 'bg-gray-500/10 text-gray-500' };

    return (
      <Badge variant="outline" className={cn("text-xs", config.className)}>
        {config.text}
      </Badge>
    );
  };

  return (
    <Card className="p-3 hover:shadow-md transition-all hover:border-primary/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-muted-foreground" />
          <Badge variant="outline" className="text-xs">
            {order.side === 0 || order.side === 'buy' ? (
              <>
                <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                Покупка
              </>
            ) : (
              <>
                <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                Продажа
              </>
            )}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(order.createdAt || order.orderMtime)}
        </span>
      </div>
      
      {/* Order ID */}
      {(order.orderId || order.id) && (
        <div className="flex items-center gap-1 text-xs mb-2">
          <Hash size={12} className="text-muted-foreground" />
          <span className="font-mono">{order.orderId || order.id}</span>
        </div>
      )}

      {/* Amount */}
      <div className="font-semibold text-lg mb-2">
        {formatAmount(order.amount)}
      </div>

      {/* Status */}
      <div className="mb-2">
        {getStatusBadge(order.orderStatus || order.status)}
      </div>

      {/* Counterparty */}
      {order.buyerNickname && (
        <div className="flex items-center gap-1 text-xs mb-2">
          <User size={12} className="text-muted-foreground" />
          <span>{order.buyerNickname}</span>
        </div>
      )}

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
      </div>
    </Card>
  );
}