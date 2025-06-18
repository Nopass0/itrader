'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSocket } from '@/hooks/useSocket';
import { toast } from '@/components/ui/use-toast';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  Save, 
  AlertCircle,
  Zap,
  Lock,
  Unlock,
  Globe,
  Calculator,
  ArrowRightLeft,
  Info,
  Trash2, 
  Timer,
  Database,
  Shield,
  Bell,
  Palette,
  Activity,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';

interface ExchangeRateData {
  mode: 'automatic' | 'constant';
  currentRate: number;
  constantRate: number;
  lastUpdate: string;
  source?: string;
}

type SettingsSection = 'exchange-rate' | 'logs' | 'security' | 'notifications' | 'appearance' | 'system';

interface SettingsMenuItem {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  description: string;
  adminOnly?: boolean;
}

const settingsMenu: SettingsMenuItem[] = [
  {
    id: 'exchange-rate',
    label: 'Курс валют',
    icon: <DollarSign className="h-5 w-5" />,
    description: 'Настройка обменного курса USDT/RUB'
  },
  {
    id: 'logs',
    label: 'Логирование',
    icon: <Database className="h-5 w-5" />,
    description: 'Управление системными логами',
    adminOnly: true
  },
  {
    id: 'security',
    label: 'Безопасность',
    icon: <Shield className="h-5 w-5" />,
    description: 'Настройки безопасности и доступа'
  },
  {
    id: 'notifications',
    label: 'Уведомления',
    icon: <Bell className="h-5 w-5" />,
    description: 'Настройка уведомлений системы'
  },
  {
    id: 'appearance',
    label: 'Внешний вид',
    icon: <Palette className="h-5 w-5" />,
    description: 'Темы и настройки интерфейса'
  },
  {
    id: 'system',
    label: 'Система',
    icon: <Activity className="h-5 w-5" />,
    description: 'Общие настройки системы',
    adminOnly: true
  }
];

