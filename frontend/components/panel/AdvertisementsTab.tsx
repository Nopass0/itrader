"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Plus, 
  Trash2, 
  Edit2,
  ExternalLink,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  MoreVertical,
  Loader2
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/use-toast';
import { useBybitAccounts } from '@/hooks/useAccounts';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';

interface Advertisement {
  id: string;
  itemId?: string; // Bybit's itemId
  bybitAdId?: string; // Legacy field
  side: 'buy' | 'sell' | 0 | 1; // 0=buy, 1=sell in Bybit API
  tokenId: string;
  tokenName: string;
  currencyId: string;
  price: number | string;
  priceType: string;
  quantity: number | string;
  minAmount: number | string;
  maxAmount: number | string;
  minOrderAmount?: string; // Bybit field name
  maxOrderAmount?: string; // Bybit field name
  payments: string[];
  remark?: string; // Bybit field name
  remarks?: string; // Legacy field
  isActive: boolean;
  status?: number; // Bybit status field
  createdAt: string;
  updatedAt: string;
  bybitAccount?: {
    id: string;
    accountId: string;
    accountName: string;
  };
  bybitAccountId?: string; // Added by our API
  ordersCount?: number;
  completedOrders?: number;
  tradingPreferences?: any;
  payoutId?: string;
  payout?: {
    id: string;
    gateAccount?: string;
    gateAccountId?: string;
  };
}

interface CreateAdData {
  side: 'buy' | 'sell';
  tokenId: string;
  currencyId: string;
  priceType: string;
  price: number;
  quantity: number;
  minAmount: number;
  maxAmount: number;
  payments: string[];
  remarks: string;
  paymentPeriod: number;
  bybitAccountId: string;
}

interface UpdateAdData {
  price?: number;
  minAmount?: number;
  maxAmount?: number;
  quantity?: number;
  remarks?: string;
  paymentPeriod?: number;
  priceType?: string;
  premium?: string;
}

// Helper function to check if advertisement is active
const isAdvertisementActive = (ad: Advertisement): boolean => {
  return ad.status === 'ONLINE' || 
         ad.status === 1 || 
         ad.status === '1' ||
         ad.isActive === true ||
         (ad.status !== 'OFFLINE' && ad.status !== 0 && ad.status !== '0' && ad.isActive !== false);
};

