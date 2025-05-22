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
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import { useTransactionWebSocketEvents } from '@/hooks/useWebSocketEvents';
import { CreateBybitAdDialog } from '@/components/panel/CreateBybitAdDialog';
import { useBybitAccountData } from '@/hooks/useAccounts';
import apiClient from '@/lib/api';

interface BybitAccount {
  id: number;
  apiKey: string;
  status: string;
  errorMessage?: string;
  lastCheckAt?: string;
  accountInfo?: any;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
  };
}

interface BybitBalance {
  id: number;
  coin: string;
  balance: string;
  frozen: string;
  createdAt: string;
  updatedAt: string;
}

interface BybitAd {
  id: string;
  side: 'Buy' | 'Sell';
  tokenId: string;
  currencyId: string;
  price: string;
  amount: string;
  minAmount: string;
  maxAmount: string;
  paymentMethods: any[];
  remark?: string;
  status: string;
  completedOrderNum: number;
  completedRate: string;
  avgReleaseTime: string;
  createdAt: string;
  updatedAt: string;
}

interface BybitOrder {
  id: string;
  orderStatus: string;
  side: 'Buy' | 'Sell';
  tokenId: string;
  currencyId: string;
  price: string;
  amount: string;
  quantity: string;
  paymentMethod: any;
  counterPartyId: string;
  counterPartyNickName: string;
  adId: string;
  chatId: string;
  lastUpdateTime: string;
  createdAt: string;
  updatedAt: string;
}

