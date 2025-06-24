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
  MoreVertical,
  Plus,
  Edit2,
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import { useTransactions } from '@/hooks/useTransactions';
import { useSocket } from '@/hooks/useSocket';
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
import { TransactionChat } from '@/components/TransactionChat';
import { ReceiptPopover } from '@/components/ReceiptPopover';
import { AdvertisementDialog } from '@/components/AdvertisementDialog';

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
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [updatingStatuses, setUpdatingStatuses] = useState<Set<string>>(new Set());
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [onlineUsers, setOnlineUsers] = useState<number>(0);
  const [selectedChatTransaction, setSelectedChatTransaction] = useState<any>(null);
  const [showAdDialog, setShowAdDialog] = useState(false);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const { toast } = useToast();
  const { socket } = useSocket();

  // Get current user role from localStorage
  useEffect(() => {
    const userStr = localStorage.getItem('systemAccount');
    if (userStr) {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      console.log('Current user:', user); // Debug log
    }
  }, []);


  // Get online users count from socket
  useEffect(() => {
    const socket = (window as any).socket;
    if (socket) {
      // Request online users count
      socket.emit('system:getOnlineUsers', (response: any) => {
        if (response.success) {
          setOnlineUsers(response.data.count || 0);
        }
      });

      // Listen for online users updates
      socket.on('system:onlineUsersUpdate', (data: any) => {
        setOnlineUsers(data.count || 0);
      });

      return () => {
        socket.off('system:onlineUsersUpdate');
      };
    }
  }, []);

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

  // Update time when data is loaded
  useEffect(() => {
    setLastUpdateTime(new Date());
  }, [transactions, orders, advertisements, payouts]);

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

  const getPayoutMethodName = (method: number | string | null | undefined) => {
    const methodMap: Record<string, string> = {
      '1': 'СБП',
      '2': 'Банковская карта',
      '3': 'Наличные',
      '4': 'Криптовалюта',
      '5': 'Электронный кошелек',
      '6': 'Банковский перевод',
      '7': 'Другое'
    };
    
    // Map for numeric values as well
    const methodMapNumeric: Record<number, string> = {
      1: 'СБП',
      2: 'Банковская карта',
      3: 'Наличные',
      4: 'Криптовалюта',
      5: 'Электронный кошелек',
      6: 'Банковский перевод',
      7: 'Другое'
    };
    
    if (!method && method !== 0) return '-';
    
    // Check if it's a number
    if (typeof method === 'number') {
      return methodMapNumeric[method] || `Метод ${method}`;
    }
    
    // Otherwise convert to string
    const methodStr = method.toString();
    return methodMap[methodStr] || `Метод ${methodStr}`;
  };

  const formatWallet = (wallet: string | null | undefined) => {
    if (!wallet) return '-';
    
    // Remove all non-digit characters for checking
    const digitsOnly = wallet.replace(/\D/g, '');
    
    // Check if it's a card number (16 digits)
    if (digitsOnly.length === 16) {
      // Format as card: XXXX XXXX XXXX XXXX
      return digitsOnly.replace(/(\d{4})/g, '$1 ').trim();
    }
    
    // Check if it's a Russian phone number (11 digits starting with 7 or 8)
    if (digitsOnly.length === 11 && (digitsOnly.startsWith('7') || digitsOnly.startsWith('8'))) {
      // Format as phone: +7 (XXX) XXX-XX-XX
      const phone = digitsOnly.replace(/^[78]/, '7');
      return `+${phone.slice(0, 1)} (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`;
    }
    
    // Check if it's a phone without country code (10 digits)
    if (digitsOnly.length === 10) {
      // Format as phone: +7 (XXX) XXX-XX-XX
      return `+7 (${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 8)}-${digitsOnly.slice(8, 10)}`;
    }
    
    // Return as is for other formats
    return wallet;
  };

  const formatUpdateTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    
    if (seconds < 60) {
      return 'только что';
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} мин. назад`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} ч. назад`;
    } else {
      const days = Math.floor(seconds / 86400);
      return `${days} дн. назад`;
    }
  };

  const handleRecreateAdvertisement = async (transactionId: string) => {
    try {
      const socket = (window as any).socket;
      if (!socket) {
        toast({
          title: "Ошибка",
          description: "Нет подключения к серверу",
          variant: "destructive",
        });
        return;
      }

      const result = await new Promise((resolve, reject) => {
        socket.emit('transactions:recreateAdvertisement', { transactionId }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        });
      });

      toast({
        title: "Успешно",
        description: "Объявление успешно пересоздано",
      });

      // Обновляем список транзакций
      loadTransactions();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось пересоздать объявление",
        variant: "destructive",
      });
    }
  };

  const handleReissueAdvertisement = async (transactionId: string) => {
    try {
      const socket = (window as any).socket;
      if (!socket) {
        toast({
          title: "Ошибка",
          description: "Нет подключения к серверу",
          variant: "destructive",
        });
        return;
      }

      // Подтверждение действия
      if (!confirm("Вы уверены, что хотите перевыпустить объявление? Это удалит объявление на Bybit, в базе данных и саму транзакцию.")) {
        return;
      }

      const result = await new Promise((resolve, reject) => {
        socket.emit('transactions:reissueAdvertisement', { transactionId }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        });
      });

      toast({
        title: "Успешно",
        description: "Объявление успешно перевыпущено",
      });

      // Обновляем список транзакций
      loadTransactions();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось пересоздать объявление",
        variant: "destructive",
      });
    }
  };

  const handleCreateAd = () => {
    setSelectedAd(null);
    setShowAdDialog(true);
  };

  const handleEditAd = (ad: any) => {
    setSelectedAd(ad);
    setShowAdDialog(true);
  };

  const handleDeleteAd = async (ad: any) => {
    if (!confirm('Вы уверены, что хотите удалить это объявление?')) {
      return;
    }

    try {
      if (!socket) {
        toast({
          title: "Ошибка",
          description: "Нет подключения к серверу",
          variant: "destructive",
        });
        return;
      }

      const result = await new Promise((resolve, reject) => {
        socket.emit('advertisements:delete', { id: ad.id }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        });
      });

      toast({
        title: "Успешно",
        description: "Объявление удалено",
      });

      // Обновляем список объявлений
      loadAdvertisements();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить объявление",
        variant: "destructive",
      });
    }
  };

  // Transaction statuses in Russian
  const transactionStatuses = [
    { value: 'pending', label: 'Ожидание' },
    { value: 'chat_started', label: 'Чат начат' },
    { value: 'waiting_payment', label: 'Ожидание оплаты' },
    { value: 'payment_received', label: 'Оплата получена' },
    { value: 'check_received', label: 'Чек получен' },
    { value: 'receipt_received', label: 'Квитанция получена' },
    { value: 'completed', label: 'Завершено' },
    { value: 'failed', label: 'Ошибка' },
    { value: 'cancelled', label: 'Отменено' },
    { value: 'cancelled_by_counterparty', label: 'Отменено контрагентом' },
    { value: 'stupid', label: 'Контрагент идиот' },
  ];

  // Status configuration
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
    'cancelled_by_counterparty': { 
      icon: AlertCircle,
      text: 'Отменено контрагентом',
      className: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    },
    'check_received': { 
      icon: CheckCircle,
      text: 'Чек получен',
      className: 'bg-green-500/10 text-green-500 border-green-500/20'
    },
    'receipt_received': { 
      icon: FileText,
      text: 'Квитанция получена',
      className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
    },
    'stupid': { 
      icon: XCircle,
      text: 'Контрагент идиот',
      className: 'bg-red-500/10 text-red-500 border-red-500/20'
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
      icon: Activity,
      text: 'Взято в работу',
      className: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    },
    '5': { 
      icon: Activity,
      text: 'В процессе',
      className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
    },
    '6': { 
      icon: XCircle,
      text: 'Отменено',
      className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    },
    '7': { 
      icon: CheckCircle,
      text: 'Выполнено',
      className: 'bg-green-500/10 text-green-500 border-green-500/20'
    }
  };

  const handleStatusChange = async (transactionId: string, newStatus: string) => {
    if (!currentUser || currentUser.role !== 'admin') {
      toast({
        title: "Ошибка",
        description: "Только администраторы могут изменять статус",
        variant: "destructive",
      });
      return;
    }

    // Add to updating set
    setUpdatingStatuses(prev => new Set(Array.from(prev).concat([transactionId])));

    try {
      const socket = (window as any).socket;
      if (!socket) {
        throw new Error("Нет подключения к серверу");
      }

      await new Promise((resolve, reject) => {
        socket.emit('transactions:updateStatus', {
          id: transactionId,
          status: newStatus
        }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        });
      });

      toast({
        title: "Успешно",
        description: "Статус транзакции обновлен",
      });

      // Обновляем список транзакций
      loadTransactions();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить статус",
        variant: "destructive",
      });
    } finally {
      // Remove from updating set
      setUpdatingStatuses(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string, type: 'transaction' | 'order' | 'payout' = 'transaction') => {

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
    // Объем за сегодня - только успешно завершенные транзакции
    totalVolume: transactions.filter(t => 
      new Date(t.createdAt).toDateString() === new Date().toDateString() && 
      t.status === 'completed'
    ).reduce((sum, t) => sum + t.amount, 0),
    // Активные ордера - не завершены, не отменены и не ошибка
    activeOrders: transactions.filter(t => 
      !['completed', 'failed', 'cancelled', 'cancelled_by_counterparty'].includes(t.status)
    ).length,
    // Завершено сегодня
    completedToday: transactions.filter(t => 
      new Date(t.createdAt).toDateString() === new Date().toDateString() && 
      t.status === 'completed'
    ).length,
    // Ожидают выплаты - статусы 1, 2, 3
    pendingPayouts: payouts.filter(p => [1, 2, 3].includes(p.status)).length
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
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="pending">Ожидание</SelectItem>
              <SelectItem value="chat_started">Чат начат</SelectItem>
              <SelectItem value="waiting_payment">Ожидание оплаты</SelectItem>
              <SelectItem value="payment_received">Оплата получена</SelectItem>
              <SelectItem value="check_received">Чек получен</SelectItem>
              <SelectItem value="completed">Завершено</SelectItem>
              <SelectItem value="failed">Ошибка</SelectItem>
              <SelectItem value="cancelled">Отменено</SelectItem>
              <SelectItem value="cancelled_by_counterparty">Отменено контрагентом</SelectItem>
              <SelectItem value="stupid">Контрагент идиот</SelectItem>
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
              <Select
                value={transactionsFilters.type || 'all'}
                onValueChange={(value) => updateTransactionsFilters({ type: value === 'all' ? undefined : value })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Тип операции" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="buy">Покупка</SelectItem>
                  <SelectItem value="sell">Продажа</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="Сумма от"
                value={transactionsFilters.amountFrom || ''}
                onChange={(e) => updateTransactionsFilters({ amountFrom: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Сумма до"
                value={transactionsFilters.amountTo || ''}
                onChange={(e) => updateTransactionsFilters({ amountTo: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="ID ордера"
                value={transactionsFilters.orderId || ''}
                onChange={(e) => updateTransactionsFilters({ orderId: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Bybit аккаунт"
                value={transactionsFilters.bybitAccount || ''}
                onChange={(e) => updateTransactionsFilters({ bybitAccount: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Gate аккаунт"
                value={transactionsFilters.gateAccount || ''}
                onChange={(e) => updateTransactionsFilters({ gateAccount: e.target.value || undefined })}
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
                <th className="px-3 py-2 text-left font-medium">Bybit</th>
                <th className="px-3 py-2 text-left font-medium">Gate</th>
                <th className="px-3 py-2 text-left font-medium">Выплата</th>
                <th className="px-3 py-2 text-left font-medium">Чек</th>
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
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          transaction.advertisement.type === 'buy' 
                            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        )}>
                          {transaction.advertisement.type === 'buy' ? 'ПОКУПКА' : 'ПРОДАЖА'}
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
                      {currentUser?.role === 'admin' ? (
                        <Select
                          value={transaction.status}
                          onValueChange={(value) => handleStatusChange(transaction.id, value)}
                          disabled={updatingStatuses.has(transaction.id)}
                        >
                          <SelectTrigger className={cn("h-7 w-[160px] text-xs", updatingStatuses.has(transaction.id) && "opacity-50")}>
                            <SelectValue>
                              {updatingStatuses.has(transaction.id) ? (
                                <div className="flex items-center gap-1">
                                  <RefreshCw size={10} className="animate-spin" />
                                  <span>Обновление...</span>
                                </div>
                              ) : (() => {
                                const statusInfo = statusConfig[transaction.status];
                                if (statusInfo) {
                                  const Icon = statusInfo.icon;
                                  return (
                                    <div className="flex items-center gap-1">
                                      <Icon size={10} />
                                      <span>{statusInfo.text}</span>
                                    </div>
                                  );
                                }
                                return transaction.status;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {transactionStatuses.map((status) => {
                              const statusInfo = statusConfig[status.value];
                              const Icon = statusInfo?.icon || Clock;
                              return (
                                <SelectItem key={status.value} value={status.value}>
                                  <div className="flex items-center gap-1">
                                    <Icon size={12} />
                                    <span className="text-xs">{status.label}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(transaction.status)
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {transaction.advertisement?.bybitAccount ? (
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="text-xs">
                            {transaction.advertisement.bybitAccount.accountId}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {transaction.advertisement.bybitAccount.accountName || transaction.advertisement.bybitAccount.name || 'Без имени'}
                          </div>
                        </div>
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
                      {transaction.payout?.id ? (
                        <ReceiptPopover 
                          payoutId={transaction.payout.id}
                          transactionId={transaction.id}
                        />
                      ) : null}
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
                            onClick={() => setSelectedChatTransaction(transaction)}
                            title="Открыть чат"
                          >
                            <MessageSquare size={12} />
                          </Button>
                        )}
                        {(() => {
                          const showButton = (transaction.status === 'cancelled_by_counterparty' || transaction.status === 'cancelled' || transaction.status === 'stupid') && currentUser?.role === 'admin';
                          if (transaction.status === 'cancelled' || transaction.status === 'stupid') {
                            console.log('Transaction status:', transaction.status, 'User role:', currentUser?.role, 'Show button:', showButton);
                          }
                          return showButton ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-orange-600"
                              onClick={() => handleReissueAdvertisement(transaction.id)}
                              title="Перевыпустить объявление"
                            >
                              <RefreshCw size={12} />
                            </Button>
                          ) : null;
                        })()}
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
                              <DropdownMenuItem onClick={() => setSelectedChatTransaction(transaction)}>
                                <MessageSquare size={14} className="mr-2" />
                                Открыть чат
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => copyToClipboard(transaction.id, 'ID транзакции')}>
                              <Copy size={14} className="mr-2" />
                              Копировать ID
                            </DropdownMenuItem>
                            {(transaction.status === 'cancelled_by_counterparty' || transaction.status === 'cancelled' || transaction.status === 'stupid') && currentUser?.role === 'admin' && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleReissueAdvertisement(transaction.id)}
                                  className="text-orange-600"
                                >
                                  <RefreshCw size={14} className="mr-2" />
                                  Перевыпустить объявление
                                </DropdownMenuItem>
                              </>
                            )}
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
  const OrdersTab = () => {
    // Фильтруем транзакции, у которых есть orderId
    const transactionsWithOrders = transactions.filter(t => t.orderId);
    
    return (
      <div className="space-y-4">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Поиск ордеров..."
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
                <SelectItem value="all">Все</SelectItem>
                {transactionStatuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={loadTransactions} className="h-8">
              <RefreshCw size={14} className={cn("mr-1", transactionsLoading && "animate-spin")} />
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
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactionsLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-muted-foreground">Загрузка ордеров...</span>
                    </div>
                  </td>
                </tr>
              ) : transactionsWithOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Нет ордеров</p>
                  </td>
                </tr>
              ) : (
                transactionsWithOrders.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-muted/50">
                    <td className="px-3 py-2 font-mono text-xs">{transaction.orderId}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(transaction.createdAt)}</td>
                    <td className="px-3 py-2">
                      {transaction.advertisement ? (
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          transaction.advertisement.type === 'buy' 
                            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                            : 'bg-red-500/10 text-red-500 border-red-500/20'
                        )}>
                          {transaction.advertisement.type === 'buy' ? 'ПОКУПКА' : 'ПРОДАЖА'}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatAmount(transaction.amount)} USDT</td>
                    <td className="px-3 py-2 text-right">
                      {transaction.advertisement ? `${transaction.advertisement.price} RUB` : '-'}
                    </td>
                    <td className="px-3 py-2">{getStatusBadge(transaction.status)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setSelectedChatTransaction(transaction)}
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
  };

  const AdvertisementsTab = () => (
    <div className="space-y-4">
      {/* Filters Bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={advertisementsFilters.bybitAccount || 'all'}
            onValueChange={(value) => updateAdvertisementsFilters({ bybitAccount: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue placeholder="Bybit аккаунт" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все аккаунты</SelectItem>
              {/* TODO: Load accounts dynamically */}
            </SelectContent>
          </Select>

          <Select
            value={advertisementsFilters.type || 'all'}
            onValueChange={(value) => updateAdvertisementsFilters({ type: value === 'all' ? undefined : value })}
          >
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="buy">Покупка</SelectItem>
              <SelectItem value="sell">Продажа</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={advertisementsFilters.isActive?.toString() || 'all'}
            onValueChange={(value) => updateAdvertisementsFilters({ isActive: value === 'all' ? undefined : value === 'true' })}
          >
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="true">Активные</SelectItem>
              <SelectItem value="false">Неактивные</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2 ml-auto">
            <Button variant="default" size="sm" className="h-8" onClick={handleCreateAd}>
              <Plus size={14} className="mr-1" />
              Создать
            </Button>
            <Button variant="outline" size="sm" onClick={loadAdvertisements} className="h-8">
              <RefreshCw size={14} className={cn("mr-1", advertisementsLoading && "animate-spin")} />
              Обновить
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Аккаунт</th>
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
                  <td colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-muted-foreground">Загрузка объявлений...</span>
                    </div>
                  </td>
                </tr>
              ) : advertisements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    Нет объявлений для отображения
                  </td>
                </tr>
              ) : (
                advertisements.map((ad) => (
                <tr key={ad.id} className="hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{ad.bybitAdId || ad.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    {ad.bybitAccount ? (
                      <Badge variant="outline" className="text-xs">
                        {ad.bybitAccount.accountId}
                      </Badge>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      ad.type === 'buy' 
                        ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                        : ad.type === 'sell'
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : 'bg-gray-500/10 text-gray-500 border-gray-500/20'
                    )}>
                      {ad.type === 'buy' ? 'ПОКУПКА' : ad.type === 'sell' ? 'ПРОДАЖА' : 'N/A'}
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
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => window.open(`https://www.bybit.com/fiat/trade/otc/?actionType=${ad.type}&token=${ad.currency}&fiat=${ad.fiat}`, '_blank')}
                        title="Открыть на Bybit"
                      >
                        <ExternalLink size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        title="Редактировать"
                        onClick={() => handleEditAd(ad)}
                      >
                        <Edit2 size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                        title="Удалить"
                        onClick={() => handleDeleteAd(ad)}
                      >
                        <Trash2 size={12} />
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

  const PayoutsTab = () => (
    <div className="space-y-4">
      {/* Filters Bar */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Поиск по всем полям..."
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
              <SelectItem value="4">Взято в работу</SelectItem>
              <SelectItem value="5">В процессе</SelectItem>
              <SelectItem value="6">Отменено</SelectItem>
              <SelectItem value="7">Выполнено</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={payoutsFilters.method?.toString() || 'all'}
            onValueChange={(value) => updatePayoutsFilters({ method: value === 'all' ? undefined : parseInt(value) })}
          >
            <SelectTrigger className="w-[140px] h-8 text-sm">
              <SelectValue placeholder="Метод" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все методы</SelectItem>
              <SelectItem value="1">СБП</SelectItem>
              <SelectItem value="2">Банковская карта</SelectItem>
              <SelectItem value="3">Наличные</SelectItem>
              <SelectItem value="4">Криптовалюта</SelectItem>
              <SelectItem value="5">Электронный кошелек</SelectItem>
              <SelectItem value="6">Банковский перевод</SelectItem>
              <SelectItem value="7">Другое</SelectItem>
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

          <Button variant="outline" size="sm" onClick={loadPayouts} className="h-8">
            <RefreshCw size={14} className={cn("mr-1", payoutsLoading && "animate-spin")} />
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
                value={payoutsFilters.dateFrom || ''}
                onChange={(e) => updatePayoutsFilters({ dateFrom: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Input
                type="date"
                placeholder="Дата до"
                value={payoutsFilters.dateTo || ''}
                onChange={(e) => updatePayoutsFilters({ dateTo: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Сумма от"
                value={payoutsFilters.amountFrom || ''}
                onChange={(e) => updatePayoutsFilters({ amountFrom: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
              <Input
                type="number"
                placeholder="Сумма до"
                value={payoutsFilters.amountTo || ''}
                onChange={(e) => updatePayoutsFilters({ amountTo: e.target.value ? Number(e.target.value) : undefined })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Gate аккаунт"
                value={payoutsFilters.gateAccount || ''}
                onChange={(e) => updatePayoutsFilters({ gateAccount: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="Gate Payout ID"
                value={payoutsFilters.gatePayoutId || ''}
                onChange={(e) => updatePayoutsFilters({ gatePayoutId: e.target.value || undefined })}
                className="h-8 text-sm"
              />
              <Select
                value={payoutsFilters.hasReceipt?.toString() || 'all'}
                onValueChange={(value) => updatePayoutsFilters({ hasReceipt: value === 'all' ? undefined : value === 'true' })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Наличие чека" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="true">С чеком</SelectItem>
                  <SelectItem value="false">Без чека</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        )}
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
                <th className="px-3 py-2 text-left">Чек</th>
                <th className="px-3 py-2 text-center">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payoutsLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="animate-spin" size={16} />
                      <span className="text-muted-foreground">Загрузка выплат...</span>
                    </div>
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
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
                          {formatWallet(payout.wallet)}
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
                      {(() => {
                        // Handle different method formats
                        if (typeof payout.method === 'object' && payout.method !== null) {
                          // If method is an object with name property
                          if (payout.method.name) {
                            return payout.method.name;
                          }
                          // If method is an object with id property
                          if (payout.method.id) {
                            return getPayoutMethodName(payout.method.id);
                          }
                          // If method is an object with value property
                          if (payout.method.value) {
                            return getPayoutMethodName(payout.method.value);
                          }
                        }
                        // Otherwise, treat as a simple value
                        return getPayoutMethodName(payout.method);
                      })()}
                    </td>
                    <td className="px-3 py-2">
                      <ReceiptPopover 
                        payoutId={payout.id}
                      />
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
              Онлайн: {onlineUsers}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Timer size={12} className="mr-1" />
              Обновлено: {formatUpdateTime(lastUpdateTime)}
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
          const transaction = transactions.find(t => t.orderId === orderId);
          if (transaction) {
            setSelectedChatTransaction(transaction);
          }
        }}
      />

      {/* Transaction Chat */}
      {selectedChatTransaction && (
        <TransactionChat
          isOpen={!!selectedChatTransaction}
          onClose={() => setSelectedChatTransaction(null)}
          transactionId={selectedChatTransaction.id}
          orderId={selectedChatTransaction.orderId}
          counterpartyName={selectedChatTransaction.counterpartyName}
        />
      )}

      {/* Global Chat */}
      <GlobalChat />

      {/* Advertisement Dialog */}
      <AdvertisementDialog
        isOpen={showAdDialog}
        onClose={() => {
          setShowAdDialog(false);
          setSelectedAd(null);
        }}
        advertisement={selectedAd}
        onSuccess={() => {
          loadAdvertisements();
        }}
      />
    </div>
  );
}