export function AdvertisementsTab() {
  const { socket } = useSocket();
  const { toast } = useToast();
  const { accounts: bybitAccounts } = useBybitAccounts();
  
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedSide, setSelectedSide] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [createData, setCreateData] = useState<CreateAdData>({
    side: 'sell',
    tokenId: 'USDT',
    currencyId: 'RUB',
    priceType: '1',
    price: 100,
    quantity: 1000,
    minAmount: 1000,
    maxAmount: 50000,
    payments: ['75'],
    remarks: '',
    paymentPeriod: 15,
    bybitAccountId: ''
  });
  const [updateData, setUpdateData] = useState<UpdateAdData>({});

  // Load advertisements from Bybit API
  const loadAdvertisements = async () => {
    if (!socket?.connected) {
      console.warn('Socket not connected, skipping advertisement load');
      return;
    }
    
    setLoading(true);
    try {
      const response = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout: Failed to load advertisements within 30 seconds'));
        }, 30000);

        socket.emit('bybitAdvertisements:list', {
          accountId: selectedAccount === 'all' ? undefined : selectedAccount,
          side: selectedSide === 'all' ? undefined : selectedSide,
          status: selectedStatus === 'all' ? undefined : selectedStatus,
          limit: 100,
          offset: 0
        }, (response: any) => {
          clearTimeout(timeout);
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to load advertisements'));
          }
        });
      });

      // Временное логирование для отладки
      console.log('Raw advertisements data from API:', response.items);
      if (response.items && response.items.length > 0) {
        console.log('First advertisement structure:', JSON.stringify(response.items[0], null, 2));
        response.items.forEach((ad, index) => {
          console.log(`Ad ${index}:`, {
            id: ad.itemId || ad.id,
            status: ad.status,
            isActive: ad.isActive,
            online: ad.online,
            visible: ad.visible,
            enabled: ad.enabled,
            state: ad.state,
            allFields: Object.keys(ad)
          });
        });
      }

      setAdvertisements(response.items || []);
      
      // Показываем информационное сообщение если нет аккаунтов
      if (response.items.length === 0 && response.message) {
        toast({
          title: 'Информация',
          description: response.message,
          variant: 'default'
        });
      }
    } catch (error) {
      console.error('Failed to load advertisements:', error);
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось загрузить объявления',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Create advertisement
  const handleCreate = async () => {
    if (!socket?.connected) return;
    
    try {
      // Create advertisement directly on Bybit
      const response = await new Promise((resolve, reject) => {
        socket.emit('bybitAdvertisements:create', {
          bybitAccountId: createData.bybitAccountId,
          side: createData.side,
          tokenId: createData.tokenId || 'USDT',
          currencyId: createData.currencyId || 'RUB',
          priceType: createData.priceType,
          price: createData.price,
          quantity: createData.quantity,
          minAmount: createData.minAmount,
          maxAmount: createData.maxAmount,
          payments: createData.payments || ['75'], // Default to SBP
          remarks: createData.remarks || '',
          paymentPeriod: createData.paymentPeriod || 15
        }, (response: any) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to create advertisement'));
          }
        });
      });

      toast({
        title: 'Успешно',
        description: 'Объявление создано'
      });
      
      setShowCreateDialog(false);
      loadAdvertisements();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось создать объявление',
        variant: 'destructive'
      });
    }
  };

  // Update advertisement
  const handleUpdate = async () => {
    if (!socket?.connected || !selectedAd) return;
    
    try {
      const response = await new Promise((resolve, reject) => {
        socket.emit('bybitAdvertisements:update', {
          itemId: selectedAd.itemId || selectedAd.bybitAdId || selectedAd.id, // Use Bybit's itemId
          bybitAccountId: selectedAd.bybitAccount?.id || selectedAd.bybitAccountId,
          updates: updateData
        }, (response: any) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to update advertisement'));
          }
        });
      });

      toast({
        title: 'Успешно',
        description: 'Объявление обновлено'
      });
      
      setShowEditDialog(false);
      setSelectedAd(null);
      loadAdvertisements();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось обновить объявление',
        variant: 'destructive'
      });
    }
  };

  // Delete advertisement
  const handleDelete = async (ad: Advertisement) => {
    if (!socket?.connected) return;
    
    if (!confirm('Вы уверены, что хотите удалить это объявление?')) {
      return;
    }
    
    try {
      const response = await new Promise((resolve, reject) => {
        socket.emit('bybitAdvertisements:delete', { 
          itemId: ad.itemId || ad.bybitAdId || ad.id,
          bybitAccountId: ad.bybitAccount?.id || ad.bybitAccountId
        }, (response: any) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to delete advertisement'));
          }
        });
      });

      toast({
        title: 'Успешно',
        description: 'Объявление удалено'
      });
      
      loadAdvertisements();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось удалить объявление',
        variant: 'destructive'
      });
    }
  };

  // Toggle advertisement status on Bybit
  const handleToggleStatus = async (ad: Advertisement) => {
    if (!socket?.connected) return;
    
    try {
      const response = await new Promise((resolve, reject) => {
        socket.emit('bybitAdvertisements:toggle', {
          itemId: ad.itemId || ad.bybitAdId || ad.id,
          bybitAccountId: ad.bybitAccount?.id || ad.bybitAccountId,
          status: isAdvertisementActive(ad) ? 'off' : 'on' // Toggle status
        }, (response: any) => {
          if (response.success) {
            resolve(response.data);
          } else {
            reject(new Error(response.error?.message || 'Failed to toggle status'));
          }
        });
      });

      toast({
        title: 'Успешно',
        description: isAdvertisementActive(ad) ? 'Объявление деактивировано' : 'Объявление активировано'
      });
      
      loadAdvertisements();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось изменить статус',
        variant: 'destructive'
      });
    }
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleAdCreated = (data: any) => {
      setAdvertisements(prev => [data.advertisement, ...prev]);
    };

    const handleAdUpdated = (data: any) => {
      setAdvertisements(prev => 
        prev.map(ad => ad.id === data.id ? { ...ad, ...data.advertisement } : ad)
      );
    };

    const handleAdDeleted = (data: any) => {
      setAdvertisements(prev => prev.filter(ad => ad.id !== data.id));
    };

    // Listen for Bybit advertisement events
    socket.on('bybitAdvertisement:created', handleAdCreated);
    socket.on('bybitAdvertisement:updated', handleAdUpdated);
    socket.on('bybitAdvertisement:deleted', handleAdDeleted);
    socket.on('bybitAdvertisement:toggled', (data: any) => {
      setAdvertisements(prev => 
        prev.map(ad => (ad.itemId || ad.bybitAdId || ad.id) === data.itemId 
          ? { ...ad, status: data.status === 'on' ? 'ONLINE' : 'OFFLINE' } 
          : ad
        )
      );
    });

    return () => {
      socket.off('bybitAdvertisement:created', handleAdCreated);
      socket.off('bybitAdvertisement:updated', handleAdUpdated);
      socket.off('bybitAdvertisement:deleted', handleAdDeleted);
      socket.off('bybitAdvertisement:toggled');
    };
  }, [socket]);

  useEffect(() => {
    loadAdvertisements();
  }, [socket?.connected, selectedAccount, selectedSide, selectedStatus]);

  // Filter advertisements
  const filteredAds = advertisements.filter(ad => {
    // Check account filter
    if (selectedAccount !== 'all') {
      const accountId = ad.bybitAccountId || ad.bybitAccount?.id;
      if (accountId !== selectedAccount) return false;
    }
    
    // Check side filter - handle both string and numeric values
    if (selectedSide !== 'all') {
      const adSide = typeof ad.side === 'number' 
        ? (ad.side === 0 ? 'buy' : 'sell')
        : ad.side;
      if (adSide !== selectedSide) return false;
    }
    
    // Check status filter
    if (selectedStatus !== 'all') {
      const isActive = isAdvertisementActive(ad);
      if (selectedStatus === 'active' && !isActive) return false;
      if (selectedStatus === 'inactive' && isActive) return false;
    }
    
    // Check search query
    if (searchQuery) {
      const searchId = (ad.itemId || ad.bybitAdId || ad.id).toLowerCase();
      if (!searchId.includes(searchQuery.toLowerCase())) return false;
    }
    
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Объявления</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin mr-2" size={24} />
              <span className="text-muted-foreground">Загрузка объявлений...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Выберите аккаунт" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все аккаунты</SelectItem>
              {bybitAccounts.map(account => (
                <SelectItem key={account.id} value={account.id}>
                  {account.accountName || account.accountId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSide} onValueChange={setSelectedSide}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="buy">Покупка</SelectItem>
              <SelectItem value="sell">Продажа</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="active">Активные</SelectItem>
              <SelectItem value="inactive">Неактивные</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Поиск по ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={loadAdvertisements} variant="outline" size="sm">
            <RefreshCw size={16} className="mr-2" />
            Обновить
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} size="sm">
            <Plus size={16} className="mr-2" />
            Создать объявление
          </Button>
        </div>
      </div>

      {/* Advertisements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAds.map(ad => (
          <Card key={ad.itemId || ad.id} className={cn(
            "relative",
            !isAdvertisementActive(ad) && "opacity-60"
          )}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {(ad.side === 'buy' || ad.side === 0) ? (
                      <TrendingDown className="text-red-500" size={16} />
                    ) : (
                      <TrendingUp className="text-green-500" size={16} />
                    )}
                    {(ad.side === 'buy' || ad.side === 0) ? 'Покупка' : 'Продажа'} {ad.tokenName || ad.tokenId}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ad.bybitAccount?.accountName || ad.bybitAccount?.accountId || ad.bybitAccountId}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={isAdvertisementActive(ad) ? 'default' : 'secondary'}>
                    {ad.statusDisplay || (isAdvertisementActive(ad) ? 'Listed' : 'Not Listed')}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical size={14} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedAd(ad);
                        setUpdateData({
                          price: Number(ad.price),
                          minAmount: Number(ad.minOrderAmount || ad.minAmount),
                          maxAmount: Number(ad.maxOrderAmount || ad.maxAmount),
                          quantity: Number(ad.quantity),
                          remarks: ad.remark || ad.remarks || ''
                        });
                        setShowEditDialog(true);
                      }}>
                        <Edit2 size={14} className="mr-2" />
                        Изменить
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(ad)}>
                        {isAdvertisementActive(ad) ? (
                          <>
                            <XCircle size={14} className="mr-2" />
                            Деактивировать
                          </>
                        ) : (
                          <>
                            <CheckCircle size={14} className="mr-2" />
                            Активировать
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleDelete(ad)}
                        className="text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Цена</p>
                    <p className="font-medium">{ad.price} {ad.currencyId}/{ad.tokenName || ad.tokenId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Количество</p>
                    <p className="font-medium">{ad.quantity} {ad.tokenName || ad.tokenId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Мин. сумма</p>
                    <p className="font-medium">{ad.minOrderAmount || ad.minAmount} {ad.currencyId}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Макс. сумма</p>
                    <p className="font-medium">{ad.maxOrderAmount || ad.maxAmount} {ad.currencyId}</p>
                  </div>
                </div>

                {/* Gate Account Reference */}
                {ad.payout?.gateAccount && (
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Gate аккаунт</span>
                    <Badge variant="outline" className="text-xs">
                      <Building2 size={12} className="mr-1" />
                      {ad.payout.gateAccount}
                    </Badge>
                  </div>
                )}

                {ad.ordersCount !== undefined && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Ордеров</span>
                    <span>{ad.ordersCount} ({ad.completedOrders || 0} завершено)</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-xs">
                    ID: {ad.itemId || ad.bybitAdId || ad.id}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => window.open(`https://p2p.bybit.com/trade/${ad.itemId || ad.bybitAdId || ad.id}`, '_blank')}
                  >
                    <ExternalLink size={12} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAds.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="mx-auto mb-2 text-muted-foreground" size={48} />
            <p className="text-muted-foreground">Нет объявлений для отображения</p>
          </CardContent>
        </Card>
      )}

      {/* Create Advertisement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Создать объявление</DialogTitle>
            <DialogDescription>
              Заполните данные для создания нового объявления
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Аккаунт Bybit</Label>
              <Select 
                value={createData.bybitAccountId} 
                onValueChange={(value) => setCreateData({...createData, bybitAccountId: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите аккаунт" />
                </SelectTrigger>
                <SelectContent>
                  {bybitAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName || account.accountId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Тип</Label>
              <Select 
                value={createData.side} 
                onValueChange={(value: 'buy' | 'sell') => setCreateData({...createData, side: value})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Покупка</SelectItem>
                  <SelectItem value="sell">Продажа</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Цена</Label>
                <Input
                  type="number"
                  value={createData.price}
                  onChange={(e) => setCreateData({...createData, price: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Количество</Label>
                <Input
                  type="number"
                  value={createData.quantity}
                  onChange={(e) => setCreateData({...createData, quantity: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Мин. сумма</Label>
                <Input
                  type="number"
                  value={createData.minAmount}
                  onChange={(e) => setCreateData({...createData, minAmount: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Макс. сумма</Label>
                <Input
                  type="number"
                  value={createData.maxAmount}
                  onChange={(e) => setCreateData({...createData, maxAmount: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <Label>Примечания</Label>
              <Textarea
                value={createData.remarks}
                onChange={(e) => setCreateData({...createData, remarks: e.target.value})}
                placeholder="Дополнительная информация..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate} disabled={!createData.bybitAccountId}>
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Advertisement Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Изменить объявление</DialogTitle>
            <DialogDescription>
              Обновите данные объявления
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Цена</Label>
                <Input
                  type="number"
                  value={updateData.price || ''}
                  onChange={(e) => setUpdateData({...updateData, price: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Количество</Label>
                <Input
                  type="number"
                  value={updateData.quantity || ''}
                  onChange={(e) => setUpdateData({...updateData, quantity: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Мин. сумма</Label>
                <Input
                  type="number"
                  value={updateData.minAmount || ''}
                  onChange={(e) => setUpdateData({...updateData, minAmount: parseFloat(e.target.value)})}
                />
              </div>
              <div>
                <Label>Макс. сумма</Label>
                <Input
                  type="number"
                  value={updateData.maxAmount || ''}
                  onChange={(e) => setUpdateData({...updateData, maxAmount: parseFloat(e.target.value)})}
                />
              </div>
            </div>

            <div>
              <Label>Примечания</Label>
              <Textarea
                value={updateData.remarks || ''}
                onChange={(e) => setUpdateData({...updateData, remarks: e.target.value})}
                placeholder="Дополнительная информация..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setSelectedAd(null);
            }}>
              Отмена
            </Button>
            <Button onClick={handleUpdate}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}