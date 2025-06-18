"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  Plus,
  Edit,
  Trash2,
  CreditCard,
  Send,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  Receipt,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import { useTransactionWebSocketEvents } from '@/hooks/useWebSocketEvents';
import apiClient from '@/lib/api';
import { BybitTransactionChatDialog } from '@/components/panel/BybitTransactionChatDialog';
import { CreateBybitAdDialog } from '@/components/panel/CreateBybitAdDialog';

interface BybitAccountInfo {
  uid: string;
  accountType: string;
  memberLevel: number;
  email?: string;
  mobile?: string;
  affiliateId?: number;
  unifiedMarginStatus: number;
  marginMode: number;
  updatedTime: string;
  apiKey?: string;
  isMaster?: boolean;
  userType?: number;
  kycLevel?: string;
  kycRegion?: string;
  vipLevel?: string;
  mktMakerLevel?: string;
  p2pUserInfo?: {
    nickName?: string;
    uid?: string;
    emailAddress?: string;
    merchantLevel?: number;
  };
}

interface P2POrder {
  orderId: string;
  tokenId: string;
  currencyId: string;
  side: string;
  price: string;
  quantity: string;
  orderStatus: string;
  createdDate: string;
  counterpartyNickname?: string;
}

interface P2PAd {
  id: string;
  tokenId: string;
  currencyId: string;
  side: string;
  price: string;
  quantity: string;
  minAmount: string;
  maxAmount: string;
  status: string;
  createdDate: string;
}

interface BybitBalance {
  coin: string;
  free: string;
  locked: string;
  equity?: string;
  usdValue?: string;
  debt?: string;
  interest?: string;
  availableToWithdraw?: string;
  availableToBorrow?: string;
  borrowAmount?: string;
  accruedInterest?: string;
  totalOrderIM?: string;
  totalPositionIM?: string;
  totalPositionMM?: string;
  unrealisedPnl?: string;
  cumRealisedPnl?: string;
}

interface BybitWalletBalance {
  accountType: string;
  coins: BybitBalance[];
  totalEquityInUSD?: string;
  totalInitialMarginInUSD?: string;
  totalMaintenanceMarginInUSD?: string;
  totalMarginBalanceInUSD?: string;
  totalAvailableBalanceInUSD?: string;
}

interface Transaction {
  type: 'deposit' | 'withdrawal' | 'transfer' | 'p2p';
  txID?: string;
  withdrawId?: string;
  transferId?: string;
  coin: string;
  amount: string;
  fee?: string;
  status: number | string;
  toAddress?: string;
  toAccountType?: string;
  fromAddress?: string;
  fromAccountType?: string;
  tag?: string;
  successAt?: string;
  createdTime?: string;
  updateTime?: string;
  timestamp?: string;
  txid?: string;
  blockNumber?: string;
  confirmations?: string;
  // P2P specific fields
  side?: 'Buy' | 'Sell';
  price?: string;
  counterparty?: string;
  orderId?: string;
}

