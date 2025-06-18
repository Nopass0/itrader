"use client";

import { useState, useEffect } from 'react';
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
import { TrendingUp, TrendingDown, Plus, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api';
import { toast } from '@/components/ui/use-toast';

interface CreateBybitAdDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateAd: (adData: AdFormData) => Promise<{ success: boolean; error?: string }>;
  initialData?: AdFormData;
  editMode?: boolean;
  accountId?: number;
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

// Minimum amounts for different currencies (Bybit requirements)
const minAmountLimits: Record<string, number> = {
  'RUB': 1000,  // 1,000 RUB minimum
  'USD': 20,    // $20 minimum
  'EUR': 20,    // €20 minimum
  'CNY': 100,   // ¥100 minimum
  'KZT': 10000  // 10,000 KZT minimum
};

// Bybit P2P payment method IDs (these are examples, actual IDs should be fetched from API)
const paymentMethods = [
  { id: '14', name: 'Тинькофф', icon: '💳' },
  { id: '75', name: 'Сбербанк', icon: '🏦' },
  { id: '185', name: 'Райффайзенбанк', icon: '🟡' },
  { id: '64', name: 'ЮMoney', icon: '💰' },
  { id: '62', name: 'QIWI', icon: '🥝' },
  { id: '377', name: 'Альфа-банк', icon: '🔴' },
  { id: '382', name: 'ВТБ', icon: '🏛️' },
  { id: '581', name: 'Наличные', icon: '💵' },
];

export function CreateBybitAdDialog({ isOpen, onClose, onCreateAd, initialData, editMode = false, accountId }: CreateBybitAdDialogProps) {
  const [formData, setFormData] = useState<AdFormData>(
    initialData || {
      side: 'Sell',
      tokenId: 'USDT',
      currencyId: 'RUB',
      price: '',
      amount: '',
      minAmount: '',
      maxAmount: '',
      paymentMethodIds: [],
      remark: ''
    }
  );

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userPaymentMethods, setUserPaymentMethods] = useState<any[]>([]);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<any[]>([
    { id: '1', code: 'BANK', name: 'Банковский перевод' },
    { id: '2', code: 'CARD', name: 'Банковская карта' },
    { id: '3', code: 'TINKOFF', name: 'Тинькофф' },
    { id: '4', code: 'SBERBANK', name: 'Сбербанк' },
    { id: '5', code: 'RAIFFEISEN', name: 'Райффайзенбанк' },
    { id: '6', code: 'ALFABANK', name: 'Альфа-банк' },
    { id: '7', code: 'VTB', name: 'ВТБ' },
    { id: '8', code: 'QIWI', name: 'QIWI' },
    { id: '9', code: 'YOOMONEY', name: 'ЮMoney' },
    { id: '10', code: 'CASH', name: 'Наличные' }
  ]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState({
    paymentType: '',
    accountNo: '',
    realName: '',
    bankName: '',
    branchName: '',
    mobile: ''
  });

  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // Load user's payment methods
  useEffect(() => {
    if (isOpen && accountId) {
      loadPaymentMethods();
      loadAvailablePaymentMethods();
    }
  }, [isOpen, accountId]);

  const loadPaymentMethods = async () => {
    if (!accountId) return;
    
    setLoadingPaymentMethods(true);
    try {
      const response = await apiClient.get(`/bybit/accounts/${accountId}/payment-methods`);
      if (response.success && response.data) {
        const methods = Array.isArray(response.data) ? response.data : (response.data.list || []);
        setUserPaymentMethods(methods);
      }
    } catch (error) {
      console.error('Failed to load payment methods:', error);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const loadAvailablePaymentMethods = async () => {
    if (!accountId) return;
    
    try {
      const response = await apiClient.get(`/bybit/accounts/${accountId}/p2p/available-payment-methods`);
      console.log('Available payment methods response:', response);
      if (response.success && response.data) {
        setAvailablePaymentMethods(response.data.paymentMethods || []);
      }
    } catch (error) {
      console.error('Failed to load available payment methods:', error);
      // Use fallback payment methods if API fails
      setAvailablePaymentMethods([
        { id: '1', code: 'BANK', name: 'Банковский перевод' },
        { id: '2', code: 'CARD', name: 'Банковская карта' },
        { id: '3', code: 'TINKOFF', name: 'Тинькофф' },
        { id: '4', code: 'SBERBANK', name: 'Сбербанк' },
        { id: '5', code: 'RAIFFEISEN', name: 'Райффайзенбанк' },
        { id: '6', code: 'ALFABANK', name: 'Альфа-банк' },
        { id: '7', code: 'VTB', name: 'ВТБ' },
        { id: '8', code: 'QIWI', name: 'QIWI' },
        { id: '9', code: 'YOOMONEY', name: 'ЮMoney' },
        { id: '10', code: 'CASH', name: 'Наличные' }
      ]);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!newPaymentMethod.paymentType || !newPaymentMethod.accountNo || !newPaymentMethod.realName) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post(`/bybit/accounts/${accountId}/p2p/payment-methods`, newPaymentMethod);
      
      if (response.success) {
        toast({
          title: "Успешно",
          description: "Платежный метод добавлен"
        });
        
        // Reset form
        setNewPaymentMethod({
          paymentType: '',
          accountNo: '',
          realName: '',
          bankName: '',
          branchName: '',
          mobile: ''
        });
        setShowAddPaymentMethod(false);
        
        // Reload payment methods
        await loadPaymentMethods();
      } else {
        toast({
          title: "Ошибка",
          description: response.error || "Не удалось добавить платежный метод",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось добавить платежный метод",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.price || parseFloat(formData.price) <= 0) {
      newErrors.price = 'Введите корректную цену';
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Введите корректное количество';
    }

    const minLimit = minAmountLimits[formData.currencyId] || 0;
    
    if (!formData.minAmount || parseFloat(formData.minAmount) <= 0) {
      newErrors.minAmount = 'Введите минимальную сумму';
    } else if (parseFloat(formData.minAmount) < minLimit) {
      newErrors.minAmount = `Минимальная сумма должна быть не менее ${minLimit} ${formData.currencyId}`;
    }

    if (!formData.maxAmount || parseFloat(formData.maxAmount) <= 0) {
      newErrors.maxAmount = 'Введите максимальную сумму';
    }

    if (parseFloat(formData.minAmount) >= parseFloat(formData.maxAmount)) {
      newErrors.maxAmount = 'Максимальная сумма должна быть больше минимальной';
    }

    // Check total amount in fiat
    const totalFiat = parseFloat(formData.price) * parseFloat(formData.amount);
    if (totalFiat < parseFloat(formData.maxAmount)) {
      newErrors.maxAmount = 'Максимальная сумма не может превышать общую сумму сделки';
    }

    // Payment methods are optional for Buy ads
    if (formData.side === 'Sell' && formData.paymentMethodIds.length === 0) {
      newErrors.paymentMethods = 'Для объявления на продажу выберите хотя бы один способ оплаты';
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
            📢 {editMode ? 'Редактировать' : 'Создать'} P2P объявление
          </DialogTitle>
          <DialogDescription>
            {editMode ? 'Измените параметры вашего объявления' : 'Создайте новое объявление для торговли на P2P бирже Bybit'}
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
                placeholder={String(minAmountLimits[formData.currencyId] || '0.00')}
                value={formData.minAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, minAmount: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Минимум: {minAmountLimits[formData.currencyId] || 0} {formData.currencyId}
              </p>
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Способы оплаты</label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={loadPaymentMethods}
                  disabled={loadingPaymentMethods}
                >
                  <RefreshCw size={14} className={loadingPaymentMethods ? 'animate-spin' : ''} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddPaymentMethod(!showAddPaymentMethod);
                    // Load available methods if not loaded
                    if (availablePaymentMethods.length === 0) {
                      loadAvailablePaymentMethods();
                    }
                  }}
                >
                  <Plus size={14} className="mr-1" />
                  Добавить
                </Button>
              </div>
            </div>
            
            {showAddPaymentMethod && (
              <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
                <h4 className="text-sm font-medium">Добавить новый платежный метод</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Тип платежа *</label>
                    <Select
                      value={newPaymentMethod.paymentType}
                      onValueChange={(value) => setNewPaymentMethod(prev => ({ ...prev, paymentType: value }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePaymentMethods.map(method => (
                          <SelectItem key={method.code} value={method.code}>
                            {method.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Номер счета/карты *</label>
                    <Input
                      className="h-8"
                      value={newPaymentMethod.accountNo}
                      onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, accountNo: e.target.value }))}
                      placeholder="Номер карты или счета"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">ФИО владельца *</label>
                    <Input
                      className="h-8"
                      value={newPaymentMethod.realName}
                      onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, realName: e.target.value }))}
                      placeholder="Как указано в банке"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Название банка</label>
                    <Input
                      className="h-8"
                      value={newPaymentMethod.bankName}
                      onChange={(e) => setNewPaymentMethod(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="Например: Сбербанк"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowAddPaymentMethod(false);
                      setNewPaymentMethod({
                        paymentType: '',
                        accountNo: '',
                        realName: '',
                        bankName: '',
                        branchName: '',
                        mobile: ''
                      });
                    }}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddPaymentMethod}
                    disabled={loading}
                  >
                    Добавить
                  </Button>
                </div>
              </div>
            )}
            
            {loadingPaymentMethods ? (
              <p className="text-sm text-muted-foreground">Загрузка платежных методов...</p>
            ) : userPaymentMethods.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {userPaymentMethods.map(method => (
                  <div key={method.paymentId || method.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={String(method.paymentId || method.id)}
                      checked={formData.paymentMethodIds.includes(String(method.paymentId || method.id))}
                      onCheckedChange={() => handlePaymentMethodToggle(String(method.paymentId || method.id))}
                    />
                    <label htmlFor={String(method.paymentId || method.id)} className="text-sm flex items-center gap-2">
                      {method.paymentType || method.bankName || method.accountNo}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  У вас нет добавленных платежных методов. 
                  {formData.side === 'Buy' ? 
                    'Для покупки это необязательно.' : 
                    'Для продажи необходимо добавить платежные методы.'
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Нажмите кнопку &quot;Добавить&quot; выше, чтобы добавить платежный метод.
                </p>
              </div>
            )}
            {errors.paymentMethods && <p className="text-sm text-red-500">{errors.paymentMethods}</p>}
          </div>

          {/* Selected Payment Methods */}
          {formData.paymentMethodIds.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Выбранные способы оплаты:</label>
              <div className="flex flex-wrap gap-2">
                {formData.paymentMethodIds.map(methodId => {
                  // Try to find in user payment methods first
                  const userMethod = userPaymentMethods.find(m => String(m.paymentId || m.id) === methodId);
                  if (userMethod) {
                    return (
                      <Badge key={methodId} variant="secondary">
                        {userMethod.paymentType || userMethod.bankName || userMethod.accountNo}
                      </Badge>
                    );
                  }
                  
                  // Fallback to default payment methods
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
            {loading ? (editMode ? 'Сохранение...' : 'Создание...') : (editMode ? 'Сохранить изменения' : 'Создать объявление')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}