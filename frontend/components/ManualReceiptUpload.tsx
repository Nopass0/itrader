"use client";

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/hooks/useSocket';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  User,
  CreditCard,
  DollarSign,
  Calendar,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManualReceiptUploadProps {
  isOpen: boolean;
  onClose: () => void;
  payoutId: string;
  transactionId: string;
  expectedAmount: number;
  recipientCard?: string;
  recipientName?: string;
  onSuccess?: (receiptId: string) => void;
}

interface ParsedReceiptData {
  amount?: number;
  senderName?: string;
  recipientName?: string;
  recipientCard?: string;
  transactionDate?: string;
  rawText?: string;
}

export function ManualReceiptUpload({
  isOpen,
  onClose,
  payoutId,
  transactionId,
  expectedAmount,
  recipientCard,
  recipientName,
  onSuccess
}: ManualReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedReceiptData | null>(null);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { socket } = useSocket();
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast({
          title: 'Ошибка',
          description: 'Пожалуйста, выберите PDF файл',
          variant: 'destructive'
        });
        return;
      }
      setFile(selectedFile);
      setParsedData(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !socket?.connected) return;

    setUploading(true);
    setParsing(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];

        // Upload and parse receipt
        socket.emit('receipts:uploadManual', {
          payoutId,
          transactionId,
          fileData: base64Data,
          fileName: file.name,
          mimeType: file.type
        }, (response: any) => {
          setUploading(false);
          setParsing(false);

          if (response.success) {
            setParsedData(response.data.parsedData);
            toast({
              title: 'Успешно',
              description: 'Чек загружен и распознан'
            });
          } else {
            toast({
              title: 'Ошибка',
              description: response.error?.message || 'Не удалось обработать чек',
              variant: 'destructive'
            });
          }
        });
      };

      reader.onerror = () => {
        setUploading(false);
        setParsing(false);
        toast({
          title: 'Ошибка',
          description: 'Не удалось прочитать файл',
          variant: 'destructive'
        });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setUploading(false);
      setParsing(false);
      console.error('Upload error:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при загрузке',
        variant: 'destructive'
      });
    }
  };

  const handleConfirm = async () => {
    if (!parsedData || !socket?.connected) return;

    setConfirming(true);

    try {
      socket.emit('receipts:confirmManual', {
        payoutId,
        transactionId,
        parsedData
      }, (response: any) => {
        setConfirming(false);

        if (response.success) {
          toast({
            title: 'Успешно',
            description: 'Чек подтвержден и сохранен'
          });
          onSuccess?.(response.data.receiptId);
          handleClose();
        } else {
          toast({
            title: 'Ошибка',
            description: response.error?.message || 'Не удалось подтвердить чек',
            variant: 'destructive'
          });
        }
      });
    } catch (error) {
      setConfirming(false);
      console.error('Confirm error:', error);
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при подтверждении',
        variant: 'destructive'
      });
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData(null);
    setUploading(false);
    setParsing(false);
    setConfirming(false);
    onClose();
  };

  const isAmountMatch = parsedData?.amount === expectedAmount;
  const isCardMatch = !recipientCard || parsedData?.recipientCard?.includes(recipientCard.slice(-4));
  const isDataValid = isAmountMatch && isCardMatch;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Загрузка чека вручную</DialogTitle>
          <DialogDescription>
            Загрузите PDF чек от T-Bank для транзакции #{transactionId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          {!parsedData && (
            <div>
              <Label htmlFor="receipt-file">Выберите файл чека</Label>
              <div className="mt-2 space-y-2">
                <Input
                  ref={fileInputRef}
                  id="receipt-file"
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                />
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText size={16} />
                    <span>{file.name}</span>
                    <span className="text-xs">({(file.size / 1024).toFixed(2)} KB)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {file && !parsedData && (
            <Button
              onClick={handleUpload}
              disabled={uploading || parsing}
              className="w-full"
            >
              {uploading || parsing ? (
                <>
                  <RefreshCw className="animate-spin mr-2" size={16} />
                  {parsing ? 'Распознавание...' : 'Загрузка...'}
                </>
              ) : (
                <>
                  <Upload className="mr-2" size={16} />
                  Загрузить и распознать
                </>
              )}
            </Button>
          )}

          {/* Parsed Data */}
          {parsedData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Распознанные данные</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} className="text-muted-foreground" />
                      <span className="text-sm font-medium">Сумма</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {parsedData.amount?.toLocaleString('ru-RU')} ₽
                      </span>
                      {isAmountMatch ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-red-500" />
                      )}
                    </div>
                  </div>

                  {/* Recipient Card */}
                  {parsedData.recipientCard && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} className="text-muted-foreground" />
                        <span className="text-sm font-medium">Карта получателя</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{parsedData.recipientCard}</span>
                        {isCardMatch ? (
                          <CheckCircle size={16} className="text-green-500" />
                        ) : (
                          <AlertCircle size={16} className="text-yellow-500" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recipient Name */}
                  {parsedData.recipientName && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-muted-foreground" />
                        <span className="text-sm font-medium">Получатель</span>
                      </div>
                      <span className="text-sm">{parsedData.recipientName}</span>
                    </div>
                  )}

                  {/* Sender Name */}
                  {parsedData.senderName && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={16} className="text-muted-foreground" />
                        <span className="text-sm font-medium">Отправитель</span>
                      </div>
                      <span className="text-sm">{parsedData.senderName}</span>
                    </div>
                  )}

                  {/* Transaction Date */}
                  {parsedData.transactionDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-muted-foreground" />
                        <span className="text-sm font-medium">Дата операции</span>
                      </div>
                      <span className="text-sm">
                        {new Date(parsedData.transactionDate).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Separator />

              {/* Expected Data */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">Ожидаемые данные</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Сумма</span>
                    <span className="font-mono">{expectedAmount.toLocaleString('ru-RU')} ₽</span>
                  </div>
                  {recipientCard && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Карта</span>
                      <span className="font-mono">**** {recipientCard.slice(-4)}</span>
                    </div>
                  )}
                  {recipientName && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Получатель</span>
                      <span className="text-sm">{recipientName}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Validation Status */}
              <div className={cn(
                "p-4 rounded-lg border",
                isDataValid ? "bg-green-50 border-green-200 dark:bg-green-950/20" : "bg-red-50 border-red-200 dark:bg-red-950/20"
              )}>
                <div className="flex items-center gap-2">
                  {isDataValid ? (
                    <>
                      <CheckCircle size={20} className="text-green-600" />
                      <span className="font-medium text-green-900 dark:text-green-100">
                        Данные совпадают
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={20} className="text-red-600" />
                      <span className="font-medium text-red-900 dark:text-red-100">
                        Данные не совпадают
                      </span>
                    </>
                  )}
                </div>
                {!isDataValid && (
                  <p className="text-sm mt-2 text-red-700 dark:text-red-300">
                    Проверьте правильность загруженного чека
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Отмена
          </Button>
          {parsedData && (
            <Button
              onClick={handleConfirm}
              disabled={!isDataValid || confirming}
              variant={isDataValid ? "default" : "destructive"}
            >
              {confirming ? (
                <>
                  <RefreshCw className="animate-spin mr-2" size={16} />
                  Подтверждение...
                </>
              ) : (
                'Подтвердить и сохранить'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}