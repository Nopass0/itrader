"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  RefreshCw, 
  Search, 
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Clock,
  DollarSign,
  MessageSquare,
  Bell,
  Check,
  X,
  AlertTriangle,
  Save
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { useTransactionWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { useToast } from '@/components/ui/use-toast';

interface Transaction {
  id: number;
  gateId: string;
  type: string;
  status: number;
  statusText: string;
  amount: string;
  currency: string;
  amountUsdt?: string;
  fee?: string;
  feeUsdt?: string;
  wallet?: string;
  description?: string;
  processedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SmsMessage {
  id: number;
  gateId: string;
  from: string;
  text: string;
  status: number;
  statusText: string;
  receivedAt: string;
  deviceId: string;
  deviceName: string;
  createdAt: string;
  updatedAt: string;
}

interface PushNotification {
  id: number;
  gateId: string;
  packageName: string;
  title?: string;
  text?: string;
  status: number;
  statusText: string;
  receivedAt: string;
  deviceId: string;
  deviceName: string;
  createdAt: string;
  updatedAt: string;
}

export default function GateAccountDetailPage() {
  const params = useParams();
  const accountId = parseInt(params.id as string);
  const { toast } = useToast();
  
  const [account, setAccount] = useState<any>(null);
  const [accountBalance, setAccountBalance] = useState<any>(null);
  const [accountStats, setAccountStats] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('transactions');
  const [itemsPerPage] = useState(20);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Balance setting states
  const [balanceInput, setBalanceInput] = useState('');
  const [isSettingBalance, setIsSettingBalance] = useState(false);

  // WebSocket integration for real-time updates
  const { setupTransactionListeners, isConnected } = useTransactionWebSocketEvents(accountId, 1); // TODO: Use real user ID
  
  // Load account balance - always fetch fresh data
  const loadAccountBalance = useCallback(async (forceRefresh = true) => {
    if (!accountId) return;
    
    setBalanceLoading(true);
    try {
      // Add timestamp to prevent caching
      const timestamp = forceRefresh ? `?t=${Date.now()}` : '';
      const response = await apiClient.get(`/gate/accounts/${accountId}/balance${timestamp}`);
      if (response.success && response.data) {
        setAccountBalance(response.data);
      }
    } catch (err) {
      console.error('Error loading account balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, [accountId]);

  // Load account stats (total counts)
  const loadAccountStats = useCallback(async () => {
    if (!accountId) return;
    
    try {
      const response = await apiClient.get(`/gate/accounts/${accountId}/stats`);
      if (response.success && response.data) {
        setAccountStats(response.data);
      }
    } catch (err) {
      console.error('Error loading account stats:', err);
    }
  }, [accountId]);

  // Load data for active tab
  const loadTabData = useCallback(async () => {
    if (!accountId) return;
    
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchQuery && { search: searchQuery })
      });

      let endpoint = '';
      switch (activeTab) {
        case 'transactions':
          endpoint = `/gate/accounts/${accountId}/stored-transactions?${params}`;
          break;
        case 'sms':
          endpoint = `/gate/accounts/${accountId}/stored-sms?${params}`;
          break;
        case 'push':
          endpoint = `/gate/accounts/${accountId}/stored-push?${params}`;
          break;
      }

      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        switch (activeTab) {
          case 'transactions':
            setTransactions((response.data as any)?.items || []);
            break;
          case 'sms':
            setSmsMessages((response.data as any)?.items || []);
            break;
          case 'push':
            setPushNotifications((response.data as any)?.items || []);
            break;
        }
      }
    } catch (err) {
      console.error('Error loading tab data:', err);
    }
  }, [accountId, currentPage, itemsPerPage, searchQuery, activeTab]);

  // Load account data - always fetch fresh data on component mount
  useEffect(() => {
    if (!accountId) return;
    
    const loadAccountData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Load account info with timestamp to prevent caching
        const accountResponse = await apiClient.get(`/gate/accounts?t=${Date.now()}`);
        if (accountResponse.success && accountResponse.data) {
          const foundAccount = (accountResponse.data as any)?.items?.find((acc: any) => acc.id === accountId);
          if (foundAccount) {
            setAccount(foundAccount);
          } else {
            setError('Account not found');
            return;
          }
        }

        // Load all data in parallel
        await Promise.all([
          loadTabData(),
          loadAccountBalance(true),
          loadAccountStats()
        ]);
        
      } catch (err) {
        setError('Failed to load account data');
        console.error('Error loading account:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAccountData();
  }, [accountId, loadTabData, loadAccountBalance, loadAccountStats]); // Include all dependencies
  
  // Force refresh balance on component mount to always get fresh data
  useEffect(() => {
    if (accountId && !loading) {
      // Refresh balance data when page is visited
      loadAccountBalance(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array means this runs once on mount

  // Reload data when tab, page, or search changes
  useEffect(() => {
    if (accountId) {
      loadTabData();
    }
  }, [loadTabData, accountId]);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!accountId) return;

    const cleanup = setupTransactionListeners(() => {
      // Refresh all data when WebSocket events arrive
      loadTabData();
      loadAccountBalance();
      loadAccountStats();
    });

    return cleanup;
  }, [accountId, setupTransactionListeners, loadTabData, loadAccountBalance, loadAccountStats]);

  const handleSync = async () => {
    try {
      await apiClient.post(`/gate/accounts/${accountId}/sync`);
      // Reload current tab data, balance, and stats
      setTimeout(() => {
        loadTabData();
        loadAccountBalance();
        loadAccountStats();
      }, 2000);
    } catch (err) {
      console.error('Error syncing account:', err);
    }
  };
  
  // Handle balance setting
  const handleSetBalance = async () => {
    if (!balanceInput || isNaN(parseFloat(balanceInput))) {
      return;
    }
    
    setIsSettingBalance(true);
    try {
      const response = await apiClient.post(`/gate/accounts/${accountId}/balance`, {
        amount: balanceInput
      });
      
      if (response.success && response.data) {
        // Update balance immediately with the response data
        if (response.data.wallet) {
          const newBalance = {
            ...accountBalance,
            totalBalanceRub: response.data.wallet.balance,
            balances: {
              [response.data.wallet.currency.code]: response.data.wallet.balance
            }
          };
          setAccountBalance(newBalance);
        }
        
        // Also reload full balance data to ensure consistency
        loadAccountBalance(true);
        setBalanceInput(''); // Clear input on success
        
        // Show success toast
        toast({
          title: "Баланс обновлен",
          description: `Новый баланс: ${response.data.wallet.balance} ${response.data.wallet.currency.code.toUpperCase()}`,
          duration: 3000,
        });
      } else {
        console.error('Failed to set balance:', response.error);
        toast({
          title: "Ошибка",
          description: response.error || "Не удалось обновить баланс",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (err) {
      console.error('Error setting balance:', err);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при обновлении баланса",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsSettingBalance(false);
    }
  };

  // Transaction action handlers
  const handleTransactionAction = async (transactionId: string, action: 'accept' | 'reject' | 'approve') => {
    setActionLoading(transactionId);
    
    try {
      const response = await apiClient.post(`/gate/transactions/${transactionId}/action`, {
        action
      });

      if (response.success) {
        // Reload transactions to see updated status
        loadTabData();
        loadAccountStats();
        
        // Show success message
        console.log(`Transaction ${action} successful`);
      } else {
        console.error(`Failed to ${action} transaction:`, response.error);
      }
    } catch (err) {
      console.error(`Error performing ${action} on transaction:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const renderTransactionActions = (transaction: Transaction) => {
    const isLoading = actionLoading === transaction.gateId;
    
    // Status 1 = "Ожидает" (pending) - can accept or reject
    if (transaction.status === 1) {
      return (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTransactionAction(transaction.gateId, 'accept')}
            disabled={isLoading}
            className="text-green-600 border-green-600 hover:bg-green-50"
          >
            <Check size={14} className="mr-1" />
            Принять
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTransactionAction(transaction.gateId, 'reject')}
            disabled={isLoading}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            <X size={14} className="mr-1" />
            Отклонить
          </Button>
        </div>
      );
    }
    
    // Status 5 = "Ожидает подтверждения" (in-process) - can approve
    if (transaction.status === 5) {
      return (
        <div className="flex gap-2 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTransactionAction(transaction.gateId, 'approve')}
            disabled={isLoading}
            className="text-blue-600 border-blue-600 hover:bg-blue-50"
          >
            <AlertTriangle size={14} className="mr-1" />
            Подтвердить
          </Button>
        </div>
      );
    }
    
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const formatAmount = (amount: string, currency: string) => {
    try {
      // Try to parse as JSON first (Gate.cx sends complex objects)
      if (amount.startsWith('{')) {
        const amountObj = JSON.parse(amount);
        if (amountObj.trader) {
          // Find the first currency amount in trader object
          const currencies = Object.keys(amountObj.trader);
          if (currencies.length > 0) {
            const firstCurrency = currencies[0];
            const value = amountObj.trader[firstCurrency];
            // Convert currency code (643 = RUB, 000001 = USDT, etc.)
            const currencyMap: { [key: string]: string } = {
              '643': 'RUB',
              '000001': 'USDT',
              '840': 'USD',
              '978': 'EUR'
            };
            const currencyCode = currencyMap[firstCurrency] || firstCurrency;
            return `${parseFloat(value).toFixed(2)} ${currencyCode}`;
          }
        }
        return `${amount} ${currency}`;
      }
      // Simple number string
      return `${parseFloat(amount).toFixed(2)} ${currency}`;
    } catch (error) {
      return `${amount} ${currency}`;
    }
  };

  const formatUsdtAmount = (amountUsdt: string) => {
    try {
      if (amountUsdt.startsWith('{')) {
        const amountObj = JSON.parse(amountUsdt);
        if (amountObj.trader && amountObj.trader['000001']) {
          return parseFloat(amountObj.trader['000001']).toFixed(2);
        }
      }
      return parseFloat(amountUsdt).toFixed(2);
    } catch (error) {
      return amountUsdt;
    }
  };

  const getStatusBadge = (status: number, statusText: string) => {
    const colors = {
      0: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',     // Создана
      1: 'bg-blue-500/10 text-blue-500 border-blue-500/20',          // В обработке / Активен
      2: 'bg-green-500/10 text-green-500 border-green-500/20',       // Завершена
      3: 'bg-red-500/10 text-red-500 border-red-500/20',             // Ошибка
      4: 'bg-orange-500/10 text-orange-500 border-orange-500/20',    // Отменена
      5: 'bg-gray-500/10 text-gray-500 border-gray-500/20',          // Истекла
      6: 'bg-red-500/10 text-red-500 border-red-500/20',             // Отклонена
      7: 'bg-green-500/10 text-green-500 border-green-500/20',       // Подтверждена
      8: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',    // Ожидает подтверждения
      9: 'bg-blue-500/10 text-blue-500 border-blue-500/20',          // Частично выполнена
      10: 'bg-gray-500/10 text-gray-500 border-gray-500/20',         // Заморожена
    };
    
    return (
      <Badge variant="outline" className={colors[status as keyof typeof colors] || colors[0]}>
        {statusText}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/panel">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} className="mr-2" />
                Назад
              </Button>
            </Link>
          </div>
          
          <Card className="glassmorphism animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted/50 rounded w-1/3"></div>
              <div className="h-4 bg-muted/30 rounded w-1/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted/30 rounded"></div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !account) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/panel">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} className="mr-2" />
                Назад
              </Button>
            </Link>
          </div>
          
          <Card className="glassmorphism">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="text-destructive">Ошибка: {error || 'Account not found'}</div>
                <Link href="/panel">
                  <Button variant="outline">
                    Вернуться к панели
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Link href="/panel">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} className="mr-2" />
                Назад
              </Button>
            </Link>
            
            <div>
              <h1 className="text-2xl font-bold">{account.email}</h1>
              <div className="flex items-center gap-2">
                {getStatusBadge(
                  account.status === 'active' ? 1 : 0, 
                  account.status === 'active' ? 'Активен' : account.status === 'inactive' ? 'Неактивен' : 'Неизвестен'
                )}
                <Badge variant="outline">ID: {account.id}</Badge>
                {account.gateId && (
                  <Badge variant="outline">Gate ID: {account.gateId}</Badge>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* WebSocket Connection Status */}
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              isConnected 
                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'В сети' : 'Отключен'}
            </div>

            <Button variant="outline" onClick={handleSync}>
              <RefreshCw size={16} className="mr-2" />
              Синхронизировать
            </Button>
            
            <Button variant="outline">
              <Download size={16} className="mr-2" />
              Экспорт
            </Button>
          </div>
        </motion.div>

        {/* Account Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
        >
          {/* Account Balance */}
          <Card className="glassmorphism lg:col-span-2">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-yellow-500" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Баланс аккаунта</p>
                    <p className="text-xs text-muted-foreground">ID: {accountBalance?.id || account.id}</p>
                  </div>
                </div>
                
                {balanceLoading ? (
                  <div className="space-y-2">
                    <div className="h-4 bg-muted/30 rounded animate-pulse"></div>
                    <div className="h-3 bg-muted/20 rounded animate-pulse w-2/3"></div>
                  </div>
                ) : accountBalance ? (
                  <div className="space-y-1">
                    <div className="text-lg font-bold">
                      {accountBalance.totalBalanceRub?.toLocaleString('ru-RU')} ₽
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${accountBalance.totalBalanceUsd?.toLocaleString('en-US')} USD
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {accountBalance.name} • {accountBalance.email}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Баланс недоступен
                  </div>
                )}
                
                {/* Balance setting input */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Input
                    type="number"
                    placeholder="Новый баланс"
                    value={balanceInput}
                    onChange={(e) => setBalanceInput(e.target.value)}
                    className="flex-1"
                    disabled={isSettingBalance}
                  />
                  <Button
                    size="sm"
                    onClick={handleSetBalance}
                    disabled={isSettingBalance || !balanceInput}
                  >
                    {isSettingBalance ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span className="ml-1">Сохранить</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions */}
          <Card className="glassmorphism">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-blue-500" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Транзакции</p>
                  <p className="text-xl font-bold">{accountStats?.totalTransactions || 0}</p>
                  <p className="text-xs text-muted-foreground">Всего в системе</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMS Messages */}
          <Card className="glassmorphism">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <MessageSquare className="text-green-500" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">SMS сообщения</p>
                  <p className="text-xl font-bold">{accountStats?.totalSms || 0}</p>
                  <p className="text-xs text-muted-foreground">Всего в системе</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Push Notifications */}
          <Card className="glassmorphism">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Bell className="text-purple-500" size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Push уведомления</p>
                  <p className="text-xl font-bold">{accountStats?.totalPush || 0}</p>
                  <p className="text-xs text-muted-foreground">Всего в системе</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Data Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glassmorphism">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    {activeTab === 'transactions' && <DollarSign className="text-primary" size={20} />}
                    {activeTab === 'sms' && <MessageSquare className="text-primary" size={20} />}
                    {activeTab === 'push' && <Bell className="text-primary" size={20} />}
                  </div>
                  <div>
                    <CardTitle className="mb-1">
                      {activeTab === 'transactions' && 'Транзакции'}
                      {activeTab === 'sms' && 'SMS сообщения'}
                      {activeTab === 'push' && 'Push уведомления'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {activeTab === 'transactions' && `${accountStats?.totalTransactions || 0} записей в базе`}
                      {activeTab === 'sms' && `${accountStats?.totalSms || 0} сообщений в базе`}
                      {activeTab === 'push' && `${accountStats?.totalPush || 0} уведомлений в базе`}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      placeholder="Поиск..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  
                  <Button variant="ghost" size="sm">
                    <Filter size={16} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="transactions">Транзакции</TabsTrigger>
                  <TabsTrigger value="sms">SMS</TabsTrigger>
                  <TabsTrigger value="push">Push уведомления</TabsTrigger>
                </TabsList>
                
                <TabsContent value="transactions" className="space-y-4 mt-6">
                  {transactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет транзакций
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((transaction) => (
                        <div key={transaction.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">#{transaction.gateId}</Badge>
                              {getStatusBadge(transaction.status, transaction.statusText)}
                              <span className="text-sm text-muted-foreground">{transaction.type}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">
                                {formatAmount(transaction.amount, transaction.currency)}
                              </div>
                              {transaction.amountUsdt && transaction.amountUsdt !== '0' && (
                                <div className="text-sm text-muted-foreground">
                                  ${formatUsdtAmount(transaction.amountUsdt)}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {transaction.description && (
                            <p className="text-sm text-muted-foreground">{transaction.description}</p>
                          )}
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatDate(transaction.processedAt)}</span>
                            {transaction.wallet && <span>Кошелек: {transaction.wallet}</span>}
                          </div>

                          {/* Action buttons for pending/in-process transactions */}
                          {renderTransactionActions(transaction)}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="sms" className="space-y-4 mt-6">
                  {smsMessages.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет SMS сообщений
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {smsMessages.map((sms) => (
                        <div key={sms.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">#{sms.gateId}</Badge>
                              {getStatusBadge(sms.status, sms.statusText)}
                              <span className="text-sm text-muted-foreground">От: {sms.from}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {sms.deviceName}
                            </div>
                          </div>
                          
                          <p className="text-sm bg-muted/30 p-2 rounded">{sms.text}</p>
                          
                          <div className="text-xs text-muted-foreground">
                            {formatDate(sms.receivedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="push" className="space-y-4 mt-6">
                  {pushNotifications.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет push уведомлений
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pushNotifications.map((push) => (
                        <div key={push.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">#{push.gateId}</Badge>
                              {getStatusBadge(push.status, push.statusText)}
                              <span className="text-sm text-muted-foreground">{push.packageName}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {push.deviceName}
                            </div>
                          </div>
                          
                          {push.title && (
                            <h4 className="font-medium">{push.title}</h4>
                          )}
                          
                          {push.text && (
                            <p className="text-sm bg-muted/30 p-2 rounded">{push.text}</p>
                          )}
                          
                          <div className="text-xs text-muted-foreground">
                            {formatDate(push.receivedAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              
              {/* Pagination */}
              <div className="flex items-center justify-between mt-6">
                <div className="text-sm text-muted-foreground">
                  Страница {currentPage}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}