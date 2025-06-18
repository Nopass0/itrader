"use client";

import { useState, useEffect } from "react";
import { socketApi } from '@/services/socket-api';
import { motion, AnimatePresence } from "framer-motion";
import { 
  PlusCircle, 
  RefreshCw, 
  Trash, 
  ExternalLink, 
  Check,
  CheckCircle,
  AlertCircle,
  Clock,
  Shield,
  MoreHorizontal,
  Eye,
  EyeOff
} from "lucide-react";
import { useTheme } from "next-themes";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ParticlesContainer, DotPattern, AnimatedText } from "@/components/ui/particles";
import { useToast } from "@/components/ui/use-toast";
import { useAuthStore } from "@/store/auth";
import { RobotEmoji, MoneyBagEmoji, ChartIncreasingEmoji } from "@/components/ui/animated-emoji";
import { AddAccountDialog } from "@/components/panel/AddAccountDialog";
import { useGateAccounts, useBybitAccounts, GateAccount, BybitAccount } from "@/hooks/useAccounts";
import { useGateDashboardStats, useGateAccountData } from '@/hooks/useGateAccount';
import { useGmailAccounts } from '@/hooks/useGmailAccounts';

// Status badge component
const StatusBadge: React.FC<{ status: string; errorMessage?: string }> = ({ status, errorMessage }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return { 
          variant: 'default' as const, 
          icon: Check, 
          text: 'Активен',
          className: 'bg-green-500/10 text-green-500 border-green-500/20'
        };
      case 'initializing':
        return { 
          variant: 'secondary' as const, 
          icon: Clock, 
          text: 'Инициализация',
          className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
        };
      case 'error':
        return { 
          variant: 'destructive' as const, 
          icon: AlertCircle, 
          text: 'Ошибка',
          className: 'bg-red-500/10 text-red-500 border-red-500/20'
        };
      case 'disabled':
        return { 
          variant: 'outline' as const, 
          icon: Shield, 
          text: 'Отключен',
          className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
        };
      default:
        return { 
          variant: 'outline' as const, 
          icon: AlertCircle, 
          text: 'Неизвестно',
          className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant} 
      className={`flex items-center gap-1 ${config.className}`}
      title={errorMessage}
    >
      <Icon size={12} />
      {config.text}
    </Badge>
  );
};

