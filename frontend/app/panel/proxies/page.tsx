"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  TestTube,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Globe,
  Activity
} from 'lucide-react';
import apiClient from '@/lib/api';

interface Proxy {
  id: number;
  host: string;
  port: number;
  protocol: string;
  status: string;
  responseTime?: number;
  successRate?: number;
  verifiedIP?: string;
  lastChecked?: string;
  lastUsed?: string;
  failureCount: number;
  successCount: number;
  source?: string;
  country?: string;
  notes?: string;
}

interface ProxyStats {
  total: number;
  active: number;
  failed: number;
  testing: number;
  avgResponseTime: number;
  avgSuccessRate: number;
}

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [stats, setStats] = useState<ProxyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingProxy, setTestingProxy] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadProxies();
    loadStats();
  }, [currentPage]);

  const loadProxies = async () => {
    try {
      const response = await apiClient.get(`/proxy/list?page=${currentPage}&limit=20`);
      if (response.success && response.data) {
        setProxies(response.data.proxies);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error loading proxies:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiClient.get('/proxy/status');
      if (response.success && response.data) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error('Error loading proxy stats:', error);
    }
  };

  const testProxy = async (proxyId: number) => {
    setTestingProxy(proxyId);
    try {
      const response = await apiClient.post(`/proxy/test/${proxyId}`);
      if (response.success && response.data) {
        alert(response.data.message);
        // Reload proxies to see updated status
        await loadProxies();
        await loadStats();
      }
    } catch (error: any) {
      alert(`Ошибка тестирования прокси: ${error.message}`);
    } finally {
      setTestingProxy(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      active: { color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckCircle },
      failed: { color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
      testing: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: Clock },
      unknown: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', icon: AlertCircle }
    };
    
    const config = configs[status as keyof typeof configs] || configs.unknown;
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={config.color}>
        <Icon size={12} className="mr-1" />
        {status}
      </Badge>
    );
  };

  const formatResponseTime = (time?: number) => {
    if (!time) return 'N/A';
    return `${time}ms`;
  };

  const formatSuccessRate = (rate?: number) => {
    if (rate === null || rate === undefined) return 'N/A';
    return `${(rate * 100).toFixed(1)}%`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('ru-RU');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <Card className="glassmorphism animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted/50 rounded w-1/3"></div>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted/30 rounded"></div>
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
          <div>
            <h1 className="text-2xl font-bold">Прокси сервера</h1>
            <p className="text-muted-foreground">Управление и тестирование прокси серверов</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => { loadProxies(); loadStats(); }}>
              <RefreshCw size={16} className="mr-2" />
              Обновить
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6"
          >
            <Card className="glassmorphism">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <Globe className="text-blue-500" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Всего</p>
                    <p className="text-xl font-bold">{stats.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-green-500" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Активных</p>
                    <p className="text-xl font-bold">{stats.active}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <XCircle className="text-red-500" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Неработающих</p>
                    <p className="text-xl font-bold">{stats.failed}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <Clock className="text-purple-500" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Средний отклик</p>
                    <p className="text-xl font-bold">{Math.round(stats.avgResponseTime || 0)}ms</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glassmorphism">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                    <Activity className="text-yellow-500" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Успешность</p>
                    <p className="text-xl font-bold">{((stats.avgSuccessRate || 0) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Proxy List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle>Список прокси серверов</CardTitle>
            </CardHeader>
            
            <CardContent>
              {proxies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  Нет прокси серверов
                </div>
              ) : (
                <div className="space-y-3">
                  {proxies.map((proxy) => (
                    <div key={proxy.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-medium">{proxy.host}:{proxy.port}</span>
                          {getStatusBadge(proxy.status)}
                          <Badge variant="outline">{proxy.protocol.toUpperCase()}</Badge>
                          {proxy.country && <Badge variant="outline">{proxy.country}</Badge>}
                        </div>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testProxy(proxy.id)}
                          disabled={testingProxy === proxy.id}
                        >
                          {testingProxy === proxy.id ? (
                            <RefreshCw size={14} className="mr-1 animate-spin" />
                          ) : (
                            <TestTube size={14} className="mr-1" />
                          )}
                          Тест
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Отклик: </span>
                          {formatResponseTime(proxy.responseTime)}
                        </div>
                        <div>
                          <span className="font-medium">Успешность: </span>
                          {formatSuccessRate(proxy.successRate)}
                        </div>
                        <div>
                          <span className="font-medium">Последняя проверка: </span>
                          {formatDate(proxy.lastChecked)}
                        </div>
                        <div>
                          <span className="font-medium">Источник: </span>
                          {proxy.source || 'N/A'}
                        </div>
                      </div>

                      {proxy.verifiedIP && (
                        <div className="text-sm">
                          <span className="font-medium text-green-600">✅ Проверенный IP: </span>
                          <span className="font-mono">{proxy.verifiedIP}</span>
                        </div>
                      )}

                      {proxy.notes && (
                        <div className="text-sm text-muted-foreground bg-muted/30 p-2 rounded">
                          {proxy.notes}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Успехов: {proxy.successCount}</span>
                        <span>Неудач: {proxy.failureCount}</span>
                        {proxy.lastUsed && <span>Использован: {formatDate(proxy.lastUsed)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                  >
                    Назад
                  </Button>
                  
                  <span className="text-sm text-muted-foreground px-4">
                    Страница {currentPage} из {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Далее
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}