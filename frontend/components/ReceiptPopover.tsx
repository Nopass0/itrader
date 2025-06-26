"use client";

import { useState, useEffect } from 'react';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Download, 
  Calendar,
  User,
  CreditCard,
  Hash,
  Clock,
  CheckCircle,
  Building,
  Phone,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import { useSocket } from '@/hooks/useSocket';

interface Receipt {
  id: string;
  receiptNumber?: string;
  transactionDate?: string;
  amount?: number;
  total?: number;
  senderName?: string;
  senderAccount?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientCard?: string;
  recipientBank?: string;
  bank?: string;
  reference?: string;
  transferType?: string;
  commission?: number;
  operationId?: string;
  sbpCode?: string;
  status?: string;
  parsedData?: any;
  filePath?: string;
  createdAt: string;
}

interface ReceiptPopoverProps {
  payoutId?: string;
  transactionId?: string;
  className?: string;
}

export function ReceiptPopover({ payoutId, transactionId, className }: ReceiptPopoverProps) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const { toast } = useToast();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (payoutId && isConnected && !hasChecked) {
      loadReceipt();
    }
  }, [payoutId, isConnected, hasChecked]);

  const loadReceipt = async () => {
    if (!payoutId || !socket) return;
    
    setIsLoading(true);
    setHasChecked(true);
    try {
      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('receipts:getByPayoutId', { payoutId }, (res: any) => {
          if (res.error) {
            reject(new Error(res.error));
          } else {
            resolve(res);
          }
        });
      });

      if (response.success && response.data) {
        setReceipt(response.data);
      }
    } catch (error) {
      console.error('Failed to load receipt:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!receipt || !socket) return;

    try {

      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('receipts:getPDF', { id: receipt.id }, (res: any) => {
          if (res.error) {
            reject(new Error(res.error));
          } else {
            resolve(res);
          }
        });
      });

      if (response.success && response.data) {
        // Convert base64 to blob and download
        const base64Data = response.data.data;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename || `receipt-${receipt.receiptNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Успешно",
          description: "Чек скачан",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось скачать чек",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return 'Не указано';
    const d = new Date(date);
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '0 ₽';
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  // Don't render anything if no payoutId provided
  if (!payoutId) {
    return null;
  }

  // Always show the badge if we have a payoutId
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "border-input bg-background hover:bg-accent hover:text-accent-foreground",
            "cursor-pointer hover:bg-secondary/50",
            isLoading && "opacity-50",
            className
          )}
        >
          <FileText size={14} className="mr-1" />
          {isLoading ? 'Загрузка...' : 'Чек'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {isLoading ? (
          <div className="p-4 text-center">
            <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Загрузка чека...</p>
          </div>
        ) : receipt ? (
          <>
            {/* Receipt Header - T-Bank style */}
            <div className="bg-gradient-to-b from-yellow-400 to-yellow-500 p-4 text-black">
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-bold">{receipt.bank || 'Т-Банк'}</div>
            <Badge variant="secondary" className="bg-white/20 text-black border-0">
              {receipt.status === 'matched' ? 'Подтвержден' : 
               receipt.parsedData?.status === 'SUCCESS' ? 'Успешно' : 'Обрабатывается'}
            </Badge>
          </div>
          <div className="text-2xl font-bold">
            {formatAmount(receipt.total || receipt.amount || receipt.parsedData?.total || receipt.parsedData?.amount)}
          </div>
          <div className="text-sm opacity-80 mt-1">
            {formatDate(receipt.transactionDate || receipt.parsedData?.transactionDate)}
          </div>
        </div>

        {/* Receipt Body */}
        <div className="p-4 space-y-3">
          {/* Receipt Number or Operation ID */}
          {(receipt.receiptNumber || receipt.operationId || receipt.parsedData?.receiptNumber || receipt.parsedData?.operationId) && (
            <div className="flex items-start gap-2">
              <Hash size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Номер операции</div>
                <div className="font-medium">
                  {receipt.receiptNumber || receipt.operationId || receipt.parsedData?.receiptNumber || receipt.parsedData?.operationId}
                </div>
              </div>
            </div>
          )}

          {/* Transfer Type */}
          {(receipt.transferType || receipt.parsedData?.transferType) && (
            <div className="flex items-start gap-2">
              <CreditCard size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Тип перевода</div>
                <div className="font-medium">
                  {receipt.transferType === 'BY_PHONE' || receipt.parsedData?.transferType === 'BY_PHONE' 
                    ? 'По номеру телефона' 
                    : receipt.transferType || receipt.parsedData?.transferType}
                </div>
              </div>
            </div>
          )}

          {/* Sender Info */}
          {(receipt.senderName || receipt.parsedData?.senderName) && (
            <div className="flex items-start gap-2">
              <User size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Отправитель</div>
                <div className="font-medium">{receipt.senderName || receipt.parsedData?.senderName}</div>
                {(receipt.senderAccount || receipt.parsedData?.senderAccount) && (
                  <div className="text-xs text-muted-foreground">
                    Счет: {receipt.senderAccount || receipt.parsedData?.senderAccount}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recipient Info */}
          {(receipt.recipientName || receipt.parsedData?.recipientName) && (
            <div className="flex items-start gap-2">
              <User size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Получатель</div>
                <div className="font-medium">{receipt.recipientName || receipt.parsedData?.recipientName}</div>
              </div>
            </div>
          )}

          {/* Phone */}
          {(receipt.recipientPhone || receipt.parsedData?.recipientPhone) && (
            <div className="flex items-start gap-2">
              <Phone size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Телефон получателя</div>
                <div className="font-medium">{receipt.recipientPhone || receipt.parsedData?.recipientPhone}</div>
              </div>
            </div>
          )}

          {/* Card */}
          {receipt.recipientCard && (
            <div className="flex items-start gap-2">
              <CreditCard size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Карта получателя</div>
                <div className="font-medium">•••• {receipt.recipientCard.slice(-4)}</div>
              </div>
            </div>
          )}

          {/* Bank */}
          {(receipt.recipientBank || receipt.parsedData?.recipientBank) && (
            <div className="flex items-start gap-2">
              <Building size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Банк получателя</div>
                <div className="font-medium">{receipt.recipientBank || receipt.parsedData?.recipientBank}</div>
              </div>
            </div>
          )}

          {/* Reference */}
          {receipt.reference && (
            <div className="flex items-start gap-2">
              <FileText size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Назначение платежа</div>
                <div className="font-medium text-xs">{receipt.reference}</div>
              </div>
            </div>
          )}

          {/* Commission */}
          {receipt.commission && receipt.commission > 0 && (
            <div className="flex items-start gap-2">
              <DollarSign size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Комиссия</div>
                <div className="font-medium">{formatAmount(receipt.commission)}</div>
              </div>
            </div>
          )}

          {/* SBP Code */}
          {(receipt.sbpCode || receipt.parsedData?.sbpCode) && (
            <div className="flex items-start gap-2">
              <Hash size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">Код СБП</div>
                <div className="font-medium">{receipt.sbpCode || receipt.parsedData?.sbpCode}</div>
              </div>
            </div>
          )}

          <Separator />

          {/* Additional extracted data - hide internal fields */}
          {receipt.parsedData && Object.keys(receipt.parsedData).length > 0 && (
            <>
              {Object.entries(receipt.parsedData).some(([key]) => 
                !['amount', 'senderName', 'recipientName', 'rawText', 'transferType', 
                  'status', 'commission', 'operationId', 'sbpCode', 'receiptNumber', 
                  'total', 'senderAccount', 'recipientPhone', 'recipientBank', 
                  'transactionDate'].includes(key)
              ) && (
                <>
                  <Separator />
                  <div className="text-sm font-medium">Дополнительная информация</div>
                  <div className="space-y-1">
                    {Object.entries(receipt.parsedData)
                      .filter(([key]) => !['amount', 'senderName', 'recipientName', 'rawText', 
                        'transferType', 'status', 'commission', 'operationId', 'sbpCode', 
                        'receiptNumber', 'total', 'senderAccount', 'recipientPhone', 
                        'recipientBank', 'transactionDate'].includes(key))
                      .map(([key, value]) => (
                        <div key={key} className="text-xs">
                          <span className="text-muted-foreground">{key}:</span> {String(value)}
                        </div>
                      ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Actions */}
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleDownload}
          >
            <Download size={16} className="mr-2" />
            Скачать PDF
          </Button>
        </div>
          </>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            <FileText size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Чек не найден</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}