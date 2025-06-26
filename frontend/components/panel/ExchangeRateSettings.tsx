"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/hooks/useSocket';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Clock,
  DollarSign,
  Activity,
  Info,
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExchangeRateRule {
  id: string;
  name: string;
  priority: number;
  bybitPage: number;
  bybitIndex: number;
  timeStart?: string;
  timeEnd?: string;
  amountMin?: number;
  amountMax?: number;
  priceAdjustmentType?: string;
  priceAdjustmentValue?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExchangeRateData {
  mode: 'constant' | 'automatic';
  constantRate: number;
  currentRate: number;
  updateIntervalMinutes: number;
  lastUpdate: string;
  history: Array<{
    rate: number;
    source: string;
    timestamp: string;
  }>;
  rules?: ExchangeRateRule[];
}

interface BybitStatistics {
  pages: Array<{
    page: number;
    items: Array<{
      index: number;
      price: number;
      minAmount: number;
      maxAmount: number;
      available: number;
      nickname: string;
      payments: string[];
    }>;
  }>;
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
}

export function ExchangeRateSettings() {
  const [data, setData] = useState<ExchangeRateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [constantRate, setConstantRate] = useState('');
  const [mode, setMode] = useState<'constant' | 'automatic'>('constant');
  const [updateInterval, setUpdateInterval] = useState('5');
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<ExchangeRateRule | null>(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [statistics, setStatistics] = useState<BybitStatistics | null>(null);
  const [testingRule, setTestingRule] = useState(false);
  
  const { socket } = useSocket();
  const { toast } = useToast();

  // Rule form state
  const [ruleForm, setRuleForm] = useState({
    name: '',
    priority: '100',
    bybitPage: '1',
    bybitIndex: '1',
    timeStart: '',
    timeEnd: '',
    amountMin: '',
    amountMax: '',
    priceAdjustmentType: 'none',
    priceAdjustmentValue: '0',
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, [socket]);

  const loadData = async () => {
    if (!socket?.connected) return;
    
    setLoading(true);
    try {
      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('rates:get', {}, (res: any) => {
          if (res.success) {
            resolve(res.data);
          } else {
            reject(res.error);
          }
        });
      });
      
      setData(response);
      setConstantRate(response.constantRate.toString());
      setMode(response.mode);
      setUpdateInterval((response.updateIntervalMinutes || 5).toString());

      // Load rules if in automatic mode
      if (response.mode === 'automatic') {
        loadRules();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить данные о курсе',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRules = async () => {
    if (!socket?.connected) return;

    try {
      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('rates:getRules', {}, (res: any) => {
          if (res.success) {
            resolve(res.data);
          } else {
            reject(res.error);
          }
        });
      });

      setData(prev => prev ? { ...prev, rules: response } : null);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  const loadStatistics = async () => {
    if (!socket?.connected) return;

    try {
      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('rates:getBybitStatistics', { pages: 3 }, (res: any) => {
          if (res.success) {
            resolve(res.data);
          } else {
            reject(res.error);
          }
        });
      });

      setStatistics(response);
      setShowStatistics(true);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить статистику Bybit',
        variant: 'destructive',
      });
    }
  };

  const updateConstantRate = async () => {
    if (!socket?.connected || !constantRate) return;
    
    setUpdating(true);
    try {
      await new Promise<void>((resolve, reject) => {
        socket.emit('rates:setConstant', 
          { rate: parseFloat(constantRate) }, 
          (response: any) => {
            if (response.success) {
              resolve();
            } else {
              reject(new Error(response.error?.message || 'Failed to update rate'));
            }
          }
        );
      });
      
      toast({
        title: 'Успешно',
        description: 'Курс обновлен',
      });
      
      loadData();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить курс',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const toggleMode = async () => {
    if (!socket?.connected) return;
    
    const newMode = mode === 'constant' ? 'automatic' : 'constant';
    
    try {
      await new Promise<void>((resolve, reject) => {
        socket.emit('rates:toggleMode', {}, (response: any) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error?.message || 'Failed to toggle mode'));
          }
        });
      });
      
      setMode(newMode);
      toast({
        title: 'Успешно',
        description: `Режим изменен на ${newMode === 'constant' ? 'константный' : 'автоматический'}`,
      });
      
      loadData();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось изменить режим',
        variant: 'destructive',
      });
    }
  };

  const updateConfig = async () => {
    if (!socket?.connected) return;

    try {
      await new Promise<void>((resolve, reject) => {
        socket.emit('rates:updateConfig', {
          updateIntervalMinutes: parseInt(updateInterval)
        }, (response: any) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error?.message || 'Failed to update config'));
          }
        });
      });

      toast({
        title: 'Успешно',
        description: 'Настройки обновлены',
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить настройки',
        variant: 'destructive',
      });
    }
  };

  const saveRule = async () => {
    if (!socket?.connected) return;

    const ruleData = {
      name: ruleForm.name,
      priority: parseInt(ruleForm.priority),
      bybitPage: parseInt(ruleForm.bybitPage),
      bybitIndex: parseInt(ruleForm.bybitIndex),
      timeStart: ruleForm.timeStart || null,
      timeEnd: ruleForm.timeEnd || null,
      amountMin: ruleForm.amountMin ? parseFloat(ruleForm.amountMin) : null,
      amountMax: ruleForm.amountMax ? parseFloat(ruleForm.amountMax) : null,
      priceAdjustmentType: ruleForm.priceAdjustmentType,
      priceAdjustmentValue: parseFloat(ruleForm.priceAdjustmentValue),
      enabled: ruleForm.enabled
    };

    try {
      if (editingRule) {
        await new Promise<void>((resolve, reject) => {
          socket.emit('rates:updateRule', {
            id: editingRule.id,
            ...ruleData
          }, (response: any) => {
            if (response.success) {
              resolve();
            } else {
              reject(new Error(response.error?.message || 'Failed to update rule'));
            }
          });
        });
      } else {
        await new Promise<void>((resolve, reject) => {
          socket.emit('rates:createRule', ruleData, (response: any) => {
            if (response.success) {
              resolve();
            } else {
              reject(new Error(response.error?.message || 'Failed to create rule'));
            }
          });
        });
      }

      toast({
        title: 'Успешно',
        description: editingRule ? 'Правило обновлено' : 'Правило создано',
      });

      setShowRuleDialog(false);
      setEditingRule(null);
      resetRuleForm();
      loadRules();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить правило',
        variant: 'destructive',
      });
    }
  };

  const deleteRule = async (id: string) => {
    if (!socket?.connected || !confirm('Вы уверены, что хотите удалить это правило?')) return;

    try {
      await new Promise<void>((resolve, reject) => {
        socket.emit('rates:deleteRule', { id }, (response: any) => {
          if (response.success) {
            resolve();
          } else {
            reject(new Error(response.error?.message || 'Failed to delete rule'));
          }
        });
      });

      toast({
        title: 'Успешно',
        description: 'Правило удалено',
      });

      loadRules();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить правило',
        variant: 'destructive',
      });
    }
  };

  const testRule = async () => {
    if (!socket?.connected) return;

    setTestingRule(true);
    try {
      const result = await new Promise<any>((resolve, reject) => {
        socket.emit('rates:testRule', {
          bybitPage: parseInt(ruleForm.bybitPage),
          bybitIndex: parseInt(ruleForm.bybitIndex),
          priceAdjustmentType: ruleForm.priceAdjustmentType,
          priceAdjustmentValue: parseFloat(ruleForm.priceAdjustmentValue)
        }, (response: any) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to test rule'));
          }
        });
      });

      toast({
        title: 'Результат теста',
        description: `Базовая цена: ${result.basePrice} ₽, Итоговая цена: ${result.finalPrice} ₽`,
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось протестировать правило',
        variant: 'destructive',
      });
    } finally {
      setTestingRule(false);
    }
  };

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      priority: '100',
      bybitPage: '1',
      bybitIndex: '1',
      timeStart: '',
      timeEnd: '',
      amountMin: '',
      amountMax: '',
      priceAdjustmentType: 'none',
      priceAdjustmentValue: '0',
      enabled: true
    });
  };

  const editRule = (rule: ExchangeRateRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      priority: rule.priority.toString(),
      bybitPage: rule.bybitPage.toString(),
      bybitIndex: rule.bybitIndex.toString(),
      timeStart: rule.timeStart || '',
      timeEnd: rule.timeEnd || '',
      amountMin: rule.amountMin?.toString() || '',
      amountMax: rule.amountMax?.toString() || '',
      priceAdjustmentType: rule.priceAdjustmentType || 'none',
      priceAdjustmentValue: rule.priceAdjustmentValue?.toString() || '0',
      enabled: rule.enabled
    });
    setShowRuleDialog(true);
  };

  const formatTime = (time: string) => {
    if (!time) return '-';
    return time;
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (!amount) return '-';
    return amount.toLocaleString('ru-RU');
  };

  const formatAdjustment = (type?: string, value?: number) => {
    if (!type || type === 'none') return '-';
    if (type === 'percentage') return `${value}%`;
    if (type === 'fixed') return `${value} ₽`;
    return '-';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="animate-spin h-6 w-6 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Настройки курса USDT/RUB
              </CardTitle>
              <CardDescription>
                Управление курсом обмена для всех операций
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={mode === 'automatic' ? 'default' : 'secondary'}>
                {mode === 'automatic' ? 'Автоматический' : 'Константный'}
              </Badge>
              {data && (
                <Badge variant="outline" className="text-lg px-3">
                  {data.currentRate.toFixed(2)} ₽
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label>Режим работы</Label>
              <div className="text-sm text-muted-foreground">
                {mode === 'constant' 
                  ? 'Используется фиксированный курс'
                  : 'Курс обновляется автоматически из Bybit P2P'}
              </div>
            </div>
            <Switch
              checked={mode === 'automatic'}
              onCheckedChange={toggleMode}
            />
          </div>

          <Tabs defaultValue="settings" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Настройки</TabsTrigger>
              <TabsTrigger value="rules" disabled={mode !== 'automatic'}>
                Правила {data?.rules && `(${data.rules.length})`}
              </TabsTrigger>
              <TabsTrigger value="history">История</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4">
              {/* Constant Rate */}
              <div className="space-y-2">
                <Label htmlFor="constantRate">
                  {mode === 'constant' ? 'Текущий курс' : 'Резервный курс'}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="constantRate"
                    type="number"
                    step="0.01"
                    value={constantRate}
                    onChange={(e) => setConstantRate(e.target.value)}
                    placeholder="78.50"
                  />
                  <Button
                    onClick={updateConstantRate}
                    disabled={updating || !constantRate}
                  >
                    {updating ? (
                      <RefreshCw className="animate-spin h-4 w-4" />
                    ) : (
                      'Обновить'
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {mode === 'constant' 
                    ? 'Этот курс используется для всех операций' 
                    : 'Используется когда автоматический режим недоступен'}
                </p>
              </div>

              {/* Update Interval */}
              {mode === 'automatic' && (
                <div className="space-y-2">
                  <Label htmlFor="updateInterval">
                    Интервал обновления (минуты)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="updateInterval"
                      type="number"
                      min="1"
                      max="60"
                      value={updateInterval}
                      onChange={(e) => setUpdateInterval(e.target.value)}
                    />
                    <Button onClick={updateConfig} variant="outline">
                      Сохранить
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Как часто обновлять курс из Bybit P2P
                  </p>
                </div>
              )}

              {/* Statistics Button */}
              {mode === 'automatic' && (
                <div className="pt-4">
                  <Button 
                    onClick={loadStatistics} 
                    variant="outline"
                    className="w-full"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Показать статистику Bybit P2P
                  </Button>
                </div>
              )}

              {/* Last Update */}
              {data && (
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Последнее обновление:</span>
                    <span>{new Date(data.lastUpdate).toLocaleString('ru-RU')}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="rules" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Правила определяют, откуда брать курс в зависимости от времени и суммы
                </p>
                <Button onClick={() => setShowRuleDialog(true)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить правило
                </Button>
              </div>

              {data?.rules && data.rules.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Название</TableHead>
                        <TableHead>Приоритет</TableHead>
                        <TableHead>Время</TableHead>
                        <TableHead>Сумма</TableHead>
                        <TableHead>Источник</TableHead>
                        <TableHead>Корректировка</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{rule.name}</TableCell>
                          <TableCell>{rule.priority}</TableCell>
                          <TableCell>
                            {formatTime(rule.timeStart || '')} - {formatTime(rule.timeEnd || '')}
                          </TableCell>
                          <TableCell>
                            {formatAmount(rule.amountMin)} - {formatAmount(rule.amountMax)}
                          </TableCell>
                          <TableCell>
                            P{rule.bybitPage}#{rule.bybitIndex}
                          </TableCell>
                          <TableCell>
                            {formatAdjustment(rule.priceAdjustmentType, rule.priceAdjustmentValue)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                              {rule.enabled ? 'Активно' : 'Отключено'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => editRule(rule)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Нет правил</p>
                  <p className="text-sm">Добавьте правила для автоматического режима</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {data?.history && data.history.length > 0 ? (
                <div className="space-y-2">
                  {data.history.slice(0, 20).map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{item.rate.toFixed(2)} ₽</Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.source}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>История пуста</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Rule Dialog */}
      <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Редактировать правило' : 'Новое правило'}
            </DialogTitle>
            <DialogDescription>
              Настройте условия для автоматического выбора курса
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  placeholder="Дневной курс"
                />
              </div>
              <div className="space-y-2">
                <Label>Приоритет</Label>
                <Input
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm({ ...ruleForm, priority: e.target.value })}
                  placeholder="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Время начала</Label>
                <Input
                  type="time"
                  value={ruleForm.timeStart}
                  onChange={(e) => setRuleForm({ ...ruleForm, timeStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Время окончания</Label>
                <Input
                  type="time"
                  value={ruleForm.timeEnd}
                  onChange={(e) => setRuleForm({ ...ruleForm, timeEnd: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Минимальная сумма (₽)</Label>
                <Input
                  type="number"
                  value={ruleForm.amountMin}
                  onChange={(e) => setRuleForm({ ...ruleForm, amountMin: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Максимальная сумма (₽)</Label>
                <Input
                  type="number"
                  value={ruleForm.amountMax}
                  onChange={(e) => setRuleForm({ ...ruleForm, amountMax: e.target.value })}
                  placeholder="1000000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Страница Bybit</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={ruleForm.bybitPage}
                  onChange={(e) => setRuleForm({ ...ruleForm, bybitPage: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Позиция на странице</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={ruleForm.bybitIndex}
                  onChange={(e) => setRuleForm({ ...ruleForm, bybitIndex: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Корректировка цены</Label>
                <Select
                  value={ruleForm.priceAdjustmentType}
                  onValueChange={(value) => setRuleForm({ ...ruleForm, priceAdjustmentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без корректировки</SelectItem>
                    <SelectItem value="percentage">Процент</SelectItem>
                    <SelectItem value="fixed">Фиксированная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Значение корректировки</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={ruleForm.priceAdjustmentValue}
                  onChange={(e) => setRuleForm({ ...ruleForm, priceAdjustmentValue: e.target.value })}
                  placeholder="0"
                  disabled={ruleForm.priceAdjustmentType === 'none'}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={ruleForm.enabled}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, enabled: checked })}
              />
              <Label>Правило активно</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
              Отмена
            </Button>
            <Button
              variant="secondary"
              onClick={testRule}
              disabled={testingRule}
            >
              {testingRule ? (
                <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Тест
            </Button>
            <Button onClick={saveRule}>
              {editingRule ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statistics Dialog */}
      <Dialog open={showStatistics} onOpenChange={setShowStatistics}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Статистика Bybit P2P</DialogTitle>
            <DialogDescription>
              Текущие цены USDT/RUB на первых страницах
            </DialogDescription>
          </DialogHeader>

          {statistics && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Средняя цена</div>
                    <div className="text-2xl font-bold">{statistics.averagePrice.toFixed(2)} ₽</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Минимальная</div>
                    <div className="text-2xl font-bold text-green-600">{statistics.minPrice.toFixed(2)} ₽</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Максимальная</div>
                    <div className="text-2xl font-bold text-red-600">{statistics.maxPrice.toFixed(2)} ₽</div>
                  </CardContent>
                </Card>
              </div>

              {statistics.pages.map((page) => (
                <div key={page.page} className="space-y-2">
                  <h3 className="font-semibold">Страница {page.page}</h3>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Продавец</TableHead>
                          <TableHead>Цена</TableHead>
                          <TableHead>Лимиты</TableHead>
                          <TableHead>Доступно</TableHead>
                          <TableHead>Способы оплаты</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {page.items.map((item) => (
                          <TableRow key={`${page.page}-${item.index}`}>
                            <TableCell>{item.index}</TableCell>
                            <TableCell className="font-medium">{item.nickname}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.price.toFixed(2)} ₽</Badge>
                            </TableCell>
                            <TableCell>
                              {item.minAmount.toLocaleString('ru-RU')} - {item.maxAmount.toLocaleString('ru-RU')}
                            </TableCell>
                            <TableCell>{item.available.toLocaleString('ru-RU')} USDT</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {item.payments.slice(0, 3).map((payment, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {payment}
                                  </Badge>
                                ))}
                                {item.payments.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{item.payments.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}