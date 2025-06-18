"use client";

import * as React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Copy,
  ExternalLink,
  Calendar,
  Clock,
  User,
  Wallet,
  CreditCard,
  Building2,
  Hash,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  FileText,
  MessageSquare,
  Link2,
  ArrowRight,
  Globe,
  Phone,
  Mail,
  MapPin,
  Shield,
  Zap,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface DetailsDialogProps {
  item: any;
  isOpen: boolean;
  onClose: () => void;
  onOpenChat?: (orderId: string) => void;
}

export function TransactionDetailsDialog({ item, isOpen, onClose, onOpenChat }: DetailsDialogProps) {
  const { toast } = useToast();
  
  if (!item) return null;

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
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number | null | undefined, currency: string = 'RUB') => {
    if (amount === null || amount === undefined) {
      return '-';
    }
    if (currency === 'USDT') {
      return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT`;
    }
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const getStatusIcon = (status: string) => {
    const statusMap: Record<string, any> = {
      'completed': CheckCircle,
      'success': CheckCircle,
      'failed': XCircle,
      'cancelled': XCircle,
      'pending': Clock,
      'processing': Clock,
      'active': Zap,
      '5': CheckCircle, // Payout completed
      '4': XCircle, // Payout rejected
      '3': AlertCircle, // Payout confirmed
      '2': Clock, // Payout processing
      '1': Clock, // Payout created
    };
    return statusMap[status?.toString()] || Info;
  };

  const getItemType = () => {
    if (item.orderId && item.advertisementId) return 'transaction';
    if (item.orderId && !item.advertisementId) return 'order';
    if (item.bybitAdId || item.advertisementId) return 'advertisement';
    if (item.gatePayoutId) return 'payout';
    return 'unknown';
  };

  const itemType = getItemType();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">
              {itemType === 'transaction' && 'Детали транзакции'}
              {itemType === 'order' && 'Детали ордера'}
              {itemType === 'advertisement' && 'Детали объявления'}
              {itemType === 'payout' && 'Детали выплаты'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {itemType === 'transaction' && <CreditCard className="mr-1" size={12} />}
                {itemType === 'order' && <FileText className="mr-1" size={12} />}
                {itemType === 'advertisement' && <TrendingUp className="mr-1" size={12} />}
                {itemType === 'payout' && <Wallet className="mr-1" size={12} />}
                {itemType === 'transaction' && 'Транзакция'}
                {itemType === 'order' && 'Ордер'}
                {itemType === 'advertisement' && 'Объявление'}
                {itemType === 'payout' && 'Выплата'}
              </Badge>
              {item.status && (
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    item.status === 'completed' && "text-green-500 border-green-500/50",
                    item.status === 'failed' && "text-red-500 border-red-500/50",
                    item.status === 'pending' && "text-yellow-500 border-yellow-500/50"
                  )}
                >
                  {React.createElement(getStatusIcon(item.status), { size: 12, className: "mr-1" })}
                  {item.status}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-120px)]">
          <div className="p-6 pt-2 space-y-6">
            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {item.orderId && onOpenChat && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onOpenChat(item.orderId)}
                >
                  <MessageSquare size={14} className="mr-2" />
                  Открыть чат
                </Button>
              )}
              {item.id && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyToClipboard(item.id, 'ID')}
                >
                  <Copy size={14} className="mr-2" />
                  Копировать ID
                </Button>
              )}
              {item.gatePayoutId && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyToClipboard(item.gatePayoutId.toString(), 'Gate ID')}
                >
                  <Copy size={14} className="mr-2" />
                  Копировать Gate ID
                </Button>
              )}
              {itemType === 'advertisement' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => window.open(`https://www.bybit.com/fiat/trade/otc/?actionType=${item.type}&token=${item.currency}&fiat=${item.fiat}`, '_blank')}
                >
                  <ExternalLink size={14} className="mr-2" />
                  Открыть на Bybit
                </Button>
              )}
            </div>

            {/* Main Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Identification Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash size={16} />
                    Идентификация
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">ID</p>
                    <p className="font-mono text-sm">{item.id}</p>
                  </div>
                  {item.orderId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Order ID</p>
                      <p className="font-mono text-sm">{item.orderId}</p>
                    </div>
                  )}
                  {item.gatePayoutId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Gate Payout ID</p>
                      <p className="font-mono text-sm">{item.gatePayoutId}</p>
                    </div>
                  )}
                  {item.bybitAdId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bybit Ad ID</p>
                      <p className="font-mono text-sm">{item.bybitAdId}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <DollarSign size={16} />
                    Финансовая информация
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(item.amountTrader && typeof item.amountTrader === 'object' && item.amountTrader['643']) ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Сумма трейдера</p>
                      <p className="text-lg font-bold">{formatAmount(item.amountTrader['643'])}</p>
                    </div>
                  ) : item.amount !== undefined ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Сумма</p>
                      <p className="text-lg font-bold">{formatAmount(item.amount, item.currency)}</p>
                    </div>
                  ) : null}
                  {item.price && (
                    <div>
                      <p className="text-xs text-muted-foreground">Цена</p>
                      <p className="font-medium">{item.price} {item.fiat || 'RUB'}</p>
                    </div>
                  )}
                  {item.minOrderAmount && item.maxOrderAmount && (
                    <div>
                      <p className="text-xs text-muted-foreground">Лимиты</p>
                      <p className="text-sm">{item.minOrderAmount} - {item.maxOrderAmount} {item.fiat}</p>
                    </div>
                  )}
                  {item.availableAmount !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Доступно</p>
                      <p className="text-sm">{item.availableAmount} {item.currency}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Time Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar size={16} />
                    Временные метки
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.createdAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Создано</p>
                      <p className="text-sm">{formatDate(item.createdAt)}</p>
                    </div>
                  )}
                  {item.updatedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Обновлено</p>
                      <p className="text-sm">{formatDate(item.updatedAt)}</p>
                    </div>
                  )}
                  {item.completedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Завершено</p>
                      <p className="text-sm">{formatDate(item.completedAt)}</p>
                    </div>
                  )}
                  {item.approvedAt && (
                    <div>
                      <p className="text-xs text-muted-foreground">Одобрено</p>
                      <p className="text-sm">{formatDate(item.approvedAt)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Participants Information */}
            {(item.counterpartyName || item.counterpartyId || item.trader) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User size={16} />
                    Участники
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {item.counterpartyName && (
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-medium">{item.counterpartyName}</p>
                          <p className="text-xs text-muted-foreground">Контрагент</p>
                          {item.counterpartyId && (
                            <p className="text-xs font-mono mt-1">{item.counterpartyId}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {item.trader && (
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-medium">{item.trader.name || 'Трейдер'}</p>
                          <p className="text-xs text-muted-foreground">Трейдер</p>
                          {item.trader.id && (
                            <p className="text-xs font-mono mt-1">{item.trader.id}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Accounts Information */}
            {(item.advertisement?.bybitAccount || item.payout?.gateAccount || item.gateAccount || item.bybitAccountId) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 size={16} />
                    Аккаунты
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(item.advertisement?.bybitAccount || item.bybitAccountId) && (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-orange-500/10 flex items-center justify-center">
                          <Building2 size={20} className="text-orange-500" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {item.advertisement?.bybitAccount?.name || `Bybit #${item.bybitAccountId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">Bybit аккаунт</p>
                        </div>
                      </div>
                    )}
                    {(item.payout?.gateAccount || item.gateAccount) && (
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-blue-500/10 flex items-center justify-center">
                          <Building2 size={20} className="text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium">{item.payout?.gateAccount || item.gateAccount}</p>
                          <p className="text-xs text-muted-foreground">Gate аккаунт</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Information */}
            {(item.wallet || item.method || item.bank || item.paymentMethods) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Wallet size={16} />
                    Платежная информация
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.wallet && (
                    <div>
                      <p className="text-xs text-muted-foreground">Кошелек</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm">{item.wallet}</p>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(item.wallet, 'Кошелек')}
                        >
                          <Copy size={12} />
                        </Button>
                      </div>
                    </div>
                  )}
                  {item.method && (
                    <div>
                      <p className="text-xs text-muted-foreground">Метод оплаты</p>
                      <p className="text-sm">{item.method.name || item.method}</p>
                    </div>
                  )}
                  {item.bank && (
                    <div>
                      <p className="text-xs text-muted-foreground">Банк</p>
                      <p className="text-sm">{typeof item.bank === 'object' ? item.bank.name : item.bank}</p>
                    </div>
                  )}
                  {item.paymentMethods && (
                    <div>
                      <p className="text-xs text-muted-foreground">Методы оплаты</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.paymentMethods.map((method: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {method}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Status Timeline */}
            {item.customStatuses && item.customStatuses.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock size={16} />
                    История статусов
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {item.customStatuses.map((status: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="mt-1">
                          <div className={cn(
                            "h-2 w-2 rounded-full",
                            status.type === 'success' && "bg-green-500",
                            status.type === 'error' && "bg-red-500",
                            status.type === 'info' && "bg-blue-500",
                            !status.type && "bg-gray-500"
                          )} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{status.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(status.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Metadata */}
            {(item.meta || item.tooltip || item.attachments || item.remarks) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info size={16} />
                    Дополнительная информация
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.remarks && (
                    <div>
                      <p className="text-xs text-muted-foreground">Примечания</p>
                      <p className="text-sm">{item.remarks}</p>
                    </div>
                  )}
                  {item.completionRate !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Процент выполнения</p>
                      <div className="flex items-center gap-2">
                        <Progress value={item.completionRate} className="flex-1" />
                        <span className="text-sm font-medium">{item.completionRate}%</span>
                      </div>
                    </div>
                  )}
                  {item.completedOrders !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Завершенных ордеров</p>
                      <p className="text-sm font-medium">{item.completedOrders}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}