export default function SettingsPage() {
  const socket = useSocket();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('exchange-rate');
  
  // Exchange rate settings
  const [rateMode, setRateMode] = useState<'automatic' | 'constant'>('constant');
  const [constantRate, setConstantRate] = useState<string>('');
  const [currentRate, setCurrentRate] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [source, setSource] = useState<string>('');
  
  // Log cleanup settings
  const [cleanupEnabled, setCleanupEnabled] = useState(true);
  const [cleanupInterval, setCleanupInterval] = useState(1);
  const [cleanupTime, setCleanupTime] = useState(3);
  const [loadingCleanup, setLoadingCleanup] = useState(false);
  const [savingCleanup, setSavingCleanup] = useState(false);

  // Загрузка текущих настроек
  const fetchSettings = async () => {
    if (!socket) return;
    
    setLoading(true);
    try {
      const response = await socket.emitWithAck('rates:get');
      if (response.success) {
        const data: ExchangeRateData = response.data;
        setRateMode(data.mode);
        setCurrentRate(data.currentRate);
        setConstantRate(data.constantRate.toString());
        setLastUpdate(data.lastUpdate);
        setSource(data.source || '');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchCleanupSettings();
  }, [socket]);

  // Подписка на изменения курса
  useEffect(() => {
    if (!socket) return;

    const handleRateChange = (data: { oldRate: number; newRate: number; mode: string }) => {
      // Обновляем текущий курс при получении события
      setCurrentRate(data.newRate);
      setRateMode(data.mode as 'automatic' | 'constant');
      setLastUpdate(new Date().toISOString());
      
      toast({
        title: "Курс обновлен",
        description: `Новый курс: ${data.newRate.toFixed(2)} RUB за 1 USDT`
      });
    };

    const unsubscribe = socket.on('rate:changed', handleRateChange);

    return unsubscribe;
  }, [socket]);

  // Сохранение настроек курса
  const saveRateSettings = async () => {
    if (!socket) return;
    
    setSaving(true);
    try {
      // Сохранение константного курса
      if (rateMode === 'constant' && constantRate) {
        const response = await socket.emitWithAck('rates:setConstant', {
          rate: parseFloat(constantRate)
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Ошибка сохранения курса');
        }
      }

      toast({
        title: "Успешно",
        description: "Настройки курса сохранены"
      });
      
      // Обновляем данные
      fetchSettings();
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось сохранить настройки",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Принудительное обновление курса
  const forceUpdateRate = async () => {
    if (!socket || rateMode !== 'automatic') return;
    
    try {
      const response = await socket.emitWithAck('rates:forceUpdate');
      if (response.success) {
        toast({
          title: "Успешно",
          description: "Курс обновлен"
        });
        fetchSettings();
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить курс",
        variant: "destructive"
      });
    }
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'operator';
  const isAdminOnly = user?.role === 'admin';
  
  // Загрузка настроек очистки логов
  const fetchCleanupSettings = async () => {
    if (!socket) return;
    
    setLoadingCleanup(true);
    try {
      const response = await socket.emitWithAck('logs:getCleanupConfig');
      if (response.success) {
        setCleanupEnabled(response.data.enabled);
        setCleanupInterval(response.data.intervalDays);
        setCleanupTime(response.data.runAtHour);
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить настройки очистки логов",
        variant: "destructive"
      });
    } finally {
      setLoadingCleanup(false);
    }
  };
  
  // Сохранение настроек очистки
  const saveCleanupSettings = async () => {
    if (!socket) return;
    
    setSavingCleanup(true);
    try {
      const response = await socket.emitWithAck('logs:setCleanupConfig', {
        enabled: cleanupEnabled,
        intervalDays: cleanupInterval,
        runAtHour: cleanupTime
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Ошибка сохранения настроек');
      }
      
      toast({
        title: "Успешно",
        description: "Настройки очистки логов сохранены"
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось сохранить настройки",
        variant: "destructive"
      });
    } finally {
      setSavingCleanup(false);
    }
  };
  
  // Ручная очистка логов
  const cleanupNow = async () => {
    if (!socket) return;
    
    try {
      const response = await socket.emitWithAck('logs:cleanupNow');
      if (response.success) {
        toast({
          title: "Успешно",
          description: "Очистка логов выполнена"
        });
      } else {
        throw new Error(response.error || 'Ошибка очистки');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось выполнить очистку",
        variant: "destructive"
      });
    }
  };

  // Filter menu items based on user role
  const availableMenuItems = settingsMenu.filter(item => 
    !item.adminOnly || isAdminOnly
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <span>Панель</span>
        <ChevronRight className="h-4 w-4" />
        <span>Настройки</span>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">
          {availableMenuItems.find(item => item.id === activeSection)?.label || 'Настройки'}
        </span>
      </div>
      
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
          <Settings className="h-6 lg:h-8 w-6 lg:w-8" />
          Настройки системы
        </h1>
        <p className="text-sm lg:text-base text-muted-foreground mt-2">
          Управление параметрами работы системы
        </p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6">
        {/* Mobile Navigation */}
        <div className="lg:hidden">
          <Select value={activeSection} onValueChange={(value) => setActiveSection(value as SettingsSection)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableMenuItems.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop Sidebar Navigation */}
        <div className="hidden lg:block lg:col-span-3">
          <Card className="shadow-lg sticky top-6">
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="p-4 space-y-1">
                {availableMenuItems.map((item) => (
                  <motion.button
                    key={item.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-all group",
                      "hover:bg-primary/5",
                      activeSection === item.id && "bg-primary/10 text-primary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          activeSection === item.id 
                            ? "bg-primary/20 text-primary" 
                            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        )}>
                          {item.icon}
                        </div>
                        <div className="text-left">
                          <p className={cn(
                            "font-medium transition-colors text-sm xl:text-base",
                            activeSection === item.id && "text-primary"
                          )}>
                            {item.label}
                          </p>
                          <p className="text-xs text-muted-foreground hidden xl:block">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      {activeSection === item.id && (
                        <ChevronRight className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Exchange Rate Settings */}
              {activeSection === 'exchange-rate' && (
                <div className="space-y-6">
                  {/* Main Exchange Rate Card */}
                  <Card className="shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 lg:p-8">
                      <CardTitle className="flex items-center gap-2 text-xl lg:text-2xl">
                        <DollarSign className="h-6 w-6 lg:h-7 lg:w-7" />
                        Курс валют USDT/RUB
                      </CardTitle>
                      <CardDescription className="text-sm lg:text-base">
                        Настройка источника и значения обменного курса
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 lg:p-8 space-y-6">
                      {/* Текущий курс - Enhanced */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm lg:text-base font-medium flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5" />
                              Текущий курс
                            </span>
                            {source && (
                              <Badge variant="outline" className="text-xs">
                                <Globe className="h-3 w-3 mr-1" />
                                {source}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-primary">
                              {currentRate.toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground">RUB/USDT</span>
                          </div>
                          {lastUpdate && (
                            <p className="text-xs text-muted-foreground mt-3">
                              Обновлено: {new Date(lastUpdate).toLocaleString('ru-RU')}
                            </p>
                          )}
                        </div>
                        
                        <div className="p-6 bg-muted/50 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm lg:text-base font-medium flex items-center gap-2">
                              <Calculator className="h-4 w-4 lg:h-5 lg:w-5" />
                              Калькулятор
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">100 USDT =</span>
                              <span className="font-semibold">{(currentRate * 100).toFixed(2)} RUB</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">1000 RUB =</span>
                              <span className="font-semibold">{(1000 / currentRate).toFixed(2)} USDT</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-6 bg-gradient-to-br from-green-500/5 to-green-600/10 rounded-xl">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm lg:text-base font-medium flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5" />
                              Тренд
                            </span>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Изменение за сутки</span>
                              <span className="font-semibold text-green-600">+0.00%</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Мин/Макс</span>
                              <span className="font-semibold text-xs">{currentRate.toFixed(2)} / {currentRate.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

            <Separator />

            {/* Режим курса */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Режим работы</Label>
              
              <div className="space-y-3">
                {/* Автоматический режим - всегда заблокирован */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-colors",
                    "bg-muted/30 opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-secondary">
                      <Zap className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        Автоматический курс
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Курс обновляется автоматически из внешних источников
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={false}
                    disabled={true}
                    aria-label="Автоматический режим (заблокирован)"
                  />
                </motion.div>

                {/* Константный режим - всегда включен */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-lg border transition-colors",
                    "bg-primary/10 border-primary/20"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/20">
                      <Calculator className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        Фиксированный курс
                        <Badge variant="default" className="text-xs">
                          Активно
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Использовать заданное значение курса
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={true}
                    disabled={true}
                    aria-label="Константный режим (всегда включен)"
                  />
                </motion.div>
              </div>
            </div>

            {/* Настройка константного курса */}
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="constant-rate" className="text-base font-medium flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Фиксированный курс
                </Label>
                <div className="flex gap-3">
                  <div className="relative max-w-xs">
                    <Input
                      id="constant-rate"
                      type="number"
                      step="0.01"
                      placeholder="Например: 95.50"
                      value={constantRate}
                      onChange={(e) => setConstantRate(e.target.value)}
                      disabled={!isAdmin}
                      className="pr-16 text-lg"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      RUB
                    </span>
                  </div>
                  {!isAdmin && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4" />
                      <span>Только для администраторов</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Этот курс будет использоваться для всех операций
                </p>
              </div>

            </motion.div>

            {/* Информационный блок */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg flex gap-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">Информация о режимах</p>
                <p>
                  В текущей версии системы доступен только фиксированный курс. 
                  Автоматическое обновление курса временно отключено для стабильности работы.
                </p>
              </div>
            </div>

            {/* Кнопки действий */}
            {isAdmin && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={saveRateSettings}
                  disabled={saving || !constantRate}
                  className="shadow-sm"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Сохранить настройки
                    </>
                  )}
                </Button>
              </div>
            )}
                    </CardContent>
                  </Card>
                  
                  {/* Statistics Card */}
                  <Card className="shadow-lg">
                    <CardHeader className="p-6 lg:p-8">
                      <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                        <Activity className="h-5 w-5 lg:h-6 lg:w-6" />
                        Статистика курса
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 lg:p-8">
                      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">MIN за сутки</p>
                          <p className="text-2xl font-bold">-</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">MAX за сутки</p>
                          <p className="text-2xl font-bold">-</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Изменение</p>
                          <p className="text-2xl font-bold text-green-600">-</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Обновлений</p>
                          <p className="text-2xl font-bold">-</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Logs Settings */}
              {activeSection === 'logs' && (
                <div className="space-y-6">
                  {/* Log Cleanup Settings */}
                  <Card className="shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-orange-500/5 to-orange-600/10 p-6 lg:p-8">
                      <CardTitle className="flex items-center gap-2 text-xl lg:text-2xl">
                        <Trash2 className="h-6 w-6 lg:h-7 lg:w-7" />
                        Автоочистка логов
                      </CardTitle>
                      <CardDescription className="text-sm lg:text-base">
                        Настройка автоматической очистки старых логов
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 lg:p-8 space-y-6">
            {/* Включение/выключение автоочистки */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Timer className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Автоматическая очистка</p>
                  <p className="text-sm text-muted-foreground">Удалять старые логи автоматически</p>
                </div>
              </div>
              <Switch
                checked={cleanupEnabled}
                onCheckedChange={setCleanupEnabled}
                disabled={!isAdminOnly || loadingCleanup}
              />
            </div>
            
            {cleanupEnabled && (
              <div className="space-y-4">
                <Separator />
                
                {/* Интервал хранения */}
                <div className="space-y-2">
                  <Label htmlFor="cleanup-interval" className="text-base font-medium">
                    Период хранения логов
                  </Label>
                  <Select
                    value={cleanupInterval.toString()}
                    onValueChange={(value) => setCleanupInterval(parseInt(value))}
                    disabled={!isAdminOnly}
                  >
                    <SelectTrigger id="cleanup-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 день</SelectItem>
                      <SelectItem value="3">3 дня</SelectItem>
                      <SelectItem value="7">7 дней</SelectItem>
                      <SelectItem value="14">14 дней</SelectItem>
                      <SelectItem value="30">30 дней</SelectItem>
                      <SelectItem value="60">60 дней</SelectItem>
                      <SelectItem value="90">90 дней</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Логи старше указанного периода будут автоматически удалены
                  </p>
                </div>
                
                {/* Время запуска очистки */}
                <div className="space-y-2">
                  <Label htmlFor="cleanup-time" className="text-base font-medium">
                    Время запуска очистки
                  </Label>
                  <Select
                    value={cleanupTime.toString()}
                    onValueChange={(value) => setCleanupTime(parseInt(value))}
                    disabled={!isAdminOnly}
                  >
                    <SelectTrigger id="cleanup-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={i.toString()}>
                          {i.toString().padStart(2, '0')}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Время запуска ежедневной очистки (по времени сервера)
                  </p>
                </div>
              </div>
            )}
            
            {!isAdminOnly && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg flex gap-3">
                <Lock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-900 dark:text-yellow-100">
                  <p className="font-medium mb-1">Доступ ограничен</p>
                  <p>
                    Только администраторы могут изменять настройки очистки логов
                  </p>
                </div>
              </div>
            )}
            
            {/* Кнопки действий */}
            {isAdminOnly && (
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={saveCleanupSettings}
                  disabled={savingCleanup || loadingCleanup}
                  className="shadow-sm"
                >
                  {savingCleanup ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Сохранить настройки
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={cleanupNow}
                  className="shadow-sm"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Очистить сейчас
                </Button>
              </div>
            )}
                    </CardContent>
                  </Card>
                  
                  {/* Log Statistics Card */}
                  <Card className="shadow-lg">
                    <CardHeader className="p-6 lg:p-8">
                      <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                        <Database className="h-5 w-5 lg:h-6 lg:w-6" />
                        Статистика логов
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 lg:p-8">
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Всего логов</p>
                          <p className="text-2xl font-bold">-</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">За сутки</p>
                          <p className="text-2xl font-bold">-</p>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Ошибок</p>
                          <p className="text-2xl font-bold text-red-600">-</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Security Settings */}
              {activeSection === 'security' && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-shield/5 to-shield/10">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-6 w-6" />
                      Настройки безопасности
                    </CardTitle>
                    <CardDescription>
                      Управление безопасностью учетной записи и доступом
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Настройки безопасности в разработке</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Notifications Settings */}
              {activeSection === 'notifications' && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-bell/5 to-bell/10">
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-6 w-6" />
                      Настройки уведомлений
                    </CardTitle>
                    <CardDescription>
                      Управление уведомлениями системы
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center py-12 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Настройки уведомлений в разработке</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Appearance Settings */}
              {activeSection === 'appearance' && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-palette/5 to-palette/10">
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-6 w-6" />
                      Настройки внешнего вида
                    </CardTitle>
                    <CardDescription>
                      Персонализация интерфейса
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center py-12 text-muted-foreground">
                      <Palette className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Настройки внешнего вида в разработке</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* System Settings */}
              {activeSection === 'system' && (
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-activity/5 to-activity/10">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-6 w-6" />
                      Системные настройки
                    </CardTitle>
                    <CardDescription>
                      Общие настройки системы
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-center py-12 text-muted-foreground">
                      <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Системные настройки в разработке</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}