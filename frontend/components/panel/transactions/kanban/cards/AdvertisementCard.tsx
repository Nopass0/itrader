"use client";

import { useState } from 'react';
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
  CheckCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Advertisement } from '@/hooks/useTransactions';
import { StageTimer } from '../StageTimer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AdvertisementCardProps {
  advertisement: Advertisement;
  onViewDetails: () => void;
}

export function AdvertisementCard({ advertisement, onViewDetails }: AdvertisementCardProps) {
  const { socket } = useSocket();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newPrice, setNewPrice] = useState(advertisement.price.toString());
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs flex-1"
          onClick={() => setIsEditDialogOpen(true)}
        >
          <Edit size={12} className="mr-1" />
          Изменить курс
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => setIsDeleteDialogOpen(true)}
        >
          <Trash2 size={12} />
        </Button>
      </div>
    </Card>

      {/* Edit Price Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Изменить курс объявления</DialogTitle>
            <DialogDescription>
              Текущий курс: {advertisement.price} ₽/USDT
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Новый курс
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="col-span-3"
                placeholder="Введите новый курс"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setNewPrice(advertisement.price.toString());
              }}
            >
              Отмена
            </Button>
            <Button 
              onClick={async () => {
                const price = parseFloat(newPrice);
                if (isNaN(price) || price <= 0) {
                  toast({
                    title: "Ошибка",
                    description: "Введите корректный курс",
                    variant: "destructive",
                  });
                  return;
                }

                setIsUpdating(true);
                socket.emit('bybitAdvertisements:update', {
                  itemId: advertisement.itemId,
                  updates: { price }
                }, (response: any) => {
                  setIsUpdating(false);
                  if (response.success) {
                    toast({
                      title: "Успешно",
                      description: `Курс изменен на ${price} ₽/USDT`,
                    });
                    setIsEditDialogOpen(false);
                  } else {
                    toast({
                      title: "Ошибка",
                      description: response.error?.message || "Не удалось изменить курс",
                      variant: "destructive",
                    });
                  }
                });
              }}
              disabled={isUpdating}
            >
              {isUpdating ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить объявление?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить это объявление? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setIsDeleting(true);
                socket.emit('bybitAdvertisements:delete', {
                  itemId: advertisement.itemId,
                  bybitAccountId: advertisement.bybitAccountId
                }, (response: any) => {
                  setIsDeleting(false);
                  if (response.success) {
                    toast({
                      title: "Успешно",
                      description: "Объявление удалено",
                    });
                  } else {
                    toast({
                      title: "Ошибка",
                      description: response.error?.message || "Не удалось удалить объявление",
                      variant: "destructive",
                    });
                  }
                });
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}