// Mini chart component
const MiniChart: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-16 w-full bg-muted/20 rounded flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Нет данных</span>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => parseFloat(d.turnover_usdt || '0')));
  const points = data.map((item, index) => {
    const value = parseFloat(item.turnover_usdt || '0');
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - (value / maxValue) * 80;
    return `${x},${y}`;
  }).join(' ');

  const lastValue = parseFloat(data[data.length - 1]?.turnover_usdt || '0');
  const prevValue = parseFloat(data[data.length - 2]?.turnover_usdt || '0');
  const isUp = lastValue > prevValue;

  return (
    <div className="h-16 w-full relative">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`gradient-${data[0]?.date}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
            <stop offset="100%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity={0} />
          </linearGradient>
        </defs>
        
        <polygon
          points={`0,100 ${points} 100,100`}
          fill={`url(#gradient-${data[0]?.date})`}
        />
        
        <polyline
          points={points}
          fill="none"
          stroke={isUp ? "#10b981" : "#ef4444"}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      
      <div className={`absolute top-1 right-1 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
        isUp ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
      }`}>
        <span className="font-medium">
          {((lastValue - prevValue) / prevValue * 100).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

// Countdown timer component
const NextUpdateTimer: React.FC<{ nextUpdateAt?: string }> = ({ nextUpdateAt }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!nextUpdateAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const target = new Date(nextUpdateAt).getTime();
      const difference = target - now;

      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setTimeLeft('Обновление...');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [nextUpdateAt]);

  if (!nextUpdateAt) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Clock size={12} />
      <span>До обновления: {timeLeft}</span>
    </div>
  );
};

// Gate account card component
const GateAccountCard: React.FC<{ 
  account: GateAccount; 
  onDelete: (id: string) => Promise<boolean>;
  onRefresh: () => void;
}> = ({ account, onDelete, onRefresh }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const { toast } = useToast();
  
  const { stats } = useGateDashboardStats(parseInt(account.id) || 0, 'week');
  const { transactions, smsMessages, pushNotifications, totalCounts, triggerSync } = useGateAccountData(parseInt(account.id) || 0);

  const handleDelete = async () => {
    if (window.confirm('Вы уверены, что хотите удалить этот аккаунт?')) {
      const success = await onDelete(account.id);
      if (success) {
        toast({
          title: "Аккаунт удален",
          description: "Аккаунт Gate.cx успешно удален",
        });
      }
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await triggerSync();
      onRefresh();
      toast({
        title: "Синхронизация запущена",
        description: "Данные обновятся в течение нескольких секунд",
      });
    } catch (error) {
      toast({
        title: "Ошибка синхронизации",
        description: "Не удалось запустить синхронизацию",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      const response = await socketApi.emit('accounts:updateGateAccount', {
        id: account.id,
        updates: { isActive: !account.isActive }
      });
      
      if (response.success) {
        onRefresh();
        toast({
          title: account.isActive ? "Аккаунт отключен" : "Аккаунт включен",
          description: account.isActive ? 
            "Аккаунт больше не будет использоваться для операций" : 
            "Аккаунт теперь будет использоваться для операций",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус аккаунта",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Calculate summary stats
  const totalTurnoverUSDT = stats?.graph.reduce((sum, item) => sum + parseFloat(item.turnover_usdt || '0'), 0) || 0;
  const totalTransactions = stats?.graph.reduce((sum, item) => sum + item.total, 0) || 0;
  const successRate = stats?.graph && stats.graph.length > 0 
    ? ((stats.graph.reduce((sum, item) => sum + item.successes, 0) / totalTransactions) * 100) 
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="group"
    >
      <Card className="glassmorphism hover:shadow-lg transition-all duration-300 border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <RobotEmoji size={20} />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  Gate.cx
                  <Badge variant="outline" className="text-xs">ID: {account.id}</Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {showDetails ? account.email : account.email.replace(/(.{3}).*(@.*)/, "$1***$2")}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails ? <EyeOff size={12} /> : <Eye size={12} />}
                  </Button>
                </CardDescription>
              </div>
            </div>
            <StatusBadge status={account.status} errorMessage={account.errorMessage} />
          </div>
          
          {account.nextUpdateAt && (
            <NextUpdateTimer nextUpdateAt={account.nextUpdateAt} />
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Mini Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Оборот (7 дней)</span>
              <span className="font-medium">${totalTurnoverUSDT.toFixed(2)}</span>
            </div>
            <MiniChart data={stats?.graph || []} />
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ChartIncreasingEmoji size={12} />
                <span>Транзакции</span>
              </div>
              <div className="text-sm font-medium">{totalTransactions}</div>
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle size={12} />
                <span>Успешность</span>
              </div>
              <div className="text-sm font-medium">{successRate.toFixed(1)}%</div>
            </div>
          </div>
          
          {/* Transaction Status */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Статус транзакций</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <Clock size={10} />
                  <span>Ожидает</span>
                </div>
                <div className="text-xs font-medium">{totalCounts.pendingTransactions || 0}</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                  <AlertCircle size={10} />
                  <span>В процессе</span>
                </div>
                <div className="text-xs font-medium">{totalCounts.inProcessTransactions || 0}</div>
              </div>
            </div>
          </div>

          {account.status === 'error' && account.errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-sm text-red-500 font-medium">Ошибка:</div>
              <div className="text-xs text-red-400 mt-1">{account.errorMessage}</div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between pt-0">
          <div className="text-xs text-muted-foreground">
            {account.lastCheckAt 
              ? `Проверен: ${new Date(account.lastCheckAt).toLocaleTimeString()}`
              : `Создан: ${new Date(account.createdAt).toLocaleTimeString()}`
            }
          </div>
          <div className="flex gap-2">
            <Button
              variant={account.isActive ? "ghost" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={handleToggleActive}
              disabled={isToggling}
              title={account.isActive ? "Отключить аккаунт" : "Включить аккаунт"}
            >
              {account.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleSync}
              disabled={isSyncing || !account.isActive}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(`/panel/gate/${account.id}`, '_blank')}
            >
              <ExternalLink size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash size={14} />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

// Bybit account card component
const BybitAccountCard: React.FC<{ 
  account: BybitAccount; 
  onDelete: (id: string) => Promise<boolean>;
  onRefresh: () => void;
}> = ({ account, onDelete, onRefresh }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [p2pAds, setP2PAds] = useState<any[]>([]);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const { toast } = useToast();

  // Load account info and P2P data
  const loadAccountInfo = async () => {
    if (account.status !== 'active') return;
    
    setLoadingInfo(true);
    try {
      // Get account stats from Socket API
      const response = await socketApi.accounts.getBybitAccountStats(account.id.toString());
      if (response.success && response.data) {
        setAccountInfo(response.data);
      }

      // Try to load advertisements
      try {
        const adsResponse = await socketApi.advertisements.list({ 
          bybitAccountId: account.id.toString() 
        });
        if (adsResponse.success && adsResponse.data) {
          const ads = adsResponse.data.data || [];
          setP2PAds(Array.isArray(ads) ? ads : []);
        }
      } catch (err) {
        console.error('Failed to load ads:', err);
      }
    } catch (error) {
      console.error('Failed to load account info:', error);
    } finally {
      setLoadingInfo(false);
    }
  };

  useEffect(() => {
    loadAccountInfo();
  }, [account.id, account.status]);

  const handleDelete = async () => {
    if (window.confirm('Вы уверены, что хотите удалить этот аккаунт?')) {
      const success = await onDelete(account.id);
      if (success) {
        toast({
          title: "Аккаунт удален",
          description: "Аккаунт Bybit успешно удален",
        });
      }
    }
  };

  const handleToggleActive = async () => {
    setIsToggling(true);
    try {
      const response = await socketApi.emit('accounts:updateBybitAccount', {
        id: account.id,
        updates: { isActive: !account.isActive }
      });
      
      if (response.success) {
        onRefresh();
        toast({
          title: account.isActive ? "Аккаунт отключен" : "Аккаунт включен",
          description: account.isActive ? 
            "Аккаунт больше не будет использоваться для операций" : 
            "Аккаунт теперь будет использоваться для операций",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось изменить статус аккаунта",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  // Get display email - check p2pInfo from enriched data first
  const p2pEmail = account.accountInfo?.p2pInfo?.email || 
                   account.accountInfo?.p2pInfo?.emailAddress || 
                   accountInfo?.p2pUserInfo?.emailAddress || '';
  const displayEmail = account.accountInfo?.email || 
                      p2pEmail.replace(/\*/g, '') || 
                      accountInfo?.email || 
                      account.apiKey.substring(0, 8) + '...';
  
  // Get UID - check p2pInfo from enriched data first
  const uid = account.accountInfo?.uid || 
              account.accountInfo?.p2pInfo?.userId || 
              account.accountInfo?.p2pInfo?.uid || 
              accountInfo?.p2pUserInfo?.uid || 
              accountInfo?.uid || 
              null;
  
  // Count active ads (status 10 means active)
  const activeAds = p2pAds.filter(ad => ad.status === '10' || ad.status === 10).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="group"
    >
      <Card className="glassmorphism hover:shadow-lg transition-all duration-300 border-primary/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/10">
                <MoneyBagEmoji size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="truncate min-w-0">{displayEmail}</span>
                  {activeAds > 0 && (
                    <Badge variant="default" className="text-xs whitespace-nowrap flex-shrink-0">
                      {activeAds} активн.
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {uid ? (
                    <>UID: {uid}</>
                  ) : (
                    <>API: {showDetails ? account.apiKey : account.apiKey.substring(0, 8) + '...'}</>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails ? <EyeOff size={12} /> : <Eye size={12} />}
                  </Button>
                </CardDescription>
              </div>
            </div>
            <StatusBadge status={account.status} errorMessage={account.errorMessage} />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {account.status === 'active' && accountInfo && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Тип аккаунта</div>
                  <div className="font-medium">{accountInfo?.accountInfo?.accountType || accountInfo?.accountType || 'UNIFIED'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">KYC</div>
                  <div className="font-medium">{accountInfo?.accountInfo?.kycLevel || accountInfo?.kycLevel || 'Не указан'}</div>
                </div>
              </div>
              
              {accountInfo.walletBalance && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Общий баланс</div>
                  <div className="font-medium text-lg">
                    ${parseFloat(accountInfo.walletBalance.totalEquityInUSD || '0').toFixed(2)}
                  </div>
                </div>
              )}

              {p2pAds.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Активных объявлений: {activeAds} из {p2pAds.length} (макс. 2)
                </div>
              )}
            </div>
          )}

          {account.status === 'active' && loadingInfo && (
            <div className="text-center p-4">
              <RefreshCw size={16} className="animate-spin mx-auto" />
              <div className="text-xs text-muted-foreground mt-1">Загрузка...</div>
            </div>
          )}

          {account.status === 'error' && account.errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-sm text-red-500 font-medium">Ошибка:</div>
              <div className="text-xs text-red-400 mt-1">{account.errorMessage}</div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between pt-0">
          <div className="text-xs text-muted-foreground">
            {account.lastCheckAt 
              ? `Проверен: ${new Date(account.lastCheckAt).toLocaleTimeString()}`
              : `Создан: ${new Date(account.createdAt).toLocaleTimeString()}`
            }
          </div>
          <div className="flex gap-2">
            <Button
              variant={account.isActive ? "ghost" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={handleToggleActive}
              disabled={isToggling}
              title={account.isActive ? "Отключить аккаунт" : "Включить аккаунт"}
            >
              {account.isActive ? <Eye size={14} /> : <EyeOff size={14} />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                loadAccountInfo();
                onRefresh();
              }}
              disabled={loadingInfo || !account.isActive}
            >
              <RefreshCw size={14} className={loadingInfo ? 'animate-spin' : ''} />
            </Button>
            <Button
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(`/panel/bybit/${account.id}`, '_blank')}
            >
              <ExternalLink size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash size={14} />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default function AccountsPage() {
  const { resolvedTheme } = useTheme();
  const { isMockMode } = useAuthStore();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  
  const { 
    accounts: gateAccounts, 
    isLoading: gateLoading, 
    error: gateError, 
    refetch: refetchGate,
    deleteAccount: deleteGateAccount
  } = useGateAccounts();
  
  const { 
    accounts: bybitAccounts, 
    isLoading: bybitLoading, 
    error: bybitError, 
    refetch: refetchBybit,
    deleteAccount: deleteBybitAccount
  } = useBybitAccounts();
  
  const {
    accounts: gmailAccounts,
    loading: gmailLoading,
    refresh: refreshGmail,
    deleteAccount: deleteGmailAccount
  } = useGmailAccounts();

  const handleRefreshAll = () => {
    refetchGate();
    refetchBybit();
    refreshGmail();
  };

  const handleAccountAdded = () => {
    refetchGate();
    refetchBybit();
    refreshGmail();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <ParticlesContainer className="absolute inset-0 -z-10" quantity={20} />
      <DotPattern
        className="absolute inset-0 -z-5 opacity-30"
        dotSpacing={30}
        dotSize={resolvedTheme === 'dark' ? 1.5 : 1}
      />
      
      <div className="container mx-auto p-6 space-y-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <RobotEmoji size={32} />
              <AnimatedText>Управление аккаунтами</AnimatedText>
            </h1>
            <p className="text-muted-foreground mt-2">
              Добавляйте и управляйте торговыми аккаунтами Gate.cx и Bybit
              {isMockMode && (
                <Badge variant="outline" className="ml-2 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                  Демо-режим
                </Badge>
              )}
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRefreshAll}
              className="glass-button"
            >
              <RefreshCw size={16} className="mr-2" />
              Обновить
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)} className="glass-button">
              <PlusCircle size={16} className="mr-2" />
              Добавить аккаунт
            </Button>
          </div>
        </motion.div>

        {/* Content */}
        <Tabs defaultValue="gate" className="space-y-6">
          <TabsList className="glassmorphism">
            <TabsTrigger value="gate" className="flex items-center gap-2">
              <RobotEmoji size={16} />
              Gate.cx ({gateAccounts.length})
            </TabsTrigger>
            <TabsTrigger value="bybit" className="flex items-center gap-2">
              <MoneyBagEmoji size={16} />
              Bybit ({bybitAccounts.length})
            </TabsTrigger>
            <TabsTrigger value="gmail" className="flex items-center gap-2">
              📧
              Gmail ({gmailAccounts.length})
            </TabsTrigger>
          </TabsList>

          {/* Gate.cx Accounts */}
          <TabsContent value="gate">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {gateLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="glassmorphism animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-primary/20 rounded w-3/4"></div>
                        <div className="h-3 bg-primary/10 rounded w-1/2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="h-3 bg-primary/20 rounded"></div>
                          <div className="h-3 bg-primary/10 rounded w-3/4"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : gateError ? (
                <Card className="glassmorphism border-red-500/20">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-500">Ошибка загрузки</h3>
                    <p className="text-muted-foreground mt-2">{gateError}</p>
                    <Button onClick={refetchGate} className="mt-4">
                      Попробовать снова
                    </Button>
                  </CardContent>
                </Card>
              ) : gateAccounts.length === 0 ? (
                <Card className="glassmorphism">
                  <CardContent className="p-12 text-center">
                    <RobotEmoji size={48} className="mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold">Нет аккаунтов Gate.cx</h3>
                    <p className="text-muted-foreground mt-2">
                      Добавьте первый аккаунт Gate.cx для начала работы
                    </p>
                    <Button 
                      onClick={() => setIsAddDialogOpen(true)} 
                      className="mt-4"
                    >
                      <PlusCircle size={16} className="mr-2" />
                      Добавить аккаунт
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {gateAccounts.map((account) => (
                      <GateAccountCard
                        key={account.id}
                        account={account}
                        onDelete={deleteGateAccount}
                        onRefresh={refetchGate}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Bybit Accounts */}
          <TabsContent value="bybit">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              {bybitLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="glassmorphism animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-primary/20 rounded w-3/4"></div>
                        <div className="h-3 bg-primary/10 rounded w-1/2"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="h-3 bg-primary/20 rounded"></div>
                          <div className="h-3 bg-primary/10 rounded w-3/4"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : bybitError ? (
                <Card className="glassmorphism border-red-500/20">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-red-500">Ошибка загрузки</h3>
                    <p className="text-muted-foreground mt-2">{bybitError}</p>
                    <Button onClick={refetchBybit} className="mt-4">
                      Попробовать снова
                    </Button>
                  </CardContent>
                </Card>
              ) : bybitAccounts.length === 0 ? (
                <Card className="glassmorphism">
                  <CardContent className="p-12 text-center">
                    <MoneyBagEmoji size={48} className="mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold">Нет аккаунтов Bybit</h3>
                    <p className="text-muted-foreground mt-2">
                      Добавьте первый аккаунт Bybit для начала работы
                    </p>
                    <Button 
                      onClick={() => setIsAddDialogOpen(true)} 
                      className="mt-4"
                    >
                      <PlusCircle size={16} className="mr-2" />
                      Добавить аккаунт
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {bybitAccounts.map((account) => (
                      <BybitAccountCard
                        key={account.id}
                        account={account}
                        onDelete={deleteBybitAccount}
                        onRefresh={refetchBybit}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Gmail Accounts */}
          <TabsContent value="gmail">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {gmailLoading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">Загрузка Gmail аккаунтов...</p>
                </div>
              ) : gmailAccounts.length === 0 ? (
                <Card className="col-span-full glassmorphism">
                  <CardContent className="text-center py-16">
                    <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
                      <span className="text-4xl">📧</span>
                    </div>
                    <h3 className="text-lg font-medium mb-2">Нет Gmail аккаунтов</h3>
                    <p className="text-muted-foreground mb-6">
                      Добавьте Gmail аккаунт для получения чеков и уведомлений
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <PlusCircle size={16} className="mr-2" />
                      Добавить Gmail
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                gmailAccounts.map((account, index) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="glassmorphism hover:glow-card group">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-xl">📧</span>
                              Gmail
                            </CardTitle>
                            <CardDescription className="mt-1">
                              {account.email}
                            </CardDescription>
                          </div>
                          <Badge variant={account.isActive ? "default" : "secondary"}>
                            {account.isActive ? "Активен" : "Неактивен"}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Статус токена:</span>
                            <Badge variant={account.hasRefreshToken ? "outline" : "destructive"}>
                              {account.hasRefreshToken ? "Авторизован" : "Требуется авторизация"}
                            </Badge>
                          </div>
                          
                          {account.lastSync && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-muted-foreground">Последняя синхронизация:</span>
                              <span className="text-sm">
                                {new Date(account.lastSync).toLocaleString('ru-RU')}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Добавлен:</span>
                            <span className="text-sm">
                              {new Date(account.createdAt).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                      
                      <CardFooter className="gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteGmailAccount(account.id)}
                          className="flex-1"
                        >
                          <Trash size={14} className="mr-1" />
                          Удалить
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Account Dialog */}
      <AddAccountDialog
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAccountAdded={handleAccountAdded}
      />
    </div>
  );
}