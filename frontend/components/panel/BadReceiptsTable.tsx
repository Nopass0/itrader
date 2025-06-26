"use client";

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download,
  Eye,
  Trash2,
  Mail,
  Paperclip,
  AlertCircle,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BadReceipt } from '@/hooks/useBadReceipts';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

interface BadReceiptsTableProps {
  badReceipts: BadReceipt[];
  loading: boolean;
  onDownload: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function BadReceiptsTable({
  badReceipts,
  loading,
  onDownload,
  onDelete,
  currentPage,
  totalPages,
  onPageChange
}: BadReceiptsTableProps) {
  const { toast } = useToast();
  const [selectedReceipt, setSelectedReceipt] = useState<BadReceipt | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString('ru-RU');
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return '-';
    return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот чек?')) return;
    
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить чек',
        variant: 'destructive'
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3">Загрузка чеков...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (badReceipts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Нет чеков от других отправителей</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Дата
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Отправитель
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Тема
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Вложение
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Сумма
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Причина
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {badReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDate(receipt.receivedAt || receipt.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{receipt.emailFrom}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="max-w-xs truncate">
                        {receipt.emailSubject || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {receipt.attachmentName ? (
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs truncate max-w-[150px]">
                            {receipt.attachmentName}
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {receipt.amount ? (
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatAmount(receipt.amount)}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                        <AlertCircle size={12} className="mr-1" />
                        {receipt.reason || 'Не от T-Bank'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedReceipt(receipt)}
                        >
                          <Eye size={14} />
                        </Button>
                        {receipt.filePath && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDownload(receipt.id)}
                          >
                            <Download size={14} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(receipt.id)}
                          disabled={deletingId === receipt.id}
                        >
                          <Trash2 size={14} className="text-destructive" />
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
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="text-sm text-muted-foreground">
                Страница {currentPage} из {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Вперед
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={!!selectedReceipt} onOpenChange={() => setSelectedReceipt(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Детали чека</DialogTitle>
            <DialogDescription>
              Информация о письме и вложении
            </DialogDescription>
          </DialogHeader>
          
          {selectedReceipt && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Email ID</p>
                  <p className="text-sm font-mono">{selectedReceipt.emailId}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Дата получения</p>
                  <p className="text-sm">{formatDate(selectedReceipt.receivedAt || selectedReceipt.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Отправитель</p>
                  <p className="text-sm">{selectedReceipt.emailFrom}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Сумма</p>
                  <p className="text-sm">{formatAmount(selectedReceipt.amount)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Тема письма</p>
                <p className="text-sm">{selectedReceipt.emailSubject || '-'}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Причина отклонения</p>
                <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                  <AlertCircle size={12} className="mr-1" />
                  {selectedReceipt.reason || 'Не от T-Bank'}
                </Badge>
              </div>

              {selectedReceipt.attachmentName && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Вложение</p>
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedReceipt.attachmentName}</span>
                    {selectedReceipt.filePath && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onDownload(selectedReceipt.id);
                          setSelectedReceipt(null);
                        }}
                      >
                        <Download size={14} className="mr-2" />
                        Скачать
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {selectedReceipt.rawText && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Текст из вложения</p>
                  <div className="bg-muted/50 rounded p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap">{selectedReceipt.rawText}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}