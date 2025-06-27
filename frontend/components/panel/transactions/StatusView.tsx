"use client";

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  loading?: boolean;
  onRefresh?: () => void;
  onViewDetails?: (transaction: Transaction) => void;
  onOpenChat?: (transaction: Transaction) => void;
}

// Kanban stages from Board.tsx
const KANBAN_STAGES = {
  0: {
    id: 0,
    title: 'Выплаты',
    icon: Wallet,
    color: 'bg-slate-500',
    textColor: 'text-slate-500',
  },
  1: {
    id: 1,
    title: 'Объявления',
    icon: FileText,
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
  },
  2: {
    id: 2,
    title: 'Ордер',
    icon: ShoppingCart,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-500',
  },
  3: {
    id: 3,
    title: 'Чат',
    icon: MessageSquare,
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
  },
  4: {
    id: 4,
    title: 'Оплачено контрагентом',
    icon: UserCheck,
    color: 'bg-violet-500',
    textColor: 'text-violet-500',
  },
  5: {
    id: 5,
    title: 'Чек подтверждён',
    icon: FileCheck,
    color: 'bg-green-500',
    textColor: 'text-green-500',
  },
  6: {
    id: 6,
    title: 'Отпуск средств',
    icon: Send,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-500',
  },
  7: {
    id: 7,
    title: 'Завершено',
    icon: CheckCircle2,
    color: 'bg-teal-500',
    textColor: 'text-teal-500',
  },
  8: {
    id: 8,
    title: 'Отменено контрагентом',
    icon: UserX,
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
  },
  9: {
    id: 9,
    title: 'Апелляция',
    icon: AlertTriangle,
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
  10: {
    id: 10,
    title: 'Оплата отмененной сделки',
    icon: Coins,
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
  },
  11: {
    id: 11,
    title: 'Прочее',
    icon: HelpCircle,
    color: 'bg-gray-500',
    textColor: 'text-gray-500',
  },
};

// Define all possible statuses
const TRANSACTION_STATUSES = [
  {
    id: 'all',
    label: 'Все',
    icon: FileText,
    color: 'bg-gray-500',
    textColor: 'text-gray-500',
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
    id: 'chat_started',
    label: 'Чат начат',
    icon: MessageSquare,
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
  },
  {
    id: 'payment_received',
    label: 'Оплачено',
    icon: DollarSign,
    color: 'bg-green-500',
    textColor: 'text-green-500',
  },
  {
    id: 'check_received',
    label: 'Чек получен',
    icon: FileText,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-500',
  },
  {
    id: 'release_money',
    label: 'Отпуск средств',
    icon: Banknote,
    color: 'bg-pink-500',
    textColor: 'text-pink-500',
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
    id: 'failed',
    label: 'Ошибка',
    icon: AlertCircle,
    color: 'bg-red-600',
    textColor: 'text-red-600',
  },
];

export function StatusView({ transactions, loading = false, onRefresh, onViewDetails, onOpenChat }: StatusViewProps) {
  const [activeStatus, setActiveStatus] = useState('all');
  const [activeKanbanStage, setActiveKanbanStage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { toast } = useToast();

  // Group transactions by status
  const transactionsByStatus = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};
    
    // Initialize all statuses with empty arrays
    TRANSACTION_STATUSES.forEach(status => {
      grouped[status.id] = [];
    });

    // Group transactions
    transactions.forEach(transaction => {
      const status = transaction.status || 'pending';
      if (grouped[status]) {
        grouped[status].push(transaction);
      } else {
        // If status doesn't exist in our list, add to 'other'
        if (!grouped['other']) {
          grouped['other'] = [];
        }
        grouped['other'].push(transaction);
      }
      
      // Also add to 'all'
      grouped['all'].push(transaction);
    });

    return grouped;
  }, [transactions]);

  // Group transactions by kanban stage
  const transactionsByKanbanStage = useMemo(() => {
    const grouped: Record<number, Transaction[]> = {};
    
    // Initialize all stages
    Object.values(KANBAN_STAGES).forEach(stage => {
      grouped[stage.id] = [];
    });

    // Map status to kanban stage (simplified version of mapStatusToStage)
    transactions.forEach(transaction => {
      let stage: number;
      switch (transaction.status) {
        case 'pending':
          if (!transaction.advertisementId) stage = 11;
          else if (!transaction.orderId) stage = 1;
          else stage = 2;
          break;
        case 'order_created':
        case 'order_pending':
          stage = 2;
          break;
        case 'chat_started':
          stage = 3;
          break;
        case 'payment_received':
        case 'waiting_payment':
          stage = 4;
          break;
        case 'check_received':
        case 'receipt_received':
          stage = 5;
          break;
        case 'release_money':
          stage = 6;
          break;
        case 'completed':
          stage = 7;
          break;
        case 'cancelled_by_counterparty':
          stage = 8;
          break;
        case 'failed':
        case 'cancelled':
          stage = transaction.customStatuses?.some(s => s.includes('dispute')) ? 9 : 10;
          break;
        default:
          stage = 11;
      }
      
      if (grouped[stage]) {
        grouped[stage].push(transaction);
      }
    });

    return grouped;
  }, [transactions]);

  let filteredTransactions = activeStatus === 'all' 
    ? transactions 
    : transactionsByStatus[activeStatus] || [];

  // Additional filter by kanban stage if selected
  if (activeKanbanStage !== null) {
    filteredTransactions = filteredTransactions.filter(transaction => {
      const transactionsInStage = transactionsByKanbanStage[activeKanbanStage] || [];
      return transactionsInStage.some(t => t.id === transaction.id);
    });
  }

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
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
    <div className="h-full flex">
      <div className="flex-1 flex flex-col">
        <Tabs value={activeStatus} onValueChange={handleStatusChange} className="h-full flex flex-col">
          <TabsList className="w-full justify-start overflow-x-auto flex-nowrap flex-shrink-0">
            {TRANSACTION_STATUSES.map(status => {
              const Icon = status.icon;
              const count = transactionsByStatus[status.id]?.length || 0;
              
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
                    ) : paginatedTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8">
                          <div className="text-muted-foreground">
                            Нет транзакций
                            {activeStatus !== 'all' && ` со статусом "${TRANSACTION_STATUSES.find(s => s.id === activeStatus)?.label}"`}
                            {activeKanbanStage !== null && ` на этапе "${KANBAN_STAGES[activeKanbanStage]?.title}"`}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-muted/50 transition-colors border-b">
                          <td className="px-3 py-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs">
                                  {transaction.id.slice(0, 6)}...
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0"
                                  onClick={() => handleCopyToClipboard(transaction.id, "ID")}
                                >
                                  <Copy size={10} />
                                </Button>
                              </div>
                              {transaction.orderId && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Hash size={10} />
                                  {transaction.orderId}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs">
                              {formatDate(transaction.createdAt)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {transaction.advertisement && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  transaction.advertisement.type === "buy"
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : "bg-red-500/10 text-red-500 border-red-500/20"
                                )}
                              >
                                {transaction.advertisement.type === "buy" ? (
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
                              {formatAmount(transaction.amount)}
                            </div>
                            {transaction.advertisement?.price && (
                              <div className="text-xs text-muted-foreground">
                                {transaction.advertisement.price} ₽/USDT
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {getStatusBadge(transaction.status)}
                          </td>
                          <td className="px-3 py-2">
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
                                  <span>Platform 1: {transaction.payout.gateAccount}</span>
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
                                onClick={() => onViewDetails?.(transaction)}
                              >
                                <Eye size={12} />
                              </Button>
                              {transaction.orderId && onOpenChat && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => onOpenChat(transaction)}
                                >
                                  <MessageSquare size={12} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Показано {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredTransactions.length)} из {filteredTransactions.length}
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

      {/* Right sidebar with kanban stages */}
      <div className="w-64 border-l bg-muted/20 p-4">
        <h3 className="font-semibold mb-4 text-sm">Этапы канбана</h3>
        <ScrollArea className="h-full">
          <div className="space-y-2">
            <Button
              variant={activeKanbanStage === null ? "secondary" : "ghost"}
              className="w-full justify-start text-xs"
              onClick={() => {
                setActiveKanbanStage(null);
                setCurrentPage(1);
              }}
            >
              <FileText size={14} className="mr-2" />
              Все этапы
              <Badge variant="secondary" className="ml-auto">
                {filteredTransactions.length}
              </Badge>
            </Button>
            
            {Object.values(KANBAN_STAGES).map(stage => {
              const Icon = stage.icon;
              const count = transactionsByKanbanStage[stage.id]?.filter(t => 
                activeStatus === 'all' || t.status === activeStatus
              ).length || 0;
              
              return (
                <Button
                  key={stage.id}
                  variant={activeKanbanStage === stage.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-xs",
                    activeKanbanStage === stage.id && stage.color + '/20'
                  )}
                  onClick={() => {
                    setActiveKanbanStage(stage.id);
                    setCurrentPage(1);
                  }}
                >
                  <Icon size={14} className={cn("mr-2", stage.textColor)} />
                  <span className="truncate">{stage.title}</span>
                  <Badge 
                    variant="secondary" 
                    className={cn(
                      "ml-auto",
                      activeKanbanStage === stage.id && stage.color + ' text-white'
                    )}
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}