export default function BybitAccountDetailPage() {
  const params = useParams();
  const accountId = parseInt(params.id as string);
  
  const [accountInfo, setAccountInfo] = useState<BybitAccountInfo | null>(null);
  const [walletBalance, setWalletBalance] = useState<BybitWalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [p2pOrders, setP2POrders] = useState<P2POrder[]>([]);
  const [p2pAds, setP2PAds] = useState<P2PAd[]>([]);
  const [p2pBalances, setP2PBalances] = useState<any>(null);
  const [showCreateAdDialog, setShowCreateAdDialog] = useState(false);
  const [showEditAdDialog, setShowEditAdDialog] = useState(false);
  const [selectedAd, setSelectedAd] = useState<P2PAd | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Pagination and filters
  const [activeTab, setActiveTab] = useState('overview');
  const [transactionType, setTransactionType] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all');
  
  // Chat dialog state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  
  // WebSocket integration for real-time updates
  const { setupTransactionListeners, isConnected } = useTransactionWebSocketEvents(accountId, 1);

  // Load account data
  const loadAccountData = async () => {
    if (!accountId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get account info with P2P details
      const infoResponse = await apiClient.get(`/bybit/account/${accountId}/info`);
      if (infoResponse.success && infoResponse.data) {
        const data = infoResponse.data as any;
        // Handle nested accountInfo structure
        const info = data.accountInfo || data;
        setAccountInfo(info);
        setWalletBalance(data.walletBalance);
      }

      // Get P2P user info
      try {
        const userInfoResponse = await apiClient.get(`/bybit/accounts/${accountId}/user-info`);
        if (userInfoResponse.success && userInfoResponse.data) {
          // Update account info with P2P user info
          setAccountInfo(prev => ({
            ...(prev || {}),
            p2pUserInfo: {
              nickName: userInfoResponse.data.nickName,
              uid: userInfoResponse.data.userId,
              emailAddress: userInfoResponse.data.email
            }
          }));
        }
      } catch (err) {
        console.error('Failed to load P2P user info:', err);
      }

      // Get P2P orders
      try {
        const p2pOrdersResponse = await apiClient.get(`/bybit/accounts/${accountId}/orders`);
        if (p2pOrdersResponse.success && p2pOrdersResponse.data) {
          const orders = p2pOrdersResponse.data;
          setP2POrders(Array.isArray(orders) ? orders : (orders.items || orders.list || []));
        }
      } catch (err) {
        console.error('Failed to load P2P orders:', err);
      }

      // Get P2P ads
      try {
        const p2pAdsResponse = await apiClient.get(`/bybit/accounts/${accountId}/ads`);
        if (p2pAdsResponse.success && p2pAdsResponse.data) {
          const ads = p2pAdsResponse.data;
          setP2PAds(Array.isArray(ads) ? ads : (ads.items || ads.list || []));
        }
      } catch (err) {
        console.error('Failed to load P2P ads:', err);
      }

      // Get P2P balances
      try {
        const p2pBalancesResponse = await apiClient.get(`/bybit/account/${accountId}/p2p/balances`);
        if (p2pBalancesResponse.success && p2pBalancesResponse.data) {
          setP2PBalances(p2pBalancesResponse.data);
        }
      } catch (err) {
        console.error('Failed to load P2P balances:', err);
      }

      // Get all transactions
      const transactionsResponse = await apiClient.get(`/bybit/account/transactions/all`, {
        params: { limit: 100 }
      });
      if (transactionsResponse.success && transactionsResponse.data) {
        const data = transactionsResponse.data as any;
        setTransactions(data.transactions || []);
      }

      // Get active orders
      const activeOrdersResponse = await apiClient.get(`/bybit/account/orders/active`);
      if (activeOrdersResponse.success && activeOrdersResponse.data) {
        const data = activeOrdersResponse.data as any;
        setActiveOrders(data.list || []);
      }

      // Get order history
      const orderHistoryResponse = await apiClient.get(`/bybit/account/orders/history`, {
        params: { limit: 50 }
      });
      if (orderHistoryResponse.success && orderHistoryResponse.data) {
        const data = orderHistoryResponse.data as any;
        setOrderHistory(data.list || []);
      }
      
    } catch (err) {
      setError('Failed to load account data');
      console.error('Error loading account:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh account data
  const refreshAccountData = async () => {
    setRefreshing(true);
    try {
      await loadAccountData();
    } finally {
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAccountData();
  }, [accountId]);

  // Set up WebSocket listeners for real-time updates
  useEffect(() => {
    if (!accountId) return;

    const cleanup = setupTransactionListeners(() => {
      // Refresh data when WebSocket events arrive
      loadAccountData();
    });

    return cleanup;
  }, [accountId, setupTransactionListeners]);

  const formatDate = (dateString: string | number) => {
    if (!dateString) return 'Н/Д';
    
    let date: Date;
    if (typeof dateString === 'number') {
      // Check if it's in seconds or milliseconds
      const timestamp = dateString < 10000000000 ? dateString * 1000 : dateString;
      date = new Date(timestamp);
    } else if (typeof dateString === 'string') {
      // Check if it's a numeric string (Unix timestamp)
      const numericValue = parseInt(dateString);
      if (!isNaN(numericValue)) {
        const timestamp = numericValue < 10000000000 ? numericValue * 1000 : numericValue;
        date = new Date(timestamp);
      } else {
        date = new Date(dateString);
      }
    } else {
      return 'Н/Д';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Н/Д';
    }
    
    return date.toLocaleString('ru-RU');
  };

  const formatAmount = (amount: string | number, decimals: number = 8) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return value.toLocaleString('ru-RU', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: decimals 
    });
  };

  const getTransactionStatusBadge = (status: string | number, type: string) => {
    const isSuccess = status === 1 || status === 'SUCCESS' || status === '1';
    const isPending = status === 0 || status === 'PENDING' || status === '0';
    
    return (
      <Badge 
        variant={isSuccess ? 'default' : isPending ? 'secondary' : 'destructive'}
        className={
          isSuccess 
            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
            : isPending 
            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            : 'bg-red-500/10 text-red-500 border-red-500/20'
        }
      >
        {isSuccess ? 'Успешно' : isPending ? 'В процессе' : 'Ошибка'}
      </Badge>
    );
  };

  const getOrderStatusBadge = (status: string) => {
    const statusConfig: Record<string, { text: string; className: string }> = {
      'New': { text: 'Новый', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
      'PartiallyFilled': { text: 'Частично', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      'Filled': { text: 'Исполнен', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
      'Cancelled': { text: 'Отменен', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
      'Rejected': { text: 'Отклонен', className: 'bg-red-500/10 text-red-500 border-red-500/20' }
    };

    const config = statusConfig[status] || { text: status, className: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };

    return (
      <Badge variant="outline" className={config.className}>
        {config.text}
      </Badge>
    );
  };

  const filteredTransactions = transactions.filter(tx => {
    if (transactionType === 'all') return true;
    if (transactionType === 'deposit' && tx.type === 'deposit') return true;
    if (transactionType === 'withdrawal' && tx.type === 'withdrawal') return true;
    if (transactionType === 'transfer' && (tx.type === 'transfer' || tx.type === 'p2p')) return true;
    return false;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3">
            <RefreshCw className="animate-spin" size={20} />
            <span>Загрузка...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Card className="glassmorphism max-w-md mx-auto">
            <CardContent className="p-6">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-500">Ошибка</h3>
              <p className="text-muted-foreground mt-2">{error}</p>
              <div className="flex gap-3 mt-4">
                <Button onClick={loadAccountData} className="flex-1">
                  Попробовать снова
                </Button>
                <Link href="/panel/accounts">
                  <Button variant="outline" className="flex-1">
                    <ArrowLeft size={16} className="mr-2" />
                    Назад
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
            <Link href="/panel/accounts">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} className="mr-2" />
                Назад
              </Button>
            </Link>
            
            <div>
              <h1 className="text-2xl font-bold">
                {accountId} - {accountInfo?.email || accountInfo?.p2pUserInfo?.emailAddress?.replace(/\*/g, '') || 'Bybit Account'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {accountInfo && (
                  <>
                    <Badge variant="outline">UID: {accountInfo.p2pUserInfo?.uid || accountInfo.uid || 'Н/Д'}</Badge>
                    <Badge variant="outline">Тип: {accountInfo.accountType || 'UNIFIED'}</Badge>
                    {accountInfo.kycLevel && (
                      <Badge variant="secondary">KYC: {accountInfo.kycLevel}</Badge>
                    )}
                    {Array.isArray(p2pAds) && p2pAds.length > 0 && (
                      <Badge variant="default">Активных объявлений: {p2pAds.filter(ad => ad.status === '10' || ad.status === 10).length}</Badge>
                    )}
                  </>
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

            <Button 
              variant="outline" 
              onClick={refreshAccountData}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            
            <Button variant="outline">
              <Download size={16} className="mr-2" />
              Экспорт
            </Button>
          </div>
        </motion.div>

        {/* Overview Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <Card className="glassmorphism">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Общий баланс</p>
                  <p className="text-2xl font-bold">
                    ${(() => {
                      // Calculate total balance from all sources
                      let total = 0;
                      
                      // Add unified balance if exists
                      if (walletBalance?.unified?.totalEquityInUSD) {
                        total += parseFloat(walletBalance.unified.totalEquityInUSD);
                      }
                      
                      // Add funding balance if exists
                      if (walletBalance?.funding?.coins) {
                        walletBalance.funding.coins.forEach((coin: any) => {
                          if (coin.usdValue) {
                            total += parseFloat(coin.usdValue);
                          } else if (coin.coin === 'USD') {
                            total += parseFloat(coin.walletBalance || '0');
                          }
                        });
                      }
                      
                      // If no new format, use old format
                      if (total === 0 && walletBalance?.totalEquityInUSD) {
                        total = parseFloat(walletBalance.totalEquityInUSD);
                      }
                      
                      return formatAmount(total.toString(), 2);
                    })()}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

            <Card className="glassmorphism">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">USD/USDT баланс</p>
                    <p className="text-2xl font-bold text-green-500">
                      {(() => {
                        let totalUsd = 0;
                        
                        // Check funding balance first
                        if (walletBalance?.funding?.coins) {
                          const usdCoin = walletBalance.funding.coins.find((c: any) => c.coin === 'USD');
                          const usdtCoin = walletBalance.funding.coins.find((c: any) => c.coin === 'USDT');
                          
                          if (usdCoin) totalUsd += parseFloat(usdCoin.walletBalance || '0');
                          if (usdtCoin) totalUsd += parseFloat(usdtCoin.walletBalance || '0');
                        }
                        
                        // Check unified balance
                        if (walletBalance?.unified?.coins) {
                          const usdtCoin = walletBalance.unified.coins.find((c: any) => c.coin === 'USDT');
                          if (usdtCoin) totalUsd += parseFloat(usdtCoin.walletBalance || '0');
                        }
                        
                        // Fallback to old format
                        if (totalUsd === 0 && walletBalance?.coins) {
                          const usdtCoin = walletBalance.coins.find((c: any) => c.coin === 'USDT');
                          if (usdtCoin) totalUsd = parseFloat(usdtCoin.free || usdtCoin.walletBalance || '0');
                        }
                        
                        return formatAmount(totalUsd.toString(), 2);
                      })()}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">P2P баланс</p>
                    <p className="text-2xl font-bold text-blue-500">
                      ${(() => {
                        // Handle new response format with totalUsdValue and balances array
                        if (p2pBalances?.totalUsdValue) {
                          return formatAmount(p2pBalances.totalUsdValue, 2);
                        }
                        // Handle different response structures from Bybit API
                        if (p2pBalances?.balance?.USDT) {
                          return formatAmount(p2pBalances.balance.USDT.walletBalance || '0', 2);
                        }
                        // Fallback for array structure
                        if (Array.isArray(p2pBalances?.balance)) {
                          const usdtBalance = p2pBalances.balance.find((b: any) => b.coin === 'USDT');
                          return formatAmount(usdtBalance?.walletBalance || '0', 2);
                        }
                        return '0.00';
                      })()}
                    </p>
                    {/* Show individual coin balances if available */}
                    {p2pBalances?.balances && p2pBalances.balances.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {p2pBalances.balances.map((balance: any) => (
                          <p key={balance.coin} className="text-xs text-muted-foreground">
                            {balance.coin}: {formatAmount(balance.balance, 2)}
                            {parseFloat(balance.frozen) > 0 && (
                              <span className="text-orange-500"> (заморожено: {formatAmount(balance.frozen, 2)})</span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <Lock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Активных ордеров</p>
                    <p className="text-2xl font-bold">{activeOrders.length}</p>
                  </div>
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Транзакций</p>
                    <p className="text-2xl font-bold">{transactions.length}</p>
                  </div>
                  <Receipt className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glassmorphism">
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="glassmorphism">
                  <TabsTrigger value="overview">
                    <Wallet className="mr-2" size={16} />
                    Обзор
                  </TabsTrigger>
                  <TabsTrigger value="balances">
                    <Package className="mr-2" size={16} />
                    Балансы
                  </TabsTrigger>
                  <TabsTrigger value="p2p">
                    <DollarSign className="mr-2" size={16} />
                    P2P
                  </TabsTrigger>
                  <TabsTrigger value="transactions">
                    <Receipt className="mr-2" size={16} />
                    Транзакции
                  </TabsTrigger>
                  <TabsTrigger value="orders">
                    <Activity className="mr-2" size={16} />
                    Ордера
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-4 mt-6">
                  {accountInfo && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-3">Информация об аккаунте</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">User ID:</span>
                              <span className="font-medium">{accountInfo.p2pUserInfo?.uid || accountInfo.uid || 'Не указан'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Email:</span>
                              <span className="font-medium">{accountInfo.email || accountInfo.p2pUserInfo?.emailAddress || 'Не указан'}</span>
                            </div>
                            {accountInfo.p2pUserInfo?.nickName && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">P2P Никнейм:</span>
                                <span className="font-medium">{accountInfo.p2pUserInfo.nickName}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Тип аккаунта:</span>
                              <span className="font-medium">{accountInfo.accountType || 'UNIFIED'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Уровень:</span>
                              <span className="font-medium">{accountInfo.memberLevel || 0}</span>
                            </div>
                            {accountInfo.vipLevel && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">VIP уровень:</span>
                                <Badge variant="secondary">{accountInfo.vipLevel}</Badge>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Unified Margin:</span>
                              <Badge variant={accountInfo.unifiedMarginStatus === 1 ? 'default' : 'outline'}>
                                {accountInfo.unifiedMarginStatus === 1 ? 'Включен' : 'Выключен'}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Обновлен:</span>
                              <span className="font-medium">{formatDate(accountInfo.updatedTime || Date.now())}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {walletBalance && (
                        <Card className="border">
                          <CardContent className="p-4">
                            <h3 className="font-semibold text-lg mb-3">Общие балансы</h3>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Общий капитал:</span>
                                <span className="font-medium">${formatAmount(walletBalance.totalEquityInUSD || '0', 2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Доступный баланс:</span>
                                <span className="font-medium">${formatAmount(walletBalance.totalAvailableBalanceInUSD || '0', 2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Начальная маржа:</span>
                                <span className="font-medium">${formatAmount(walletBalance.totalInitialMarginInUSD || '0', 2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Поддерживающая маржа:</span>
                                <span className="font-medium">${formatAmount(walletBalance.totalMaintenanceMarginInUSD || '0', 2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Маржинальный баланс:</span>
                                <span className="font-medium">${formatAmount(walletBalance.totalMarginBalanceInUSD || '0', 2)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Balances Tab */}
                <TabsContent value="balances" className="space-y-4 mt-6">
                  {(() => {
                    // Collect all coins from different wallet types
                    const allCoins: any[] = [];
                    
                    // Add coins from unified account
                    if (walletBalance?.unified?.coins) {
                      walletBalance.unified.coins.forEach((coin: any) => {
                        allCoins.push({ ...coin, accountType: 'Unified' });
                      });
                    }
                    
                    // Add coins from funding account
                    if (walletBalance?.funding?.coins) {
                      walletBalance.funding.coins.forEach((coin: any) => {
                        allCoins.push({ ...coin, accountType: 'Funding' });
                      });
                    }
                    
                    // Fallback to old format
                    if (allCoins.length === 0 && walletBalance?.coins) {
                      walletBalance.coins.forEach((coin: any) => {
                        allCoins.push({ ...coin, accountType: 'Main' });
                      });
                    }
                    
                    // Filter coins with balance
                    const coinsWithBalance = allCoins.filter(coin => 
                      parseFloat(coin.walletBalance || coin.free || '0') > 0 || 
                      parseFloat(coin.locked || '0') > 0
                    );
                    
                    if (coinsWithBalance.length === 0) {
                      return (
                        <Card className="glassmorphism">
                          <CardContent className="p-6 text-center">
                            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Нет балансов для отображения</p>
                          </CardContent>
                        </Card>
                      );
                    }
                    
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {coinsWithBalance.map((coin, index) => (
                          <Card key={`${coin.coin}-${coin.accountType}-${index}`} className="glassmorphism">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h3 className="font-semibold text-lg">{coin.coin}</h3>
                                  <span className="text-xs text-muted-foreground">{coin.accountType}</span>
                                </div>
                                {coin.usdValue && (
                                  <span className="text-sm text-muted-foreground">
                                    ${formatAmount(coin.usdValue, 2)}
                                  </span>
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Свободно:</span>
                                  <span className="font-medium">
                                    {formatAmount(coin.walletBalance || coin.free || '0', coin.coin === 'USDT' || coin.coin === 'USD' ? 2 : 8)}
                                  </span>
                                </div>
                                
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Заблокировано:</span>
                                  <span className="font-medium">
                                    {formatAmount(coin.locked || '0', coin.coin === 'USDT' || coin.coin === 'USD' ? 2 : 8)}
                                  </span>
                                </div>

                              {coin.equity && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Капитал:</span>
                                  <span className="font-medium">
                                    {formatAmount(coin.equity, coin.coin === 'USDT' ? 2 : 8)}
                                  </span>
                                </div>
                              )}

                              {coin.availableToWithdraw && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Доступно для вывода:</span>
                                  <span className="font-medium">
                                    {formatAmount(coin.availableToWithdraw, coin.coin === 'USDT' ? 2 : 8)}
                                  </span>
                                </div>
                              )}

                              {(coin.unrealisedPnl && parseFloat(coin.unrealisedPnl) !== 0) && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Нереализованный P&L:</span>
                                  <span className={`font-medium ${parseFloat(coin.unrealisedPnl) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {formatAmount(coin.unrealisedPnl, 2)}
                                  </span>
                                </div>
                              )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="space-y-4 mt-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex gap-2">
                      <Button
                        variant={transactionType === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTransactionType('all')}
                      >
                        Все ({transactions.length})
                      </Button>
                      <Button
                        variant={transactionType === 'deposit' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTransactionType('deposit')}
                      >
                        <ArrowDownRight className="mr-1" size={14} />
                        Депозиты
                      </Button>
                      <Button
                        variant={transactionType === 'withdrawal' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTransactionType('withdrawal')}
                      >
                        <ArrowUpRight className="mr-1" size={14} />
                        Выводы
                      </Button>
                      <Button
                        variant={transactionType === 'transfer' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setTransactionType('transfer')}
                      >
                        <Send className="mr-1" size={14} />
                        Переводы
                      </Button>
                    </div>
                  </div>

                  {filteredTransactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет транзакций
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTransactions.map((transaction, index) => (
                        <Card key={index} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Badge variant={
                                  transaction.type === 'deposit' ? 'default' : 
                                  transaction.type === 'withdrawal' ? 'secondary' : 
                                  transaction.type === 'p2p' ? 'destructive' :
                                  'outline'
                                }>
                                  {transaction.type === 'deposit' ? (
                                    <><ArrowDownRight size={12} className="mr-1" />Депозит</>
                                  ) : transaction.type === 'withdrawal' ? (
                                    <><ArrowUpRight size={12} className="mr-1" />Вывод</>
                                  ) : transaction.type === 'p2p' ? (
                                    <><DollarSign size={12} className="mr-1" />P2P {transaction.side}</>
                                  ) : (
                                    <><Send size={12} className="mr-1" />Перевод</>
                                  )}
                                </Badge>
                                <span className="font-semibold">{transaction.coin}</span>
                                {getTransactionStatusBadge(transaction.status, transaction.type)}
                              </div>
                              
                              <div className="flex gap-2">
                                {transaction.txid && (
                                  <Button variant="outline" size="sm">
                                    <Eye size={14} className="mr-1" />
                                    TX
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransaction(transaction);
                                    setChatDialogOpen(true);
                                  }}
                                >
                                  <MessageSquare size={14} className="mr-1" />
                                  Чат
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Сумма:</span>
                                <div className="font-medium">{formatAmount(transaction.amount)} {transaction.coin}</div>
                              </div>
                              
                              {transaction.fee && (
                                <div>
                                  <span className="text-muted-foreground">Комиссия:</span>
                                  <div className="font-medium">{formatAmount(transaction.fee)} {transaction.coin}</div>
                                </div>
                              )}
                              
                              {transaction.toAddress && (
                                <div>
                                  <span className="text-muted-foreground">На адрес:</span>
                                  <div className="font-medium text-xs break-all">
                                    {transaction.toAddress.substring(0, 8)}...{transaction.toAddress.substring(transaction.toAddress.length - 6)}
                                  </div>
                                </div>
                              )}

                              {transaction.toAccountType && (
                                <div>
                                  <span className="text-muted-foreground">На аккаунт:</span>
                                  <div className="font-medium">{transaction.toAccountType}</div>
                                </div>
                              )}

                              {transaction.type === 'p2p' && transaction.price && (
                                <div>
                                  <span className="text-muted-foreground">Цена:</span>
                                  <div className="font-medium">{transaction.price} USDT</div>
                                </div>
                              )}

                              {transaction.type === 'p2p' && transaction.counterparty && (
                                <div>
                                  <span className="text-muted-foreground">Контрагент:</span>
                                  <div className="font-medium">{transaction.counterparty}</div>
                                </div>
                              )}
                              
                              <div>
                                <span className="text-muted-foreground">Дата:</span>
                                <div className="font-medium">
                                  {formatDate(transaction.successAt || transaction.createdTime || transaction.timestamp || '')}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* P2P Tab */}
                <TabsContent value="p2p" className="space-y-4 mt-6">
                  <div className="space-y-6">
                    {/* P2P Balance */}
                    {p2pBalances && (
                      <Card className="border">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-3">P2P Баланс</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Доступно:</span>
                              <div className="font-medium">{formatAmount(p2pBalances.balance || '0', 2)} USDT</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Заморожено:</span>
                              <div className="font-medium">{formatAmount(p2pBalances.frozen || '0', 2)} USDT</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* P2P Ads */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">Мои объявления</h3>
                        <Button 
                          onClick={() => setShowCreateAdDialog(true)}
                          disabled={Array.isArray(p2pAds) && p2pAds.filter(ad => ad.status === '10' || ad.status === 10).length >= 2}
                        >
                          <Plus size={16} className="mr-2" />
                          Создать объявление
                        </Button>
                      </div>
                      {!Array.isArray(p2pAds) || p2pAds.length === 0 ? (
                        <Card className="border">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            Нет активных объявлений
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Array.isArray(p2pAds) && p2pAds.map((ad) => (
                            <Card key={ad.id} className="border">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={ad.side === '1' ? 'destructive' : 'default'}>
                                      {ad.side === '1' ? 'Продажа' : 'Покупка'}
                                    </Badge>
                                    <Badge variant={ad.status === '10' || ad.status === 10 ? 'default' : 'secondary'}>
                                      {ad.status === '10' || ad.status === 10 ? 'Активно' : 'Неактивно'}
                                    </Badge>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setSelectedAd(ad);
                                        setShowEditAdDialog(true);
                                      }}
                                    >
                                      <Edit size={14} />
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="text-red-600"
                                      onClick={async () => {
                                        if (confirm('Вы уверены, что хотите удалить это объявление?')) {
                                          try {
                                            const response = await apiClient.delete(`/bybit/ads/${ad.id}`);
                                            if (response.success) {
                                              await loadAccountData();
                                            } else {
                                              alert('Ошибка удаления объявления: ' + response.error);
                                            }
                                          } catch (error) {
                                            alert('Ошибка удаления объявления');
                                          }
                                        }
                                      }}
                                    >
                                      <Trash2 size={14} />
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Цена:</span>
                                    <span className="font-medium">{ad.price} {ad.currencyId}/{ad.tokenId}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Количество:</span>
                                    <span className="font-medium">{formatAmount(ad.quantity)} {ad.tokenId}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Лимиты:</span>
                                    <span className="font-medium">{ad.minAmount} - {ad.maxAmount} {ad.currencyId}</span>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* P2P Orders */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">P2P Ордера</h3>
                      {!Array.isArray(p2pOrders) || p2pOrders.length === 0 ? (
                        <Card className="border">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            Нет P2P ордеров
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {Array.isArray(p2pOrders) && p2pOrders.map((order) => (
                            <Card key={order.orderId} className="border">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">#{order.orderId.substring(0, 8)}...</Badge>
                                    <Badge variant={order.side === '1' ? 'destructive' : 'default'}>
                                      {order.side === '1' ? 'Продажа' : 'Покупка'}
                                    </Badge>
                                    <Badge variant="secondary">{order.orderStatus}</Badge>
                                  </div>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedTransaction({
                                        type: 'p2p',
                                        orderId: order.orderId,
                                        coin: order.tokenId,
                                        amount: order.quantity,
                                        status: order.orderStatus,
                                        side: order.side === '1' ? 'Sell' : 'Buy',
                                        price: order.price,
                                        counterparty: order.counterpartyNickname
                                      });
                                      setChatDialogOpen(true);
                                    }}
                                  >
                                    <MessageSquare size={14} className="mr-1" />
                                    Чат
                                  </Button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Цена:</span>
                                    <div className="font-medium">{order.price} {order.currencyId}</div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Количество:</span>
                                    <div className="font-medium">{formatAmount(order.quantity)} {order.tokenId}</div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Контрагент:</span>
                                    <div className="font-medium">{order.counterpartyNickname || 'Н/Д'}</div>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Дата:</span>
                                    <div className="font-medium">{formatDate(order.createdDate)}</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="space-y-4 mt-6">
                  <div className="space-y-6">
                    {/* Active Orders */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Активные ордера</h3>
                      {activeOrders.length === 0 ? (
                        <Card className="border">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            Нет активных ордеров
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {activeOrders.map((order) => (
                            <Card key={order.orderId} className="border">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">#{order.orderId.substring(0, 8)}...</Badge>
                                    {getOrderStatusBadge(order.orderStatus)}
                                    <Badge variant={order.side === 'Buy' ? 'default' : 'secondary'}>
                                      {order.side === 'Buy' ? 'Покупка' : 'Продажа'}
                                    </Badge>
                                    <span className="font-semibold">{order.symbol}</span>
                                  </div>
                                  
                                  <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                    Отменить
                                  </Button>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Цена:</span>
                                    <div className="font-medium">{formatAmount(order.price)}</div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Количество:</span>
                                    <div className="font-medium">{formatAmount(order.qty)}</div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Исполнено:</span>
                                    <div className="font-medium">{formatAmount(order.cumExecQty || '0')}</div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Создан:</span>
                                    <div className="font-medium">{formatDate(order.createdTime)}</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Order History */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">История ордеров</h3>
                      {orderHistory.length === 0 ? (
                        <Card className="border">
                          <CardContent className="p-8 text-center text-muted-foreground">
                            Нет истории ордеров
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-3">
                          {orderHistory.map((order) => (
                            <Card key={order.orderId} className="border">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <Badge variant="outline">#{order.orderId.substring(0, 8)}...</Badge>
                                    {getOrderStatusBadge(order.orderStatus)}
                                    <Badge variant={order.side === 'Buy' ? 'default' : 'secondary'}>
                                      {order.side === 'Buy' ? 'Покупка' : 'Продажа'}
                                    </Badge>
                                    <span className="font-semibold">{order.symbol}</span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Цена:</span>
                                    <div className="font-medium">{formatAmount(order.avgPrice || order.price)}</div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Количество:</span>
                                    <div className="font-medium">{formatAmount(order.qty)}</div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Исполнено:</span>
                                    <div className="font-medium">{formatAmount(order.cumExecQty || order.qty)}</div>
                                  </div>
                                  
                                  <div>
                                    <span className="text-muted-foreground">Дата:</span>
                                    <div className="font-medium">{formatDate(order.updatedTime || order.createdTime)}</div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      
      {/* Transaction Chat Dialog */}
      <BybitTransactionChatDialog
        open={chatDialogOpen}
        onOpenChange={setChatDialogOpen}
        transaction={selectedTransaction}
        accountId={accountId}
      />

      {/* Create Ad Dialog */}
      <CreateBybitAdDialog
        isOpen={showCreateAdDialog}
        onClose={() => setShowCreateAdDialog(false)}
        accountId={accountId}
        onCreateAd={async (adData) => {
          try {
            const response = await apiClient.post(`/bybit/accounts/${accountId}/ads`, {
              tokenId: adData.tokenId,
              currencyId: adData.currencyId,
              side: adData.side === 'Sell' ? '1' : '0',
              quantity: adData.amount,
              price: adData.price,
              minAmount: adData.minAmount,
              maxAmount: adData.maxAmount,
              payments: adData.paymentMethodIds,
              remark: adData.remark || '',
              priceType: '0',
              paymentPeriod: '15',
              itemType: 'ORIGIN'
            });
            
            if (response.success) {
              await loadAccountData();
              return { success: true };
            } else {
              return { success: false, error: response.error };
            }
          } catch (error: any) {
            return { success: false, error: error.message };
          }
        }}
      />

      {/* Edit Ad Dialog */}
      {selectedAd && (
        <CreateBybitAdDialog
          isOpen={showEditAdDialog}
          onClose={() => {
            setShowEditAdDialog(false);
            setSelectedAd(null);
          }}
          accountId={accountId}
          onCreateAd={async (adData) => {
            try {
              const response = await apiClient.put(`/bybit/accounts/${accountId}/ads`, {
                adId: selectedAd.id,
                tokenId: adData.tokenId,
                currencyId: adData.currencyId,
                side: adData.side === 'Sell' ? '1' : '0',
                quantity: adData.amount,
                price: adData.price,
                minAmount: adData.minAmount,
                maxAmount: adData.maxAmount,
                payments: adData.paymentMethodIds,
                remark: adData.remark || '',
                priceType: '0',
                paymentPeriod: '15',
                itemType: 'ORIGIN'
              });
              
              if (response.success) {
                await loadAccountData();
                return { success: true };
              } else {
                return { success: false, error: response.error };
              }
            } catch (error: any) {
              return { success: false, error: error.message };
            }
          }}
          initialData={{
            side: selectedAd.side === '1' ? 'Sell' : 'Buy',
            tokenId: selectedAd.tokenId,
            currencyId: selectedAd.currencyId,
            price: selectedAd.price,
            amount: selectedAd.quantity,
            minAmount: selectedAd.minAmount,
            maxAmount: selectedAd.maxAmount,
            paymentMethodIds: [],
            remark: selectedAd.remark
          }}
          editMode={true}
        />
      )}
    </div>
  );
}