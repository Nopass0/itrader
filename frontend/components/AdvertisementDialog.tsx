"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/hooks/useSocket';
import { RefreshCw } from 'lucide-react';

interface AdvertisementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  advertisement?: any;
  onSuccess?: () => void;
}

export function AdvertisementDialog({ isOpen, onClose, advertisement, onSuccess }: AdvertisementDialogProps) {
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [bybitAccounts, setBybitAccounts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    bybitAccountId: '',
    type: 'sell',
    currency: 'USDT',
    fiat: 'RUB',
    price: '',
    minOrderAmount: '',
    maxOrderAmount: '',
    availableAmount: '',
    paymentMethods: [],
    remarks: '',
    isActive: true
  });

  useEffect(() => {
    if (advertisement) {
      setFormData({
        bybitAccountId: advertisement.bybitAccountId || '',
        type: advertisement.type || 'sell',
        currency: advertisement.currency || 'USDT',
        fiat: advertisement.fiat || 'RUB',
        price: advertisement.price?.toString() || '',
        minOrderAmount: advertisement.minOrderAmount?.toString() || '',
        maxOrderAmount: advertisement.maxOrderAmount?.toString() || '',
        availableAmount: advertisement.availableAmount?.toString() || '',
        paymentMethods: advertisement.paymentMethods || [],
        remarks: advertisement.remarks || '',
        isActive: advertisement.isActive !== false
      });
    }
  }, [advertisement]);

  useEffect(() => {
    if (isOpen && isConnected) {
      loadBybitAccounts();
    }
  }, [isOpen, isConnected]);

  const loadBybitAccounts = async () => {
    if (!socket) return;
    
    try {
      console.log('Loading Bybit accounts...');
      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('accounts:listBybitAccounts', {}, (res: any) => {
          console.log('Raw Bybit accounts response:', res);
          console.log('Response data:', res?.data);
          console.log('Response data type:', typeof res?.data);
          console.log('Is data array?', Array.isArray(res?.data));
          if (res.error) {
            reject(new Error(res.error));
          } else {
            resolve(res);
          }
        });
      });

      if (response.success) {
        // Handle nested data structure
        let accounts = [];
        
        // Check for response.data.data (nested structure)
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          accounts = response.data.data;
        } else if (response.data && Array.isArray(response.data)) {
          accounts = response.data;
        } else if (response.data && response.data.items && Array.isArray(response.data.items)) {
          accounts = response.data.items;
        } else if (response.data && response.data.accounts && Array.isArray(response.data.accounts)) {
          accounts = response.data.accounts;
        }
        
        console.log('Loaded accounts:', accounts);
        setBybitAccounts(accounts);
      }
    } catch (error) {
      console.error('Failed to load Bybit accounts:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить аккаунты Bybit",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!socket) return;

    setIsLoading(true);
    try {
      const eventName = advertisement ? 'advertisements:update' : 'advertisements:create';
      const data = advertisement 
        ? { id: advertisement.id, ...formData }
        : formData;

      const response = await new Promise<any>((resolve, reject) => {
        socket.emit(eventName, data, (res: any) => {
          if (res.error) {
            reject(new Error(res.error));
          } else {
            resolve(res);
          }
        });
      });

      if (response.success) {
        toast({
          title: "Успешно",
          description: advertisement ? "Объявление обновлено" : "Объявление создано",
        });
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить объявление",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {advertisement ? 'Редактировать объявление' : 'Создать объявление'}
          </DialogTitle>
          <DialogDescription>
            Заполните форму для {advertisement ? 'редактирования' : 'создания'} объявления на Bybit P2P
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="bybitAccount">Bybit аккаунт</Label>
            <Select
              value={formData.bybitAccountId}
              onValueChange={(value) => setFormData({ ...formData, bybitAccountId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите аккаунт" />
              </SelectTrigger>
              <SelectContent>
                {!Array.isArray(bybitAccounts) || bybitAccounts.length === 0 ? (
                  <SelectItem value="loading" disabled>
                    {!Array.isArray(bybitAccounts) ? 'Ошибка загрузки аккаунтов' : 'Загрузка аккаунтов...'}
                  </SelectItem>
                ) : (
                  bybitAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex flex-col">
                        <span>{account.accountId} - {account.name || account.accountName || 'Без имени'}</span>
                        <span className="text-xs text-muted-foreground">
                          {account.isActive ? '✓ Активен' : '✗ Неактивен'} | 
                          Активных объявлений: {account.activeAdsCount || 0} из 2
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="type">Тип объявления</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="currency">Валюта</Label>
              <Input
                id="currency"
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                placeholder="USDT"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fiat">Фиат</Label>
              <Input
                id="fiat"
                value={formData.fiat}
                onChange={(e) => setFormData({ ...formData, fiat: e.target.value })}
                placeholder="RUB"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="price">Цена</Label>
            <Input
              id="price"
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
              step="0.01"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="minAmount">Мин. сумма</Label>
              <Input
                id="minAmount"
                type="number"
                value={formData.minOrderAmount}
                onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxAmount">Макс. сумма</Label>
              <Input
                id="maxAmount"
                type="number"
                value={formData.maxOrderAmount}
                onChange={(e) => setFormData({ ...formData, maxOrderAmount: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="availableAmount">Доступно</Label>
            <Input
              id="availableAmount"
              type="number"
              value={formData.availableAmount}
              onChange={(e) => setFormData({ ...formData, availableAmount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="paymentMethods">Методы оплаты</Label>
            <div className="space-y-2">
              {[
                { value: 1, label: 'СБП' },
                { value: 2, label: 'Банковская карта' },
                { value: 3, label: 'Наличные' },
                { value: 4, label: 'Криптовалюта' },
                { value: 5, label: 'Электронный кошелек' },
                { value: 6, label: 'Банковский перевод' }
              ].map((method) => (
                <label key={method.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.paymentMethods.includes(method.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, paymentMethods: [...formData.paymentMethods, method.value] });
                      } else {
                        setFormData({ ...formData, paymentMethods: formData.paymentMethods.filter(m => m !== method.value) });
                      }
                    }}
                  />
                  <span className="text-sm">{method.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="remarks">Примечания</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Дополнительная информация..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
            {advertisement ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}