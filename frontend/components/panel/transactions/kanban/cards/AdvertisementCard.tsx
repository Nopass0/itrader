"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Eye, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Percent,
  Clock,
  CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Advertisement } from '@/hooks/useTransactions';
import { StageTimer } from '../StageTimer';

interface AdvertisementCardProps {
  advertisement: Advertisement;
  onViewDetails: () => void;
}

export function AdvertisementCard({ advertisement, onViewDetails }: AdvertisementCardProps) {
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number | null | undefined, currency: string = 'USDT') => {
    if (amount === null || amount === undefined) {
      return '0.00 USDT';
    }
    if (currency === 'USDT') {
      return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
    }
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const getAvailabilityPercentage = () => {
    if (!advertisement.totalAmount || advertisement.totalAmount === 0) return 0;
    return Math.round((advertisement.availableAmount / advertisement.totalAmount) * 100);
  };

  const getPaymentMethodsString = () => {
    if (!advertisement.paymentMethods || advertisement.paymentMethods.length === 0) {
      return 'Не указано';
    }
    const methodNames: Record<string, string> = {
      'card': 'Карта',
      'sbp': 'СБП',
      'cash': 'Наличные',
      'bank': 'Банковский перевод'
    };
    return advertisement.paymentMethods
      .map(method => methodNames[method] || method)
      .join(', ');
  };

  return (
    <Card className="p-3 hover:shadow-md transition-all hover:border-primary/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs",
            advertisement.type === 'buy' 
              ? 'bg-green-500/10 text-green-500 border-green-500/20' 
              : 'bg-red-500/10 text-red-500 border-red-500/20'
          )}
        >
          {advertisement.type === 'buy' ? (
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
        <Badge 
          variant={advertisement.isActive ? "default" : "secondary"} 
          className={cn(
            "text-xs",
            advertisement.isActive 
              ? "bg-green-500 text-white" 
              : "bg-gray-500 text-white"
          )}
        >
          {advertisement.isActive ? (
            <>
              <Activity size={10} className="mr-1" />
              Активно
            </>
          ) : (
            <>
              <Clock size={10} className="mr-1" />
              Неактивно
            </>
          )}
        </Badge>
      </div>

      {/* Price */}
      <div className="mb-2">
        <div className="font-semibold text-lg">
          {advertisement.price} ₽/USDT
        </div>
        <div className="text-xs text-muted-foreground">
          {advertisement.currency}/{advertisement.fiat}
        </div>
      </div>
      
      {/* Stage timer */}
      {advertisement.createdAt && <StageTimer timestamp={advertisement.createdAt} className="mb-2" />}

      {/* Limits */}
      <div className="space-y-1 mb-2">
        <div className="text-xs">
          <span className="text-muted-foreground">Лимиты:</span> {formatAmount(advertisement.minOrderAmount)} - {formatAmount(advertisement.maxOrderAmount)}
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">Доступно:</span> {formatAmount(advertisement.availableAmount)}
          {advertisement.totalAmount && (
            <span className="text-muted-foreground"> из {formatAmount(advertisement.totalAmount)}</span>
          )}
        </div>
      </div>

      {/* Availability Progress */}
      {advertisement.totalAmount && advertisement.totalAmount > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Доступность</span>
            <span>{getAvailabilityPercentage()}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div 
              className="bg-primary rounded-full h-1.5 transition-all"
              style={{ width: `${getAvailabilityPercentage()}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      {(advertisement.completedOrders !== undefined || advertisement.completionRate !== undefined) && (
        <div className="flex items-center gap-3 text-xs mb-2">
          {advertisement.completedOrders !== undefined && (
            <div className="flex items-center gap-1">
              <CheckCircle size={12} className="text-green-500" />
              <span>{advertisement.completedOrders} сделок</span>
            </div>
          )}
          {advertisement.completionRate !== undefined && (
            <div className="flex items-center gap-1">
              <Percent size={12} className="text-blue-500" />
              <span>{advertisement.completionRate}%</span>
            </div>
          )}
        </div>
      )}

      {/* Payment Methods */}
      <div className="text-xs mb-2">
        <span className="text-muted-foreground">Способы оплаты:</span> {getPaymentMethodsString()}
      </div>

      {/* Bybit Account */}
      {advertisement.bybitAccount && (
        <div className="text-xs mb-2">
          <span className="text-muted-foreground">Bybit:</span> {advertisement.bybitAccount.name || advertisement.bybitAccount.id}
        </div>
      )}

      {/* Created Date */}
      <div className="text-xs text-muted-foreground">
        Создано: {formatDate(advertisement.createdAt)}
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
      </div>
    </Card>
  );
}