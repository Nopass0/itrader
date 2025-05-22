"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CreateBybitAdDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAd: (adData: AdFormData) => Promise<{ success: boolean; error?: string }>;
}

interface AdFormData {
  side: 'Buy' | 'Sell';
  tokenId: string;
  currencyId: string;
  price: string;
  amount: string;
  minAmount: string;
  maxAmount: string;
  paymentMethodIds: string[];
  remark?: string;
}

const cryptocurrencies = [
  { id: 'USDT', name: 'Tether USDT' },
  { id: 'BTC', name: 'Bitcoin' },
  { id: 'ETH', name: 'Ethereum' },
  { id: 'BNB', name: 'BNB' },
  { id: 'USDC', name: 'USD Coin' },
];

const fiatCurrencies = [
  { id: 'RUB', name: 'Российский рубль' },
  { id: 'USD', name: 'Доллар США' },
  { id: 'EUR', name: 'Евро' },
  { id: 'CNY', name: 'Китайский юань' },
  { id: 'KZT', name: 'Казахстанский тенге' },
];

const paymentMethods = [
  { id: '1', name: 'Сбербанк', icon: '🏦' },
  { id: '2', name: 'Тинькофф', icon: '💳' },
  { id: '3', name: 'ВТБ', icon: '🏛️' },
  { id: '4', name: 'Альфа-Банк', icon: '🔴' },
  { id: '5', name: 'Райффайзен', icon: '🟡' },
  { id: '6', name: 'Наличные', icon: '💵' },
  { id: '7', name: 'QIWI', icon: '🥝' },
  { id: '8', name: 'ЮMoney', icon: '💰' },
];

export function CreateBybitAdDialog({ isOpen, onClose, onCreateAd }: CreateBybitAdDialogProps) {
  const [formData, setFormData] = useState<AdFormData>({
    side: 'Sell',
    tokenId: 'USDT',
    currencyId: 'RUB',
    price: '',
    amount: '',
    minAmount: '',
    maxAmount: '',
    paymentMethodIds: [],
    remark: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Введите корректную цену';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Введите корректное количество';
    }

    if (!formData.minAmount || parseFloat(formData.minAmount) <= 0) {
      newErrors.minAmount = 'Введите минимальную сумму';
    }

    if (!formData.maxAmount || parseFloat(formData.maxAmount) <= 0) {
      newErrors.maxAmount = 'Введите максимальную сумму';
    }

    if (parseFloat(formData.minAmount) >= parseFloat(formData.maxAmount)) {
      newErrors.maxAmount = 'Максимальная сумма должна быть больше минимальной';
    }

    if (formData.paymentMethodIds.length === 0) {
      newErrors.paymentMethods = 'Выберите хотя бы один способ оплаты';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await onCreateAd(formData);
      if (result.success) {
        onClose();
        // Reset form
        setFormData({
          side: 'Sell',
          tokenId: 'USDT',
          currencyId: 'RUB',
          price: '',
          amount: '',
          minAmount: '',
          maxAmount: '',
          paymentMethodIds: [],
          remark: ''
        });
        setErrors({});
      } else {
        // Show user-friendly error message for maker status
        const errorMessage = result.error?.includes('мейкера') || result.error?.includes('maker')
          ? 'Невозможно разместить объявление. Сначала необходимо подать заявку на получение статуса мейкера в Bybit.'
          : result.error || 'Ошибка создания объявления';
        
        setErrors({ general: errorMessage });
      }
    } catch (error) {
      setErrors({ general: 'Ошибка создания объявления' });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentMethodToggle = (methodId: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethodIds: prev.paymentMethodIds.includes(methodId)
        ? prev.paymentMethodIds.filter(id => id !== methodId)
        : [...prev.paymentMethodIds, methodId]
    }));
  };

  const calculateTotal = () => {
    const price = parseFloat(formData.price) || 0;
    const amount = parseFloat(formData.amount) || 0;
    return price * amount;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glassmorphism max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📢 Создать P2P объявление
          </DialogTitle>
          <DialogDescription>
            Создайте новое объявление для торговли на P2P бирже Bybit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trade Direction */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Тип сделки</label>
            <div className="flex gap-2">
              <Button
                variant={formData.side === 'Buy' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, side: 'Buy' }))}
                className="flex-1"
              >
                <TrendingUp size={16} className="mr-2" />
                Покупка
              </Button>
              <Button
                variant={formData.side === 'Sell' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, side: 'Sell' }))}
                className="flex-1"
              >
                <TrendingDown size={16} className="mr-2" />
                Продажа
              </Button>
            </div>
          </div>

          {/* Currency Pair */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Криптовалюта</label>
              <Select 
                value={formData.tokenId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, tokenId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cryptocurrencies.map(crypto => (
                    <SelectItem key={crypto.id} value={crypto.id}>
                      {crypto.id} - {crypto.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Фиатная валюта</label>
              <Select 
                value={formData.currencyId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, currencyId: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fiatCurrencies.map(fiat => (
                    <SelectItem key={fiat.id} value={fiat.id}>
                      {fiat.id} - {fiat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Цена за 1 {formData.tokenId}</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              />
              {errors.price && <p className="text-sm text-red-500">{errors.price}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Количество {formData.tokenId}</label>
              <Input
                type="number"
                step="0.00001"
                placeholder="0.00000"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
              {errors.amount && <p className="text-sm text-red-500">{errors.amount}</p>}
            </div>
          </div>

          {/* Order Limits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Мин. сумма заказа ({formData.currencyId})</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.minAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, minAmount: e.target.value }))}
              />
              {errors.minAmount && <p className="text-sm text-red-500">{errors.minAmount}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Макс. сумма заказа ({formData.currencyId})</label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.maxAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, maxAmount: e.target.value }))}
              />
              {errors.maxAmount && <p className="text-sm text-red-500">{errors.maxAmount}</p>}
            </div>
          </div>

          {/* Total Amount Display */}
          {formData.price && formData.amount && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Общая сумма:</span>
                <span className="font-bold text-lg">
                  {calculateTotal().toLocaleString('ru-RU', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })} {formData.currencyId}
                </span>
              </div>
            </div>
          )}

          {/* Payment Methods */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Способы оплаты</label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map(method => (
                <div key={method.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={method.id}
                    checked={formData.paymentMethodIds.includes(method.id)}
                    onCheckedChange={() => handlePaymentMethodToggle(method.id)}
                  />
                  <label htmlFor={method.id} className="text-sm flex items-center gap-2">
                    <span>{method.icon}</span>
                    {method.name}
                  </label>
                </div>
              ))}
            </div>
            {errors.paymentMethods && <p className="text-sm text-red-500">{errors.paymentMethods}</p>}
          </div>

          {/* Selected Payment Methods */}
          {formData.paymentMethodIds.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Выбранные способы оплаты:</label>
              <div className="flex flex-wrap gap-2">
                {formData.paymentMethodIds.map(methodId => {
                  const method = paymentMethods.find(m => m.id === methodId);
                  return method ? (
                    <Badge key={methodId} variant="secondary">
                      {method.icon} {method.name}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Remark */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Примечание (опционально)</label>
            <Input
              placeholder="Дополнительная информация для покупателей"
              value={formData.remark}
              onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
            />
          </div>

          {/* Error Message */}
          {errors.general && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500">{errors.general}</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Создание...' : 'Создать объявление'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}