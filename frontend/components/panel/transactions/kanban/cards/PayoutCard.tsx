"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Banknote, 
  Copy, 
  Eye, 
  Hash, 
  CreditCard,
  Building2,
  Clock,
  CheckCircle,
  Upload,
  FileText,
  ArrowRightLeft
} from 'lucide-react';
import { ReceiptPopover } from '@/components/ReceiptPopover';
import { ManualReceiptUpload } from '@/components/ManualReceiptUpload';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useSocket } from '@/hooks/useSocket';
import { createLogger } from '@/services/logger';
import { StageTimer } from '../StageTimer';
import { useState } from 'react';

const logger = createLogger('PayoutCard');

interface PayoutCardProps {
  payout: any;
  onViewDetails: () => void;
}

export function PayoutCard({ payout, onViewDetails }: PayoutCardProps) {
  const { toast } = useToast();
  const { socket } = useSocket();
  const [showManualUpload, setShowManualUpload] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Скопировано",
      description: `${label} скопирован в буфер обмена`,
    });
  };

  const handleCloseManually = async () => {
    try {
      await new Promise((resolve, reject) => {
        socket.emit('payouts:updateStatus', {
          id: payout.id,
          status: 7
        }, (response: any) => {
          if (!response.success) {
            reject(new Error(response.error?.message || 'Failed to update payout status'));
          } else {
            resolve(response.data);
          }
        });
      });

      logger.info('Payout closed manually', { payoutId: payout.id });
      
      toast({
        title: "Успешно",
        description: "Выплата закрыта вручную",
      });
    } catch (error: any) {
      logger.error('Failed to close payout manually', error, { payoutId: payout.id });
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось закрыть выплату",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '-';
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const formatWallet = (wallet: string | null | undefined) => {
    if (!wallet) return '-';
    const digitsOnly = wallet.replace(/\D/g, '');
    
    if (digitsOnly.length === 16) {
      return digitsOnly.replace(/(\d{4})/g, '$1 ').trim();
    }
    
    if (digitsOnly.length === 11 && (digitsOnly.startsWith('7') || digitsOnly.startsWith('8'))) {
      const phone = digitsOnly.replace(/^[78]/, '7');
      return `+${phone.slice(0, 1)} (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9, 11)}`;
    }
    
    if (digitsOnly.length === 10) {
      return `+7 (${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6, 8)}-${digitsOnly.slice(8, 10)}`;
    }
    
    return wallet;
  };

  const getPayoutMethodName = (method: any) => {
    if (typeof method === 'object' && method !== null) {
      if (method.name) return method.name;
      if (method.label) return method.label.replace(/^OUT:\s*/, '');
      const type = method.type;
      const name = method.name;
      if (type === 2 && name === 1) return 'Карта';
      if (type === 2 && name === 2) return 'СБП';
    }
    
    const methodMap: Record<string, string> = {
      '1': 'СБП',
      '2': 'Карта',
      '3': 'Наличные',
      '4': 'Карта',
      '5': 'СБП',
      '6': 'Банковский перевод',
      '7': 'Другое'
    };
    
    return methodMap[method?.toString()] || 'Неизвестно';
  };

  const getStatusBadge = (status: number) => {
    const statusConfig: Record<number, { text: string; className: string; icon: any }> = {
      1: { text: 'Создано', className: 'bg-yellow-500/10 text-yellow-500', icon: Clock },
      2: { text: 'Обработка', className: 'bg-blue-500/10 text-blue-500', icon: Clock },
      3: { text: 'Подтверждено', className: 'bg-purple-500/10 text-purple-500', icon: Clock },
      4: { text: 'Взято в работу', className: 'bg-orange-500/10 text-orange-500', icon: Clock },
      5: { text: 'В процессе', className: 'bg-indigo-500/10 text-indigo-500', icon: Clock },
      6: { text: 'Отменено', className: 'bg-gray-500/10 text-gray-500', icon: Clock },
      7: { text: 'Выполнено', className: 'bg-green-500/10 text-green-500', icon: Clock }
    };

    const config = statusConfig[status] || { text: 'Неизвестно', className: 'bg-gray-500/10 text-gray-500', icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={cn("text-xs", config.className)}>
        <Icon size={12} className="mr-1" />
        {config.text}
      </Badge>
    );
  };

  const renderBankLogo = () => {
    if (!payout.meta?.bank) return null;
    
    const bankLogos: Record<string, string> = {
      'sberbank': '/banks/sber.svg',
      'tinkoff': '/banks/tinkoff.svg',
      'alfa': '/banks/alfa.svg',
      'vtb': '/banks/vtb.svg',
      'raiffeisen': '/banks/raiffeisen.svg',
    };

    const logoUrl = bankLogos[payout.meta.bank.toLowerCase()];
    if (!logoUrl) return <Banknote className="h-5 w-5 text-muted-foreground" />;

    return (
      <img 
        src={logoUrl} 
        alt={payout.meta.bank} 
        className="h-5 w-5 object-contain"
      />
    );
  };

  return (
    <Card className="p-3 hover:shadow-md transition-all hover:border-primary/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {renderBankLogo()}
          <Badge variant="outline" className="text-xs">
            {getPayoutMethodName(payout.method)}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(payout.createdAt)}
        </span>
      </div>
      
      {/* Stage timer */}
      {payout.createdAt && <StageTimer timestamp={payout.createdAt} className="mb-2" />}

      {/* Amount */}
      <div className="font-semibold text-lg mb-2">
        {payout.amountTrader && typeof payout.amountTrader === 'object' && payout.amountTrader['643'] 
          ? formatAmount(payout.amountTrader['643']) 
          : (payout.amount ? formatAmount(payout.amount) : '-')}
      </div>

      {/* Exchange Rate from meta */}
      {payout.meta?.courses?.trader && (
        <div className="flex items-center gap-1 text-xs mb-2 text-muted-foreground">
          <ArrowRightLeft size={12} />
          <span>Курс захода: {(payout.meta.courses.trader * 0.979).toFixed(2)} RUB/USDT</span>
        </div>
      )}

      {/* Status */}
      <div className="mb-2">
        {getStatusBadge(payout.status)}
      </div>

      {/* Platform 1 Payout ID */}
      {payout.gatePayoutId && (
        <div className="flex items-center gap-1 text-xs mb-2">
          <Hash size={12} className="text-muted-foreground" />
          <span className="font-mono">{payout.gatePayoutId}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0"
            onClick={() => copyToClipboard(payout.gatePayoutId.toString(), 'Platform 1 ID')}
          >
            <Copy size={10} />
          </Button>
        </div>
      )}

      {/* Wallet */}
      {payout.wallet && (
        <div className="flex items-center gap-1 text-xs mb-2">
          <CreditCard size={12} className="text-muted-foreground" />
          <span className="font-mono truncate">{formatWallet(payout.wallet)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0"
            onClick={() => copyToClipboard(payout.wallet, 'Кошелек')}
          >
            <Copy size={10} />
          </Button>
        </div>
      )}

      {/* Platform 1 Account */}
      {(payout.gateAccount || payout.gateAccountRef?.email) && (
        <div className="flex items-center gap-1 text-xs mb-2">
          <Building2 size={12} className="text-muted-foreground" />
          <span>Платформа 1: {payout.gateAccount || payout.gateAccountRef?.email}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onViewDetails}
        >
          <Eye size={12} className="mr-1" />
          Детали
        </Button>
        {payout.status < 7 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs flex-1"
            onClick={handleCloseManually}
          >
            <CheckCircle size={12} className="mr-1" />
            Закрыл вручную
          </Button>
        )}
        {payout.id && (
          <>
            <ReceiptPopover payoutId={payout.id} />
            {/* Manual receipt upload button for Platform 1 payouts */}
            {payout.gatePayoutId && payout.status === 5 && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setShowManualUpload(true)}
                title="Загрузить чек вручную"
              >
                <Upload size={12} className="mr-1" />
                Чек
              </Button>
            )}
          </>
        )}
      </div>

      {/* Manual Receipt Upload Dialog */}
      {showManualUpload && payout.transaction && (
        <ManualReceiptUpload
          isOpen={showManualUpload}
          onClose={() => setShowManualUpload(false)}
          payoutId={payout.id}
          transactionId={payout.transaction.id}
          expectedAmount={payout.amount || 0}
          recipientCard={payout.wallet}
          recipientName={payout.meta?.recipientName}
          onSuccess={(receiptId) => {
            toast({
              title: 'Успешно',
              description: 'Чек загружен и привязан к транзакции'
            });
            setShowManualUpload(false);
            // Reload payout data if needed
          }}
        />
      )}
    </Card>
  );
}