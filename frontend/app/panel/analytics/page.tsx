"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/use-toast';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Activity,
  Users,
  ShoppingCart,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  Calendar
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { cn } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface AnalyticsData {
  totalRevenueUSDT: number;
  totalExpenseUSDT: number;
  grossProfitUSDT: number;
  spreadPercentage: number;
  averageSpreadUSDT: number;
  averageOrderValueRUB: number;
  averageOrderValueUSDT: number;
  publishedAdvertisements: number;
  totalOrders: number;
  cancelledOrders: number;
  completedOrdersGate: number;
  completedOrdersBybit: number;
  startDate: string;
  endDate: string;
}

interface HistoricalDataPoint extends AnalyticsData {
  timestamp: string;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    to: new Date()
  });
  const [interval, setInterval] = useState<'hour' | 'day' | 'week'>('day');
  
  const { socket } = useSocket();
  const { toast } = useToast();

  useEffect(() => {
    if (socket?.connected && dateRange.from && dateRange.to) {
      loadAnalytics();
    }
  }, [socket, dateRange]);

  const loadAnalytics = async () => {
    if (!socket?.connected) return;
    
    setLoading(true);
    try {
      // Get analytics
      const analyticsResponse = await new Promise<any>((resolve, reject) => {
        socket.emit('analytics:get', {
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString()
        }, (res: any) => {
          if (res.success) {
            resolve(res.data);
          } else {
            reject(res.error);
          }
        });
      });
      
      setAnalytics(analyticsResponse);
      
      // Get historical data
      const historicalResponse = await new Promise<any>((resolve, reject) => {
        socket.emit('analytics:getHistorical', {
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
          interval
        }, (res: any) => {
          if (res.success) {
            resolve(res.data);
          } else {
            reject(res.error);
          }
        });
      });
      
      setHistoricalData(historicalResponse);
    } catch (error) {
      console.error('Analytics error:', error);
      toast({
        title: 'Ошибка',
        description: error?.message || 'Не удалось загрузить аналитику',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number, currency: 'USDT' | 'RUB' = 'USDT') => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency === 'USDT' ? 'USD' : 'RUB',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value).replace('$', currency === 'USDT' ? 'USDT ' : '');
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getSpreadColor = (spread: number) => {
    if (spread >= 5) return 'text-green-600';
    if (spread >= 3) return 'text-yellow-600';
    if (spread >= 0) return 'text-orange-600';
    return 'text-red-600';
  };

  // Chart data
  const revenueChartData = {
    labels: historicalData.map(d => new Date(d.timestamp).toLocaleDateString('ru-RU')),
    datasets: [
      {
        label: 'Доход (USDT)',
        data: historicalData.map(d => d.totalRevenueUSDT),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.3
      },
      {
        label: 'Расход (USDT)',
        data: historicalData.map(d => d.totalExpenseUSDT),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.3
      },
      {
        label: 'Прибыль (USDT)',
        data: historicalData.map(d => d.grossProfitUSDT),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3
      }
    ]
  };

  const spreadChartData = {
    labels: historicalData.map(d => new Date(d.timestamp).toLocaleDateString('ru-RU')),
    datasets: [
      {
        label: 'Спред (%)',
        data: historicalData.map(d => d.spreadPercentage),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.3
      }
    ]
  };

  const ordersChartData = {
    labels: ['Завершенные Gate', 'Завершенные Bybit', 'Отмененные'],
    datasets: [
      {
        data: [
          analytics?.completedOrdersGate || 0,
          analytics?.completedOrdersBybit || 0,
          analytics?.cancelledOrders || 0
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(239, 68, 68, 0.8)'
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(239, 68, 68)'
        ],
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right' as const,
      },
    },
  };

  if (loading && !analytics) {
    return (
      <div className="w-full px-6 py-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin h-8 w-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Аналитика</h1>
            <p className="text-muted-foreground">
              Подробная статистика по операциям и финансовым показателям
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker
              from={dateRange.from}
              to={dateRange.to}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={loadAnalytics}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {analytics && (
          <>
            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Валовая выручка
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.totalRevenueUSDT)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Получено на Gate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Валовый расход
                  </CardTitle>
                  <TrendingDown className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.totalExpenseUSDT)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Потрачено на Bybit
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Валовая прибыль
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(analytics.grossProfitUSDT)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Разница доходов и расходов
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Спред
                  </CardTitle>
                  <Activity className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className={cn("text-2xl font-bold", getSpreadColor(analytics.spreadPercentage))}>
                    {formatPercentage(analytics.spreadPercentage)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    (Выручка × 100 / Расход) - 100
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Средние показатели</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Средняя заявка (RUB):</span>
                    <span className="font-medium">{formatCurrency(analytics.averageOrderValueRUB, 'RUB')}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Средняя заявка (USDT):</span>
                    <span className="font-medium">{formatCurrency(analytics.averageOrderValueUSDT)}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Средний спред:</span>
                      <span className="font-medium">{formatCurrency(analytics.averageSpreadUSDT)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Объявления и ордера</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Опубликовано объявлений:</span>
                    <Badge variant="outline">{analytics.publishedAdvertisements}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Всего ордеров:</span>
                    <Badge variant="outline">{analytics.totalOrders}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Отменено:</span>
                    <Badge variant="destructive">{analytics.cancelledOrders}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Завершенные ордера</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Gate:</span>
                    <Badge variant="default" className="bg-green-500">
                      {analytics.completedOrdersGate}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Bybit:</span>
                    <Badge variant="default" className="bg-blue-500">
                      {analytics.completedOrdersBybit}
                    </Badge>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Соответствие:</span>
                      {analytics.completedOrdersGate === analytics.completedOrdersBybit ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Совпадает
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Не совпадает
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <Tabs defaultValue="revenue" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="revenue">Доходы и расходы</TabsTrigger>
                <TabsTrigger value="spread">Динамика спреда</TabsTrigger>
                <TabsTrigger value="orders">Распределение ордеров</TabsTrigger>
              </TabsList>

              <TabsContent value="revenue" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Динамика доходов, расходов и прибыли</CardTitle>
                    <CardDescription>
                      Изменение финансовых показателей за выбранный период
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historicalData.length > 0 ? (
                      <Line data={revenueChartData} options={chartOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-64 text-muted-foreground">
                        Нет данных для отображения
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="spread" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Динамика спреда</CardTitle>
                    <CardDescription>
                      Изменение процента спреда за выбранный период
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {historicalData.length > 0 ? (
                      <Line data={spreadChartData} options={chartOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-64 text-muted-foreground">
                        Нет данных для отображения
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="orders" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Распределение ордеров</CardTitle>
                    <CardDescription>
                      Соотношение завершенных и отмененных ордеров
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-w-md mx-auto">
                      <Doughnut data={ordersChartData} options={doughnutOptions} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Interval Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Интервал группировки данных</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    variant={interval === 'hour' ? 'default' : 'outline'}
                    onClick={() => setInterval('hour')}
                  >
                    По часам
                  </Button>
                  <Button
                    variant={interval === 'day' ? 'default' : 'outline'}
                    onClick={() => setInterval('day')}
                  >
                    По дням
                  </Button>
                  <Button
                    variant={interval === 'week' ? 'default' : 'outline'}
                    onClick={() => setInterval('week')}
                  >
                    По неделям
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}