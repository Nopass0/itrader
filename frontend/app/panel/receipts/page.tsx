"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Search, 
  Filter,
  Download,
  Eye,
  Trash2,
  FileText,
  Link2,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  User,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { useReceipts } from '@/hooks/useReceipts';
import { useBadReceipts } from '@/hooks/useBadReceipts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSocketApi } from '@/hooks/useSocketApi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BadReceiptsTable } from '@/components/panel/BadReceiptsTable';

export default function ReceiptsPage() {
  const { isConnected } = useSocketApi();
  const {
    receipts,
    totalCount,
    totalPages,
    loading,
    error,
    stats,
    filters,
    updateFilters,
    loadReceipts,
    deleteReceipt,
    matchUnmatchedReceipts,
    downloadPDF
  } = useReceipts();

  const {
    badReceipts,
    loading: badReceiptsLoading,
    stats: badReceiptsStats,
    loadBadReceipts,
    downloadBadReceipt,
    deleteBadReceipt,
    loadStats: loadBadReceiptsStats
  } = useBadReceipts();

  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [selectedBadReceipt, setSelectedBadReceipt] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [matching, setMatching] = useState(false);
  const [activeTab, setActiveTab] = useState('good');
  const [badReceiptsPage, setBadReceiptsPage] = useState(1);
  const [badReceiptsTotalPages, setBadReceiptsTotalPages] = useState(1);

  useEffect(() => {
    if (activeTab === 'bad' && isConnected) {
      loadBadReceiptsData();
    }
  }, [activeTab, badReceiptsPage, isConnected]);

  const loadBadReceiptsData = async () => {
    try {
      const result = await loadBadReceipts({
        limit: 20,
        offset: (badReceiptsPage - 1) * 20
      });
      if (result) {
        setBadReceiptsTotalPages(Math.ceil(result.total / 20));
      }
      await loadBadReceiptsStats();
    } catch (error) {
      console.error('Failed to load bad receipts:', error);
    }
  };

  const handleMatchUnmatched = async () => {
    setMatching(true);
    const result = await matchUnmatchedReceipts();
    setMatching(false);
    
    if (result) {
      alert(`Сопоставлено ${result.matchedCount} из ${result.unmatchedTotal} чеков`);
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('ru-RU');
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; text: string; className: string }> = {
      'success': { 
        variant: 'default', 
        icon: CheckCircle,
        text: 'Успешно',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      'SUCCESS': { 
        variant: 'default', 
        icon: CheckCircle,
        text: 'Успешно',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      'matched': { 
        variant: 'default', 
        icon: CheckCircle,
        text: 'Сопоставлен',
        className: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      },
      'pending': { 
        variant: 'secondary', 
        icon: Clock,
        text: 'В обработке',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      },
      'PENDING': { 
        variant: 'secondary', 
        icon: Clock,
        text: 'В обработке',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      },
      'failed': { 
        variant: 'destructive', 
        icon: XCircle,
        text: 'Ошибка',
        className: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      'FAILED': { 
        variant: 'destructive', 
        icon: XCircle,
        text: 'Ошибка',
        className: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      'manual': { 
        variant: 'secondary', 
        icon: User,
        text: 'Вручную',
        className: 'bg-purple-500/10 text-purple-500 border-purple-500/20'
      }
    };

    const config = statusConfig[status] || statusConfig['pending'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon size={12} className="mr-1" />
        {config.text}
      </Badge>
    );
  };

  return (
    <div className="w-full px-6 py-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              Управление чеками
              {isConnected && (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Real-time
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              {activeTab === 'good' ? 'Чеки от Тинькофф банка' : 'Чеки от других отправителей'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {activeTab === 'good' && (
              <Button 
                variant="outline" 
                onClick={handleMatchUnmatched}
                disabled={matching || !stats || stats.summary.unmatched === 0}
              >
                {matching ? (
                  <>
                    <RefreshCw className="animate-spin mr-2" size={16} />
                    Сопоставление...
                  </>
                ) : (
                  <>
                    <Link2 size={16} className="mr-2" />
                    Сопоставить ({stats?.summary.unmatched || 0})
                  </>
                )}
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => {
                if (activeTab === 'good') {
                  loadReceipts();
                } else {
                  loadBadReceiptsData();
                }
              }}
            >
              <RefreshCw size={16} className="mr-2" />
              Обновить
            </Button>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="good">Чеки от T-Bank</TabsTrigger>
            <TabsTrigger value="bad">Другие чеки</TabsTrigger>
          </TabsList>

          {/* Good Receipts Tab */}
          <TabsContent value="good" className="space-y-6">
            {/* Statistics */}
            {stats && (
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
                        <p className="text-sm text-muted-foreground">Всего чеков</p>
                        <p className="text-2xl font-bold">{stats.summary.total}</p>
                      </div>
                      <Receipt className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Сопоставлено</p>
                        <p className="text-2xl font-bold text-green-500">{stats.summary.matched}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Не сопоставлено</p>
                        <p className="text-2xl font-bold text-yellow-500">{stats.summary.unmatched}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Общая сумма</p>
                        <p className="text-2xl font-bold">{formatAmount(stats.summary.totalAmount)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">За 24 часа</p>
                        <p className="text-2xl font-bold">{stats.summary.recentCount}</p>
                      </div>
                      <Clock className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Filters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input
                    placeholder="Поиск по отправителю, получателю, кошельку..."
                    value={filters.search || ''}
                    onChange={(e) => updateFilters({ search: e.target.value })}
                    className="pl-10"
                  />
                </div>
                
                <Button 
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={16} className="mr-2" />
                  Фильтры
                </Button>

                <Select
                  value={filters.sortBy || 'createdAt'}
                  onValueChange={(value) => updateFilters({ sortBy: value })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Сортировка" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">По дате добавления</SelectItem>
                    <SelectItem value="transactionDate">По дате перевода</SelectItem>
                    <SelectItem value="amount">По сумме</SelectItem>
                    <SelectItem value="senderName">По отправителю</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
                >
                  {filters.sortOrder === 'asc' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </Button>
              </div>

              {showFilters && (
                <Card className="glassmorphism">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium">Статус</label>
                        <Select
                          value={filters.status || 'all'}
                          onValueChange={(value) => updateFilters({ status: value === 'all' ? undefined : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Все статусы" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Все статусы</SelectItem>
                            <SelectItem value="SUCCESS">Успешно</SelectItem>
                            <SelectItem value="PENDING">В обработке</SelectItem>
                            <SelectItem value="FAILED">Ошибка</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium">Сумма от</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={filters.amountMin || ''}
                          onChange={(e) => updateFilters({ amountMin: e.target.value ? parseFloat(e.target.value) : undefined })}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Сумма до</label>
                        <Input
                          type="number"
                          placeholder="999999"
                          value={filters.amountMax || ''}
                          onChange={(e) => updateFilters({ amountMax: e.target.value ? parseFloat(e.target.value) : undefined })}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Дата от</label>
                        <Input
                          type="date"
                          value={filters.dateFrom || ''}
                          onChange={(e) => updateFilters({ dateFrom: e.target.value || undefined })}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Дата до</label>
                        <Input
                          type="date"
                          value={filters.dateTo || ''}
                          onChange={(e) => updateFilters({ dateTo: e.target.value || undefined })}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium">Кошелек</label>
                        <Input
                          placeholder="79123456789"
                          value={filters.wallet || ''}
                          onChange={(e) => updateFilters({ wallet: e.target.value || undefined })}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => updateFilters({ 
                          search: '',
                          status: undefined,
                          amountMin: undefined,
                          amountMax: undefined,
                          dateFrom: undefined,
                          dateTo: undefined,
                          wallet: undefined
                        })}
                      >
                        Сбросить
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* Receipts Table */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {loading ? (
                <Card className="glassmorphism">
                  <CardContent className="p-12 text-center">
                    <RefreshCw className="animate-spin h-8 w-8 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Загрузка чеков...</p>
                  </CardContent>
                </Card>
              ) : error ? (
                <Card className="glassmorphism">
                  <CardContent className="p-12 text-center">
                    <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-red-500">{typeof error === 'string' ? error : (error as any)?.message || 'Произошла ошибка'}</p>
                    <Button variant="outline" onClick={loadReceipts} className="mt-4">
                      Попробовать снова
                    </Button>
                  </CardContent>
                </Card>
              ) : receipts.length === 0 ? (
                <Card className="glassmorphism">
                  <CardContent className="p-12 text-center">
                    <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Нет чеков</h3>
                    <p className="text-muted-foreground">
                      {filters.search || filters.status || filters.wallet ? 
                        'По вашему запросу ничего не найдено' : 
                        'Чеки появятся здесь после обработки писем от Тинькофф'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="glassmorphism">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-4 text-left">Дата</th>
                            <th className="p-4 text-left">Сумма</th>
                            <th className="p-4 text-left">Отправитель</th>
                            <th className="p-4 text-left">Получатель</th>
                            <th className="p-4 text-left">Кошелек</th>
                            <th className="p-4 text-left">Статус</th>
                            <th className="p-4 text-left">Транзакция</th>
                            <th className="p-4 text-left">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receipts.map((receipt) => (
                            <tr key={receipt.id} className="border-b hover:bg-muted/50 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Calendar size={14} className="text-muted-foreground" />
                                  <span className="text-sm">{formatDate(receipt.transactionDate)}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="font-semibold">{formatAmount(receipt.amount)}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <User size={14} className="text-muted-foreground" />
                                  <span className="text-sm">{receipt.senderName}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className="text-sm">{receipt.recipientName}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Wallet size={14} className="text-muted-foreground" />
                                  <span className="text-sm font-mono">{receipt.recipientPhone || receipt.recipientCard || '-'}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                {getStatusBadge(receipt.status)}
                              </td>
                              <td className="p-4">
                                {receipt.payout ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                        Кабинет: {receipt.payout.gateAccount || '-'}
                                      </Badge>
                                    </div>
                                    {receipt.payout.gatePayoutId && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-muted-foreground">ID:</span>
                                        <span className="text-xs font-mono">{receipt.payout.gatePayoutId}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-5 w-5 p-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(receipt.payout?.gatePayoutId?.toString() || '');
                                            // Simple visual feedback
                                            const btn = e.currentTarget;
                                            btn.classList.add('text-green-500');
                                            setTimeout(() => btn.classList.remove('text-green-500'), 1000);
                                          }}
                                          title="Скопировать ID"
                                        >
                                          <Copy size={12} />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="secondary">
                                    <XCircle size={12} className="mr-1" />
                                    Не привязан
                                  </Badge>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedReceipt(receipt)}
                                  >
                                    <Eye size={14} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => downloadPDF(receipt)}
                                  >
                                    <Download size={14} />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => {
                                      if (confirm('Вы уверены, что хотите удалить этот чек?')) {
                                        deleteReceipt(receipt.id);
                                      }
                                    }}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="p-4 border-t flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Показано {receipts.length} из {totalCount} чеков
                        </p>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFilters({ page: (filters.page || 1) - 1 })}
                            disabled={filters.page === 1}
                          >
                            <ChevronLeft size={16} />
                          </Button>
                          
                          <span className="text-sm">
                            Страница {filters.page} из {totalPages}
                          </span>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateFilters({ page: (filters.page || 1) + 1 })}
                            disabled={filters.page === totalPages}
                          >
                            <ChevronRight size={16} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </TabsContent>

          {/* Bad Receipts Tab */}
          <TabsContent value="bad" className="space-y-6">
            {/* Bad Receipts Statistics */}
            {badReceiptsStats && (
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
                        <p className="text-sm text-muted-foreground">Всего чеков</p>
                        <p className="text-2xl font-bold">{badReceiptsStats.total}</p>
                      </div>
                      <Receipt className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Обработано</p>
                        <p className="text-2xl font-bold text-green-500">{badReceiptsStats.processed}</p>
                      </div>
                      <CheckCircle className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Необработано</p>
                        <p className="text-2xl font-bold text-yellow-500">{badReceiptsStats.unprocessed}</p>
                      </div>
                      <AlertCircle className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Общая сумма</p>
                        <p className="text-2xl font-bold">{formatAmount(badReceiptsStats.totalAmount)}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="glassmorphism">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">С суммой</p>
                        <p className="text-2xl font-bold">{badReceiptsStats.receiptsWithAmount}</p>
                      </div>
                      <Receipt className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Bad Receipts Table */}
            <BadReceiptsTable
              badReceipts={badReceipts}
              loading={badReceiptsLoading}
              onDownload={downloadBadReceipt}
              onDelete={deleteBadReceipt}
              currentPage={badReceiptsPage}
              totalPages={badReceiptsTotalPages}
              onPageChange={setBadReceiptsPage}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Receipt Details Dialog */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали чека</DialogTitle>
          </DialogHeader>
          
          {selectedReceipt && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Основная информация</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Номер транзакции</p>
                      <p className="font-mono">{selectedReceipt.reference || selectedReceipt.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Дата перевода</p>
                      <p>{formatDate(selectedReceipt.transactionDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Сумма</p>
                      <p className="text-xl font-semibold">{formatAmount(selectedReceipt.amount)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Статус</p>
                      {getStatusBadge(selectedReceipt.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Участники перевода</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Отправитель</p>
                    <p className="font-semibold">{selectedReceipt.senderName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Получатель</p>
                    <p className="font-semibold">{selectedReceipt.recipientName}</p>
                    <p className="text-sm font-mono text-muted-foreground">{selectedReceipt.recipientPhone || selectedReceipt.recipientCard || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Тип перевода</p>
                    <p>{selectedReceipt.transferType || 'Перевод'}</p>
                  </div>
                </CardContent>
              </Card>

              {selectedReceipt.payoutId && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Связанная выплата</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">ID выплаты</p>
                        <Link href={`/panel/payouts/${selectedReceipt.payoutId}`}>
                          <p className="text-blue-500 hover:underline cursor-pointer">
                            {selectedReceipt.payoutId}
                          </p>
                        </Link>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Банк</p>
                        <p className="font-mono">{selectedReceipt.bank}</p>
                      </div>
                    </div>

                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Системная информация</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">ID чека</p>
                    <p className="font-mono">{selectedReceipt.id}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Хеш PDF</p>
                    <p className="font-mono text-xs break-all">{selectedReceipt.fileHash}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Дата добавления</p>
                    <p>{formatDate(selectedReceipt.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => downloadPDF(selectedReceipt)}
                  className="flex-1"
                >
                  <Download size={16} className="mr-2" />
                  Скачать PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedReceipt(null)}
                  className="flex-1"
                >
                  Закрыть
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}