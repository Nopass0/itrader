"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  RefreshCw, 
  Search, 
  Filter,
  ExternalLink,
  MessageSquare,
  Copy,
  Eye,
  Calendar,
  DollarSign,
  User,
  Wallet,
  ArrowUpDown,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  ShoppingCart,
  CreditCard,
  Link2,
  ChevronLeft,
  ChevronRight,
  Building2,
  Hash,
  Send,
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  Activity,
  BarChart3,
  FileText,
  Phone,
  CreditCard as CardIcon,
  Banknote,
  Timer,
  Check,
  ArrowUp,
  ArrowDown,
  MoreVertical
} from 'lucide-react';
import Link from 'next/link';
import { useTransactions } from '@/hooks/useTransactions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import { GlobalChat, openGlobalChat } from '@/components/GlobalChat';

// Tab types
type TabType = 'transactions' | 'orders' | 'advertisements' | 'payouts';

// Statistics Card Component
const StatCard = ({ title, value, change, icon: Icon, color }: {
  title: string;
  value: string;
  change?: { value: number; isPositive: boolean };
  icon: any;
  color: string;
}) => (
  <Card className="overflow-hidden">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {change && (
            <div className={cn(
              "flex items-center gap-1 text-xs",
              change.isPositive ? "text-green-500" : "text-red-500"
            )}>
              {change.isPositive ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span>{Math.abs(change.value)}%</span>
            </div>
          )}
        </div>
        <div className={cn("p-3 rounded-lg", color)}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('transactions');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const {
    // Virtual Transactions
    transactions,
    transactionsLoading,
    transactionsError,
    transactionsFilters,
    updateTransactionsFilters,
    loadTransactions,
    transactionsTotalCount,
    transactionsTotalPages,
    
    // Orders
    orders,
    ordersLoading,
    ordersError,
    ordersFilters,
    updateOrdersFilters,
    loadOrders,
    ordersTotalCount,
    ordersTotalPages,
    
    // Advertisements
    advertisements,
    advertisementsLoading,
    advertisementsError,
    advertisementsFilters,
    updateAdvertisementsFilters,
    loadAdvertisements,
    advertisementsTotalCount,
    advertisementsTotalPages,
    
    // Payouts
    payouts,
    payoutsLoading,
    payoutsError,
    payoutsFilters,
    updatePayoutsFilters,
    loadPayouts,
    payoutsTotalCount,
    payoutsTotalPages,
  } = useTransactions();

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
      year: '2-digit',
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

  const getStatusBadge = (status: string, type: 'transaction' | 'order' | 'payout' = 'transaction') => {
    const statusConfig: Record<string, { icon: any; text: string; className: string }> = {
      // Transaction statuses
      'pending': { 
        icon: Clock,
        text: 'Ожидание',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      },
      'chat_started': { 
        icon: MessageSquare,
        text: 'Чат',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      },
      'waiting_payment': { 
        icon: Clock,
        text: 'Ожидание оплаты',
        className: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
      },
      'payment_received': { 
        icon: DollarSign,
        text: 'Оплачено',
        className: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      },
      'completed': { 
        icon: CheckCircle,
        text: 'Завершено',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      'failed': { 
        icon: XCircle,
        text: 'Ошибка',
        className: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      'cancelled': { 
        icon: XCircle,
        text: 'Отменено',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      },
      // Order statuses
      'open': { 
        icon: ShoppingCart,
        text: 'Открыт',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      'in_progress': { 
        icon: Clock,
        text: 'В процессе',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      },
      'closed': { 
        icon: CheckCircle,
        text: 'Закрыт',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      },
      // Payout statuses (numeric)
      '1': { 
        icon: Clock,
        text: 'Создано',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      },
      '2': { 
        icon: Clock,
        text: 'Обработка',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      },
      '3': { 
        icon: CheckCircle,
        text: 'Подтверждено',
        className: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      },
      '4': { 
        icon: XCircle,
        text: 'Отклонено',
        className: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      '5': { 
        icon: CheckCircle,
        text: 'Выполнено',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      '6': { 
        icon: XCircle,
        text: 'Отменено',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      }
    };

    const config = statusConfig[status.toString()] || {
      icon: Clock,
      text: status,
      className: 'bg-muted'
    };
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={cn("text-xs", config.className)}>
        <Icon size={10} className="mr-1" />
        {config.text}
      </Badge>
    );
  };

  // Calculate statistics
  const stats = {
    totalVolume: transactions.reduce((sum, t) => sum + t.amount, 0),
    activeOrders: orders.filter(o => o.status === 'open').length,
    completedToday: transactions.filter(t => 
      new Date(t.createdAt).toDateString() === new Date().toDateString() && 
      t.status === 'completed'
    ).length,
    pendingPayouts: payouts.filter(p => [1, 2].includes(p.status)).length
  };

  // Virtual Transactions Tab with compact table
  const TransactionsTab = () => (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Объем за сегодня"
          value={formatAmount(stats.totalVolume)}
          change={{ value: 12.5, isPositive: true }}
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="Активные ордера"
          value={stats.activeOrders.toString()}
          icon={ShoppingCart}
          color="bg-blue-500"
        />
        <StatCard
          title="Завершено сегодня"
          value={stats.completedToday.toString()}
          change={{ value: 8.3, isPositive: true }}
          icon={CheckCircle}
          color="bg-purple-500"
        />
        <StatCard
          title="Ожидают выплаты"
          value={stats.pendingPayouts.toString()}
          icon={Clock}
          color="bg-orange-500"
        />
      </div>

      {/* Filters Bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Поиск..."
              value={transactionsFilters.search || ''}
              onChange={(e) => updateTransactionsFilters({ search: e.target.value })}
              className="pl-9 h-8 text-sm"
            />
          </div>
          
          <Select
            value={transactionsFilters.status || 'all'}
            onValueChange={(value) => updateTransactionsFilters({ status: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="pending">Ожидание</SelectItem>
              <SelectItem value="chat_started">Чат</SelectItem>
              <SelectItem value="payment_received">Оплачено</SelectItem>
              <SelectItem value="completed">Завершено</SelectItem>
              <SelectItem value="failed">Ошибка</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8"
          >
            <Filter size={14} className="mr-1" />
            Фильтры
          </Button>

          <Button variant="outline" size="sm" onClick={loadTransactions} className="h-8">
            <RefreshCw size={14} className={cn("mr-1", transactionsLoading && "animate-spin")} />
            Обновить
          </Button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 pt-3 border-t"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input
                type="date"
                placeholder="Дата от"
                value={transactionsFilters.dateFrom || ''}
                onChange={(e) => updateTransactionsFilters({ dateFrom: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Input
                type="date"
                placeholder="Дата до"
                value={transactionsFilters.dateTo || ''}
                onChange={(e) => updateTransactionsFilters({ dateTo: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Сумма от"
                value={transactionsFilters.amountMin || ''}
                onChange={(e) => updateTransactionsFilters({ amountMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Сумма до"
                value={transactionsFilters.amountMax || ''}
                onChange={(e) => updateTransactionsFilters({ amountMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
            </div>
          </motion.div>
        )}
      </Card>

      {/* Compact Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ID / Ордер</th>
                <th className="px-3 py-2 text-left font-medium">Время</th>
                <th className="px-3 py-2 text-left font-medium">Тип</th>
                <th className="px-3 py-2 text-right font-medium">Сумма</th>
                <th className="px-3 py-2 text-left font-medium">Статус</th>
                <th className="px-3 py-2 text-left font-medium">Контрагент</th>
                <th className="px-3 py-2 text-left font-medium">Bybit</th>
                <th className="px-3 py-2 text-left font-medium">Gate</th>
                <th className="px-3 py-2 text-left font-medium">Выплата</th>
                <th className="px-3 py-2 text-center font-medium">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactionsLoading ? (
                <tr>
                  <td colSpan={10} className="text-center py-8">
                    <RefreshCw className="animate-spin h-6 w-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Загрузка...</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-8">
                    <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Нет транзакций</p>
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-xs">{transaction.id.slice(0, 6)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => copyToClipboard(transaction.id, 'ID')}
                          >
                            <Copy size={10} />
                          </Button>
                        </div>
                        {transaction.orderId && (
                          <div className="text-xs text-muted-foreground">
                            #{transaction.orderId}
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
                        <Badge variant={transaction.advertisement.type === 'buy' ? 'default' : 'destructive'} className="text-xs">
                          {transaction.advertisement.type === 'buy' ? 'BUY' : 'SELL'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="font-medium">
                        {formatAmount(transaction.amount)}
                      </div>
                      {transaction.advertisement && (
                        <div className="text-xs text-muted-foreground">
                          {transaction.advertisement.price} ₽
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {getStatusBadge(transaction.status)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs">
                        {transaction.counterpartyName || '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {transaction.advertisement?.bybitAccount ? (
                        <Badge variant="outline" className="text-xs">
                          {transaction.advertisement.bybitAccount.name}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {transaction.payout?.gateAccount ? (
                        <Badge variant="outline" className="text-xs">
                          {transaction.payout.gateAccount}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {transaction.payout ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono">{transaction.payout.gatePayoutId}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => copyToClipboard(transaction.payout!.gatePayoutId!.toString(), 'Payout ID')}
                          >
                            <Copy size={10} />
                          </Button>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setSelectedItem(transaction)}
                        >
                          <Eye size={12} />
                        </Button>
                        {transaction.orderId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => openGlobalChat(transaction.orderId!)}
                          >
                            <MessageSquare size={12} />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical size={12} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedItem(transaction)}>
                              <Eye size={14} className="mr-2" />
                              Подробности
                            </DropdownMenuItem>
                            {transaction.orderId && (
                              <DropdownMenuItem onClick={() => openGlobalChat(transaction.orderId!)}>
                                <MessageSquare size={14} className="mr-2" />
                                Открыть чат
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => copyToClipboard(transaction.id, 'ID транзакции')}>
                              <Copy size={14} className="mr-2" />
                              Копировать ID
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {transactionsTotalPages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Показано {transactions.length} из {transactionsTotalCount}
            </p>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateTransactionsFilters({ page: (transactionsFilters.page || 1) - 1 })}
                disabled={transactionsFilters.page === 1}
                className="h-7 px-2"
              >
                <ChevronLeft size={14} />
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, transactionsTotalPages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <Button
                      key={page}
                      variant={transactionsFilters.page === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => updateTransactionsFilters({ page })}
                      className="h-7 w-7 p-0 text-xs"
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateTransactionsFilters({ page: (transactionsFilters.page || 1) + 1 })}
                disabled={transactionsFilters.page === transactionsTotalPages}
                className="h-7 px-2"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  // Similar compact designs for other tabs...
  const OrdersTab = () => (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Поиск ордеров..."
              value={ordersFilters.search || ''}
              onChange={(e) => updateOrdersFilters({ search: e.target.value })}
              className="pl-9 h-8 text-sm"
            />
          </div>
          
          <Select
            value={ordersFilters.status || 'all'}
            onValueChange={(value) => updateOrdersFilters({ status: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="open">Открыт</SelectItem>
              <SelectItem value="in_progress">В процессе</SelectItem>
              <SelectItem value="closed">Закрыт</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={loadOrders} className="h-8">
            <RefreshCw size={14} className={cn("mr-1", ordersLoading && "animate-spin")} />
            Обновить
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Ордер</th>
                <th className="px-3 py-2 text-left">Время</th>
                <th className="px-3 py-2 text-left">Тип</th>
                <th className="px-3 py-2 text-right">Объем</th>
                <th className="px-3 py-2 text-right">Цена</th>
                <th className="px-3 py-2 text-left">Контрагент</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ordersLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-muted-foreground">Загрузка ордеров...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Нет ордеров</p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2 font-mono text-xs">{order.orderId || order.id?.slice(0, 8) || '-'}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(order.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={order.type === 'buy' ? 'default' : 'destructive'} className="text-xs">
                        {order.type ? order.type.toUpperCase() : 'N/A'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{order.amount || 0} {order.currency || 'USDT'}</td>
                    <td className="px-3 py-2 text-right">{order.price || 0} {order.fiat || 'RUB'}</td>
                    <td className="px-3 py-2 text-xs">{order.counterpartyName || '-'}</td>
                    <td className="px-3 py-2">{getStatusBadge(order.status, 'order')}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => openGlobalChat(order.orderId)}
                        >
                          <MessageSquare size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const AdvertisementsTab = () => (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Тип</th>
                <th className="px-3 py-2 text-left">Пара</th>
                <th className="px-3 py-2 text-right">Цена</th>
                <th className="px-3 py-2 text-right">Лимиты</th>
                <th className="px-3 py-2 text-right">Доступно</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {advertisementsLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-muted-foreground">Загрузка объявлений...</span>
                    </div>
                  </td>
                </tr>
              ) : advertisements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Нет объявлений для отображения
                  </td>
                </tr>
              ) : (
                advertisements.map((ad) => (
                <tr key={ad.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{ad.bybitAdId || ad.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={ad.type === 'buy' ? 'default' : 'destructive'} className="text-xs">
                      {ad.type ? ad.type.toUpperCase() : 'N/A'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{ad.currency}/{ad.fiat}</td>
                  <td className="px-3 py-2 text-right font-medium">{ad.price}</td>
                  <td className="px-3 py-2 text-right text-xs">{ad.minOrderAmount}-{ad.maxOrderAmount}</td>
                  <td className="px-3 py-2 text-right">{ad.availableAmount}</td>
                  <td className="px-3 py-2">
                    <Badge variant={ad.isActive ? 'default' : 'secondary'} className="text-xs">
                      {ad.isActive ? 'Активно' : 'Неактивно'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => window.open(`https://www.bybit.com/fiat/trade/otc/?actionType=${ad.type}&token=${ad.currency}&fiat=${ad.fiat}`, '_blank')}
                    >
                      <ExternalLink size={12} />
                    </Button>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  const PayoutsTab = () => (
    <div className="space-y-4">
      {/* Filters Bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Поиск по кошельку..."
              value={payoutsFilters.search || ''}
              onChange={(e) => updatePayoutsFilters({ search: e.target.value })}
              className="pl-9 h-8 text-sm"
            />
          </div>
          
          <Select
            value={payoutsFilters.status?.toString() || 'all'}
            onValueChange={(value) => updatePayoutsFilters({ status: value === 'all' ? undefined : parseInt(value) })}
          >
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="1">Создано</SelectItem>
              <SelectItem value="2">Обработка</SelectItem>
              <SelectItem value="3">Подтверждено</SelectItem>
              <SelectItem value="4">Отклонено</SelectItem>
              <SelectItem value="5">Выполнено</SelectItem>
              <SelectItem value="6">Отменено</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={loadPayouts} className="h-8">
            <RefreshCw size={14} className={cn("mr-1", payoutsLoading && "animate-spin")} />
            Обновить
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Gate ID</th>
                <th className="px-3 py-2 text-left">Время</th>
                <th className="px-3 py-2 text-left">Кошелек</th>
                <th className="px-3 py-2 text-right">Сумма</th>
                <th className="px-3 py-2 text-left">Аккаунт</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-left">Метод</th>
                <th className="px-3 py-2 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payoutsLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-muted-foreground">Загрузка выплат...</span>
                    </div>
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    Нет выплат для отображения
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">{payout.gatePayoutId || '-'}</span>
                        {payout.gatePayoutId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => copyToClipboard(payout.gatePayoutId!.toString(), 'Gate ID')}
                          >
                            <Copy size={10} />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{formatDate(payout.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono">
                          {payout.wallet ? `${payout.wallet.slice(0, 10)}...` : '-'}
                        </span>
                        {payout.wallet && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => copyToClipboard(payout.wallet!, 'Кошелек')}
                          >
                            <Copy size={10} />
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {payout.amountTrader && typeof payout.amountTrader === 'object' && payout.amountTrader['643'] 
                        ? formatAmount(payout.amountTrader['643']) 
                        : (payout.amount ? formatAmount(payout.amount) : '-')}
                    </td>
                    <td className="px-3 py-2 text-xs">{payout.gateAccount || '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(payout.status.toString(), 'payout')}
                        <span className="text-xs text-muted-foreground">({payout.status})</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {typeof payout.method === 'object' && payout.method?.name ? payout.method.name : '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setSelectedItem(payout)}
                        >
                          <Eye size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="w-full h-full">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Транзакции и операции</h1>
            <p className="text-sm text-muted-foreground">
              Полный контроль над всеми финансовыми операциями
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Activity size={12} className="mr-1" />
              Онлайн: 12
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Timer size={12} className="mr-1" />
              Обновлено: только что
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="transactions" className="flex items-center gap-2 text-xs">
              <CreditCard size={14} />
              <span className="hidden sm:inline">Транзакции</span>
              {transactionsTotalCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {transactionsTotalCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2 text-xs">
              <ShoppingCart size={14} />
              <span className="hidden sm:inline">Ордера</span>
              {ordersTotalCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {ordersTotalCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="advertisements" className="flex items-center gap-2 text-xs">
              <TrendingUp size={14} />
              <span className="hidden sm:inline">Объявления</span>
              {advertisementsTotalCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {advertisementsTotalCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex items-center gap-2 text-xs">
              <Wallet size={14} />
              <span className="hidden sm:inline">Выплаты</span>
              {payoutsTotalCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {payoutsTotalCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            <TransactionsTab />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <OrdersTab />
          </TabsContent>

          <TabsContent value="advertisements" className="mt-4">
            <AdvertisementsTab />
          </TabsContent>

          <TabsContent value="payouts" className="mt-4">
            <PayoutsTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Details Dialog */}
      <TransactionDetailsDialog
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        onOpenChat={(orderId) => {
          setSelectedItem(null);
          openGlobalChat(orderId);
        }}
      />

      {/* Global Chat */}
      <GlobalChat />
    </div>
  );
}