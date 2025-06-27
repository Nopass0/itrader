"use client";

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  DollarSign,
  FileText,
  Banknote,
  Copy,
  Eye,
  ChevronLeft,
  ChevronRight,
  Hash,
  Building2,
  Wallet,
  ShoppingCart,
  UserCheck,
  FileCheck,
  Send,
  CheckCircle2,
  UserX,
  AlertTriangle,
  Coins,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Transaction } from '@/hooks/useTransactions';
import { copyToClipboard } from '@/lib/clipboard';
import { useToast } from '@/components/ui/use-toast';

interface StatusViewProps {
  transactions: Transaction[];
  payouts?: any[];
  advertisements?: any[];
  orders?: any[];
  loading?: boolean;
  onRefresh?: () => void;
  onViewDetails?: (transaction: Transaction) => void;
  onOpenChat?: (transaction: Transaction) => void;
}


// Define all possible statuses - kanban stages first, then regular statuses, then "all" at the end
const TRANSACTION_STATUSES = [
  {
    id: 'stage_0',
    label: 'Выплаты',
    icon: Wallet,
    color: 'bg-slate-500',
    textColor: 'text-slate-500',
    isKanbanStage: true,
    stageId: 0,
  },
  {
    id: 'stage_1',
    label: 'Объявления',
    icon: FileText,
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
    isKanbanStage: true,
    stageId: 1,
  },
  {
    id: 'stage_2',
    label: 'Ордер',
    icon: ShoppingCart,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-500',
    isKanbanStage: true,
    stageId: 2,
  },
  {
    id: 'stage_3',
    label: 'Чат',
    icon: MessageSquare,
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
    isKanbanStage: true,
    stageId: 3,
  },
  {
    id: 'stage_4',
    label: 'Оплачено контрагентом',
    icon: UserCheck,
    color: 'bg-violet-500',
    textColor: 'text-violet-500',
    isKanbanStage: true,
    stageId: 4,
  },
  {
    id: 'stage_5',
    label: 'Чек подтверждён',
    icon: FileCheck,
    color: 'bg-green-500',
    textColor: 'text-green-500',
    isKanbanStage: true,
    stageId: 5,
  },
  {
    id: 'stage_6',
    label: 'Отпуск средств',
    icon: Send,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
    isKanbanStage: true,
    stageId: 6,
  },
  {
    id: 'stage_7',
    label: 'Завершено',
    icon: CheckCircle2,
    color: 'bg-teal-500',
    textColor: 'text-teal-500',
    isKanbanStage: true,
    stageId: 7,
  },
  {
    id: 'stage_8',
    label: 'Отменено контрагентом',
    icon: UserX,
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    isKanbanStage: true,
    stageId: 8,
  },
  {
    id: 'stage_9',
    label: 'Апелляция',
    icon: AlertTriangle,
    color: 'bg-red-500',
    textColor: 'text-red-500',
    isKanbanStage: true,
    stageId: 9,
  },
  {
    id: 'stage_10',
    label: 'Оплата отмененной сделки',
    icon: Coins,
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    isKanbanStage: true,
    stageId: 10,
  },
  {
    id: 'stage_11',
    label: 'Прочее',
    icon: HelpCircle,
    color: 'bg-gray-500',
    textColor: 'text-gray-500',
    isKanbanStage: true,
    stageId: 11,
  },
  {
    id: 'pending',
    label: 'Ожидание',
    icon: Clock,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
  },
  {
    id: 'order_created',
    label: 'Ордер создан',
    icon: TrendingUp,
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
  },
  {
    id: 'completed',
    label: 'Завершено',
    icon: CheckCircle,
    color: 'bg-green-600',
    textColor: 'text-green-600',
  },
  {
    id: 'cancelled',
    label: 'Отменено',
    icon: XCircle,
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
  {
    id: 'all',
    label: 'Все',
    icon: FileText,
    color: 'bg-gray-500',
    textColor: 'text-gray-500',
  },
];

export function StatusView({ 
  transactions, 
  payouts = [], 
  advertisements = [], 
  orders = [], 
  loading = false, 
  onRefresh, 
  onViewDetails, 
  onOpenChat 
}: StatusViewProps) {
  const [activeStatus, setActiveStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { toast } = useToast();

  // Group all items by status and kanban stages
  const itemsByStatus = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    // Initialize all statuses with empty arrays
    TRANSACTION_STATUSES.forEach(status => {
      grouped[status.id] = [];
    });

    // Helper function to map transaction to kanban stage
    const mapTransactionToKanbanStage = (transaction: Transaction): number => {
      // Check if this transaction has a payout with status < 7
      const payout = payouts.find(p => p.transactionId === transaction.id);
      if (payout && payout.status < 7) {
        return 0; // Stage 0: Payouts
      }

      switch (transaction.status) {
        case 'pending':
          if (!transaction.advertisementId) return 11;
          if (!transaction.orderId) return 1;
          return 2;
        case 'order_created':
        case 'order_pending':
          return 2;
        case 'chat_started':
          return 3;
        case 'payment_received':
        case 'waiting_payment':
          return 4;
        case 'check_received':
        case 'receipt_received':
          return 5;
        case 'release_money':
          return 6;
        case 'completed':
          return 7;
        case 'cancelled_by_counterparty':
          return 8;
        case 'failed':
        case 'cancelled':
          if (transaction.customStatuses?.some(s => s.includes('dispute'))) {
            return 9;
          }
          return 10;
        default:
          return 11;
      }
    };

    // Add all items to 'all' group
    const allItems: any[] = [];

    // Group transactions
    transactions.forEach(transaction => {
      const status = transaction.status || 'pending';
      
      // Add to status groups
      if (grouped[status]) {
        grouped[status].push(transaction);
      }
      
      // Add to kanban stage groups
      const stage = mapTransactionToKanbanStage(transaction);
      const stageId = `stage_${stage}`;
      if (grouped[stageId]) {
        grouped[stageId].push(transaction);
      }
      
      allItems.push(transaction);
    });

    // Add payouts with status < 7 to stage 0
    payouts
      .filter(payout => payout.status < 7)
      .forEach(payout => {
        const item = {
          ...payout,
          type: 'payout',
        };
        grouped['stage_0'].push(item);
        allItems.push(item);
      });

    // Add active advertisements to stage 1
    advertisements
      .filter(ad => ad.isActive)
      .forEach(ad => {
        const item = {
          ...ad,
          type: 'advertisement',
        };
        grouped['stage_1'].push(item);
        allItems.push(item);
      });

    // Add orders to stage 2
    if (orders) {
      orders.forEach(order => {
        const item = {
          ...order,
          type: 'order',
          id: order.orderId || order.id,
          amount: order.amount || 0,
          createdAt: order.createdAt || order.orderMtime || new Date().toISOString(),
        };
        grouped['stage_2'].push(item);
        allItems.push(item);
      });
    }

    // Add all items to 'all' group
    grouped['all'] = allItems;

    return grouped;
  }, [transactions, payouts, advertisements, orders]);


  const filteredItems = itemsByStatus[activeStatus] || [];

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when status changes
  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
    setCurrentPage(1);
  };

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = TRANSACTION_STATUSES.find(s => s.id === status);
    if (!statusInfo) return null;
    
    const Icon = statusInfo.icon;
    return (
      <Badge variant="outline" className={cn("text-xs gap-1", statusInfo.color + '/10', statusInfo.textColor)}>
        <Icon size={12} />
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeStatus} onValueChange={handleStatusChange} className="h-full flex flex-col">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap flex-shrink-0">
          {TRANSACTION_STATUSES.map(status => {
            const Icon = status.icon;
            const count = itemsByStatus[status.id]?.length || 0;
            
            return (
              <TabsTrigger 
                key={status.id} 
                value={status.id}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <Icon size={16} className={status.textColor} />
                <span>{status.label}</span>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-1 text-xs",
                    activeStatus === status.id && status.color + ' text-white'
                  )}
                >
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

          <TabsContent value={activeStatus} className="flex-1 mt-4 flex flex-col">
            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr className="text-xs text-muted-foreground">
                      <th className="text-left px-3 py-2 font-medium">ID / Ордер</th>
                      <th className="text-left px-3 py-2 font-medium">Дата</th>
                      <th className="text-left px-3 py-2 font-medium">Тип</th>
                      <th className="text-right px-3 py-2 font-medium">Сумма</th>
                      <th className="text-left px-3 py-2 font-medium">Статус</th>
                      <th className="text-left px-3 py-2 font-medium">Аккаунты</th>
                      <th className="text-center px-3 py-2 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8">
                          <div className="text-muted-foreground">Загрузка...</div>
                        </td>
                      </tr>
                    ) : paginatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8">
                          <div className="text-muted-foreground">
                            Нет транзакций
                            {activeStatus !== 'all' && ` со статусом "${TRANSACTION_STATUSES.find(s => s.id === activeStatus)?.label}"`}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedItems.map((item) => {
                        // Handle different item types
                        const isTransaction = item.type !== 'payout' && item.type !== 'advertisement' && item.type !== 'order';
                        const isPayout = item.type === 'payout';
                        const isAdvertisement = item.type === 'advertisement';
                        const isOrder = item.type === 'order';

                        return (
                          <tr key={item.id} className="hover:bg-muted/50 transition-colors border-b">
                            <td className="px-3 py-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-xs">
                                    {item.id.slice(0, 6)}...
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0"
                                    onClick={() => handleCopyToClipboard(item.id, "ID")}
                                  >
                                    <Copy size={10} />
                                  </Button>
                                </div>
                                {(item.orderId || item.orderNo) && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Hash size={10} />
                                    {item.orderId || item.orderNo}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-xs">
                                {formatDate(item.createdAt || item.lastModifyTime || item.createdTime)}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {isTransaction && item.advertisement && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    item.advertisement.type === "buy"
                                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                                      : "bg-red-500/10 text-red-500 border-red-500/20"
                                  )}
                                >
                                  {item.advertisement.type === "buy" ? (
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
                              )}
                              {isPayout && (
                                <Badge variant="outline" className="text-xs bg-slate-500/10 text-slate-500">
                                  <Wallet size={12} className="mr-1" />
                                  ВЫПЛАТА
                                </Badge>
                              )}
                              {isAdvertisement && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    item.type === "buy"
                                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                                      : "bg-red-500/10 text-red-500 border-red-500/20"
                                  )}
                                >
                                  {item.type === "buy" ? (
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
                              )}
                              {isOrder && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    item.side === 0
                                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                                      : "bg-red-500/10 text-red-500 border-red-500/20"
                                  )}
                                >
                                  {item.side === 0 ? (
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
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="font-medium">
                                {formatAmount(item.amount || item.quantity)}
                              </div>
                              {(item.advertisement?.price || item.price) && (
                                <div className="text-xs text-muted-foreground">
                                  {item.advertisement?.price || item.price} ₽/USDT
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isTransaction && getStatusBadge(item.status)}
                              {isPayout && (
                                <Badge variant="outline" className="text-xs">
                                  Статус: {item.status}
                                </Badge>
                              )}
                              {isAdvertisement && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    item.isActive
                                      ? "bg-green-500/10 text-green-500"
                                      : "bg-gray-500/10 text-gray-500"
                                  )}
                                >
                                  {item.isActive ? "Активно" : "Неактивно"}
                                </Badge>
                              )}
                              {isOrder && (
                                <Badge variant="outline" className="text-xs">
                                  {item.orderStatus || item.status || 'PENDING'}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-1 text-xs">
                                {(item.advertisement?.bybitAccount || item.bybitAccount || item.bybitAccountId) && (
                                  <div className="flex items-center gap-1">
                                    <Building2 size={12} className="text-muted-foreground" />
                                    <span>Bybit: {item.advertisement?.bybitAccount?.accountId || item.bybitAccount?.accountId || item.bybitAccountId}</span>
                                  </div>
                                )}
                                {(item.payout?.gateAccount || item.gateAccount || item.gateAccountId) && (
                                  <div className="flex items-center gap-1">
                                    <Building2 size={12} className="text-muted-foreground" />
                                    <span>Platform 1: {item.payout?.gateAccount || item.gateAccount || item.gateAccountId}</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => onViewDetails?.(item)}
                                >
                                  <Eye size={12} />
                                </Button>
                                {isTransaction && item.orderId && onOpenChat && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2"
                                    onClick={() => onOpenChat(item)}
                                  >
                                    <MessageSquare size={12} />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Показано {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredItems.length)} из {filteredItems.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={14} />
                      Назад
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        if (pageNum < 1 || pageNum > totalPages) return null;

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Вперед
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}