export default function BybitAccountDetailPage() {
  const params = useParams();
  const accountId = parseInt(params.id as string);
  
  const [account, setAccount] = useState<BybitAccount | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use consolidated hook for account data
  const {
    balances,
    ads,
    orders,
    loading: dataLoading,
    error: dataError,
    refetch: refetchData,
    syncData,
    createAd,
    updateAd,
    removeAd,
    markOrderAsPaid,
    releaseAsset,
    getChatMessages,
    sendChatMessage
  } = useBybitAccountData(accountId);
  
  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('user-info');
  const [itemsPerPage] = useState(20);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCreateAdDialogOpen, setIsCreateAdDialogOpen] = useState(false);

  // WebSocket integration for real-time updates
  const { setupTransactionListeners, isConnected } = useTransactionWebSocketEvents(accountId, 1); // TODO: Use real user ID

  // Load account info and additional data not in the hook
  const loadAccountData = async () => {
    if (!accountId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get account info from Bybit accounts list
      const accountsResponse = await apiClient.get('/bybit/accounts');
      if (accountsResponse.success && accountsResponse.data) {
        const foundAccount = accountsResponse.data.items.find((acc: any) => acc.id === accountId);
        if (foundAccount) {
          setAccount(foundAccount);
        } else {
          setError('Account not found');
          return;
        }
      }

      // Load additional data
      await loadUserInfo();
      await loadPaymentMethods();
      
    } catch (err) {
      setError('Failed to load account data');
      console.error('Error loading account:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserInfo = async () => {
    try {
      const response = await apiClient.get(`/bybit/accounts/${accountId}/user-info`);
      if (response.success && response.data) {
        setUserInfo(response.data);
      }
    } catch (err) {
      console.error('Error loading user info:', err);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      const response = await apiClient.get(`/bybit/accounts/${accountId}/payment-methods`);
      if (response.success && response.data) {
        setPaymentMethods(response.data);
      }
    } catch (err) {
      console.error('Error loading payment methods:', err);
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
      // Refresh all data when WebSocket events arrive
      loadUserInfo();
      loadPaymentMethods();
      refetchData();
    });

    return cleanup;
  }, [accountId, setupTransactionListeners, refetchData]);

  const handleSync = async () => {
    try {
      setActionLoading('sync');
      const success = await syncData();
      if (success) {
        // Also reload user info and payment methods
        setTimeout(() => {
          loadUserInfo();
          loadPaymentMethods();
        }, 2000);
      }
    } catch (err) {
      console.error('Error syncing account:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkOrderAsPaid = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      await markOrderAsPaid(orderId);
    } catch (err) {
      console.error('Error marking order as paid:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReleaseAsset = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      await releaseAsset(orderId);
    } catch (err) {
      console.error('Error releasing asset:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveAd = async (adId: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить это объявление?')) {
      return;
    }

    try {
      setActionLoading(adId);
      await removeAd(adId);
    } catch (err) {
      console.error('Error removing ad:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateAd = async (adData: any) => {
    return await createAd(adData);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const formatAmount = (amount: string) => {
    return parseFloat(amount).toLocaleString('ru-RU', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 8 
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; text: string; className: string }> = {
      'Online': { 
        variant: 'default', 
        text: 'Онлайн',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      'Offline': { 
        variant: 'secondary', 
        text: 'Оффлайн',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      },
      'Created': { 
        variant: 'secondary', 
        text: 'Создан',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      },
      'Paid': { 
        variant: 'default', 
        text: 'Оплачен',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      },
      'Completed': { 
        variant: 'default', 
        text: 'Завершен',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      'Cancelled': { 
        variant: 'destructive', 
        text: 'Отменен',
        className: 'bg-red-500/10 text-red-500 border-red-500/20'
      }
    };

    const config = statusConfig[status] || { 
      variant: 'outline', 
      text: status,
      className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
    };

    return (
      <Badge variant={config.variant} className={config.className}>
        {config.text}
      </Badge>
    );
  };

  if (loading || dataLoading) {
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

  if (error || dataError) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Card className="glassmorphism max-w-md mx-auto">
            <CardContent className="p-6">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-500">Ошибка</h3>
              <p className="text-muted-foreground mt-2">{error || dataError}</p>
              <div className="flex gap-3 mt-4">
                <Button onClick={loadAccountData} className="flex-1">
                  Попробовать снова
                </Button>
                <Link href="/panel">
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

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p>Аккаунт не найден</p>
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
              <h1 className="text-2xl font-bold">Bybit P2P - {account.apiKey.substring(0, 8)}***</h1>
              <div className="flex items-center gap-2">
                {getStatusBadge(account.status)}
                <Badge variant="outline">ID: {account.id}</Badge>
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
              onClick={handleSync}
              disabled={actionLoading === 'sync'}
            >
              <RefreshCw size={16} className={`mr-2 ${actionLoading === 'sync' ? 'animate-spin' : ''}`} />
              Синхронизировать
            </Button>
            
            <Button variant="outline">
              <Download size={16} className="mr-2" />
              Экспорт
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glassmorphism">
            <CardContent className="p-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="glassmorphism">
                  <TabsTrigger value="user-info">
                    👤 Профиль
                  </TabsTrigger>
                  <TabsTrigger value="payment-methods">
                    💳 Оплата ({paymentMethods.length})
                  </TabsTrigger>
                  <TabsTrigger value="balances">
                    💰 Балансы ({balances.length})
                  </TabsTrigger>
                  <TabsTrigger value="ads">
                    📢 Объявления ({ads.length})
                  </TabsTrigger>
                  <TabsTrigger value="orders">
                    📋 Ордеры ({orders.length})
                  </TabsTrigger>
                </TabsList>

                {/* User Info Tab */}
                <TabsContent value="user-info" className="space-y-4 mt-6">
                  {!userInfo ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет информации о пользователе
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Basic Info */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-3">Основная информация</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Никнейм:</span>
                              <span className="font-medium">{userInfo.nickName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">ID пользователя:</span>
                              <span className="font-medium">{userInfo.bybitUserId}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Тип пользователя:</span>
                              <span className="font-medium">{userInfo.userType}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">KYC уровень:</span>
                              <Badge variant="outline">{userInfo.kycLevel}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">VIP уровень:</span>
                              <Badge variant="secondary">{userInfo.vipLevel || 'N/A'}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Статус:</span>
                              <Badge variant={userInfo.isOnline ? 'default' : 'outline'}>
                                {userInfo.isOnline ? 'В сети' : 'Не в сети'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Trading Stats */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-3">Торговая статистика</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Всего сделок:</span>
                              <span className="font-medium">{userInfo.totalFinishCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Покупок:</span>
                              <span className="font-medium">{userInfo.totalFinishBuyCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Продаж:</span>
                              <span className="font-medium">{userInfo.totalFinishSellCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Рейтинг:</span>
                              <span className="font-medium">{userInfo.recentRate || 'N/A'}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Хорошие отзывы:</span>
                              <span className="font-medium">{userInfo.goodAppraiseRate || 'N/A'}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Ср. время релиза:</span>
                              <span className="font-medium">{userInfo.averageReleaseTime || 'N/A'}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Account Details */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-3">Детали аккаунта</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Дней с создания:</span>
                              <span className="font-medium">{userInfo.accountCreateDays || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Дней торговли:</span>
                              <span className="font-medium">{userInfo.firstTradeDays || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Методов оплаты:</span>
                              <span className="font-medium">{userInfo.paymentCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Контактов:</span>
                              <span className="font-medium">{userInfo.contactCount || 0}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Заблокирован:</span>
                              <Badge variant={userInfo.blocked ? 'destructive' : 'default'}>
                                {userInfo.blocked ? 'Да' : 'Нет'}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Trading Volume */}
                      <Card className="border">
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-3">Торговые объемы</h3>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Общий оборот:</span>
                              <span className="font-medium">{userInfo.totalTradeAmount || '0'} USDT</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Недавний оборот:</span>
                              <span className="font-medium">{userInfo.recentTradeAmount || '0'} USDT</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Недавних сделок:</span>
                              <span className="font-medium">{userInfo.recentFinishCount || 0}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                {/* Payment Methods Tab */}
                <TabsContent value="payment-methods" className="space-y-4 mt-6">
                  {paymentMethods.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет методов оплаты
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paymentMethods.map((payment) => (
                        <Card key={payment.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold">{payment.paymentType}</h3>
                              <Badge variant={payment.online === '1' ? 'default' : 'outline'}>
                                {payment.online === '1' ? 'Активен' : 'Неактивен'}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-sm">
                              {payment.bankName && (
                                <div>
                                  <span className="text-muted-foreground">Банк:</span>
                                  <div className="font-medium">{payment.bankName}</div>
                                </div>
                              )}
                              
                              {payment.accountNo && (
                                <div>
                                  <span className="text-muted-foreground">Номер:</span>
                                  <div className="font-medium">{payment.accountNo}</div>
                                </div>
                              )}
                              
                              {payment.realName && (
                                <div>
                                  <span className="text-muted-foreground">Имя:</span>
                                  <div className="font-medium">{payment.realName}</div>
                                </div>
                              )}

                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={payment.realNameVerified ? 'default' : 'secondary'} className="text-xs">
                                  {payment.realNameVerified ? 'Верифицирован' : 'Не верифицирован'}
                                </Badge>
                                {payment.visible === 1 && (
                                  <Badge variant="outline" className="text-xs">Видимый</Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Balances Tab */}
                <TabsContent value="balances" className="space-y-4 mt-6">
                  {balances.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет балансов
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {balances
                        .filter(balance => parseFloat(balance.balance) > 0 || balance.coin === 'USDT')
                        .map((balance) => (
                        <Card key={balance.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-lg">{balance.coin}</h3>
                              <Badge variant={balance.coin === 'USDT' ? 'default' : 'outline'}>
                                {balance.coin}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Доступно:</span>
                                <span className="font-medium">
                                  {parseFloat(balance.balance).toFixed(balance.coin === 'USDT' ? 2 : 6)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Заморожено:</span>
                                <span className="font-medium">
                                  {parseFloat(balance.frozen || '0').toFixed(balance.coin === 'USDT' ? 2 : 6)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between border-t pt-2">
                                <span className="font-medium">Общий:</span>
                                <span className="font-bold">
                                  {(parseFloat(balance.balance) + parseFloat(balance.frozen || '0')).toFixed(balance.coin === 'USDT' ? 2 : 6)} {balance.coin}
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Ads Tab */}
                <TabsContent value="ads" className="space-y-4 mt-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Мои объявления</h3>
                    <Button onClick={() => setIsCreateAdDialogOpen(true)}>
                      <Plus size={16} className="mr-2" />
                      Создать объявление
                    </Button>
                  </div>

                  {ads.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет объявлений
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {ads.map((ad) => (
                        <Card key={ad.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Badge variant={ad.side === 'Buy' ? 'default' : 'secondary'}>
                                  {ad.side === 'Buy' ? (
                                    <><TrendingUp size={12} className="mr-1" />Покупка</>
                                  ) : (
                                    <><TrendingDown size={12} className="mr-1" />Продажа</>
                                  )}
                                </Badge>
                                <span className="font-semibold">{ad.tokenId}/{ad.currencyId}</span>
                                {getStatusBadge(ad.status)}
                              </div>
                              
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                  <Edit size={14} />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleRemoveAd(ad.id)}
                                  disabled={actionLoading === ad.id}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Цена:</span>
                                <div className="font-medium">{formatAmount(ad.price)} {ad.currencyId}</div>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground">Количество:</span>
                                <div className="font-medium">{formatAmount(ad.amount)} {ad.tokenId}</div>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground">Лимиты:</span>
                                <div className="font-medium">{formatAmount(ad.minAmount)} - {formatAmount(ad.maxAmount)}</div>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground">Успешность:</span>
                                <div className="font-medium">{ad.completedRate}% ({ad.completedOrderNum})</div>
                              </div>
                            </div>
                            
                            {ad.remark && (
                              <div className="mt-3 p-2 bg-muted/30 rounded text-sm">
                                <span className="text-muted-foreground">Примечание: </span>
                                {ad.remark}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Orders Tab */}
                <TabsContent value="orders" className="space-y-4 mt-6">
                  {orders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Нет ордеров
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orders.map((order) => (
                        <Card key={order.id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">#{order.id.substring(0, 8)}...</Badge>
                                {getStatusBadge(order.orderStatus)}
                                <Badge variant={order.side === 'Buy' ? 'default' : 'secondary'}>
                                  {order.side === 'Buy' ? 'Покупка' : 'Продажа'}
                                </Badge>
                                <span className="font-semibold">{order.tokenId}/{order.currencyId}</span>
                              </div>
                              
                              <div className="flex gap-2">
                                {order.orderStatus === 'Created' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleMarkOrderAsPaid(order.id)}
                                    disabled={actionLoading === order.id}
                                  >
                                    <CreditCard size={14} className="mr-1" />
                                    Отметить оплаченным
                                  </Button>
                                )}
                                
                                {order.orderStatus === 'Paid' && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleReleaseAsset(order.id)}
                                    disabled={actionLoading === order.id}
                                  >
                                    <CheckCircle size={14} className="mr-1" />
                                    Отправить активы
                                  </Button>
                                )}
                                
                                <Button variant="outline" size="sm">
                                  <MessageSquare size={14} className="mr-1" />
                                  Чат
                                </Button>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Цена:</span>
                                <div className="font-medium">{formatAmount(order.price)} {order.currencyId}</div>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground">Количество:</span>
                                <div className="font-medium">{formatAmount(order.quantity)} {order.tokenId}</div>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground">Сумма:</span>
                                <div className="font-medium">{formatAmount(order.amount)} {order.currencyId}</div>
                              </div>
                              
                              <div>
                                <span className="text-muted-foreground">Контрагент:</span>
                                <div className="font-medium">{order.counterPartyNickName}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-3">
                              <span>Создан: {formatDate(order.createdAt)}</span>
                              <span>Обновлен: {formatDate(order.lastUpdateTime)}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Create Ad Dialog */}
      <CreateBybitAdDialog
        isOpen={isCreateAdDialogOpen}
        onClose={() => setIsCreateAdDialogOpen(false)}
        onCreateAd={handleCreateAd}
      />
    </div>
  );
}