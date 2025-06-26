"use client";

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertTriangle,
  Clock,
  MessageSquare,
  FileText,
  Gavel,
  CheckCircle,
  XCircle,
  Eye,
  Save
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/hooks/useSocket';

interface AppealCardProps {
  card: any;
  onViewDetails: () => void;
}

const APPEAL_SUBSTAGES = {
  '9.1': { label: 'Отправлено не на тот банк', icon: AlertTriangle, color: 'text-red-500' },
  '9.2': { label: 'Отправлено не та сумма', icon: AlertTriangle, color: 'text-orange-500' },
  '9.3': { label: 'Отправлено не с нужного банка', icon: AlertTriangle, color: 'text-yellow-500' },
  '9.4': { label: 'Отправлено не на те реквизиты', icon: AlertTriangle, color: 'text-red-600' },
  '9.5': { label: 'Произведена оплата более 1 раза', icon: Clock, color: 'text-purple-500' },
  '9.6': { label: 'Отправлено с личной почты', icon: MessageSquare, color: 'text-blue-500' },
  '9.7': { label: 'Отправлено с фейк почты', icon: XCircle, color: 'text-red-700' },
  '9.8': { label: 'Отправлен фейк чек', icon: FileText, color: 'text-red-800' },
};

export function AppealCard({ card, onViewDetails }: AppealCardProps) {
  const { socket } = useSocket();
  const { toast } = useToast();
  const [substage, setSubstage] = useState(card.customStatus || '9.1');
  const [appealReason, setAppealReason] = useState(card.appealReason || '');
  const [isSaving, setIsSaving] = useState(false);

  const currentSubstage = APPEAL_SUBSTAGES[substage] || APPEAL_SUBSTAGES['9.1'];
  const Icon = currentSubstage.icon;

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

  const handleSubstageChange = async (newSubstage: string) => {
    setSubstage(newSubstage);
    setIsSaving(true);

    try {
      await new Promise((resolve, reject) => {
        socket.emit('transactions:updateCustomStatus', {
          id: card.id,
          customStatus: `dispute_${newSubstage}`,
        }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        });
      });

      toast({
        title: "Успешно",
        description: "Статус апелляции обновлен",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить статус",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveReason = async () => {
    if (!appealReason.trim()) {
      toast({
        title: "Ошибка",
        description: "Укажите причину апелляции",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      await new Promise((resolve, reject) => {
        socket.emit('transactions:updateAppealReason', {
          id: card.id,
          appealReason: appealReason,
        }, (response: any) => {
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        });
      });

      toast({
        title: "Успешно",
        description: "Причина апелляции сохранена",
      });
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сохранить причину",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="p-3 hover:shadow-md transition-all border-red-200 bg-red-50/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={20} className={currentSubstage.color} />
          <span className="font-medium text-sm">{currentSubstage.label}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(card.createdAt)}
        </span>
      </div>

      {/* Substage Selector */}
      <div className="mb-3">
        <Select 
          value={substage} 
          onValueChange={handleSubstageChange}
          disabled={isSaving}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(APPEAL_SUBSTAGES).map(([key, stage]) => {
              const StageIcon = stage.icon;
              return (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <StageIcon size={14} className={stage.color} />
                    <span>{stage.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction Info */}
      <div className="space-y-2 mb-3">
        {card.type === 'transaction' && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Сумма:</span>
              <span className="font-medium">{formatAmount(card.amount)}</span>
            </div>
            {card.orderId && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Ордер:</span>
                <span className="font-mono text-xs">{card.orderId}</span>
              </div>
            )}
            {card.counterpartyName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Контрагент:</span>
                <span className="text-xs">{card.counterpartyName}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Appeal Reason */}
      <div className="mb-3">
        <label className="text-xs text-muted-foreground mb-1 block">
          Причина апелляции:
        </label>
        <Textarea
          value={appealReason}
          onChange={(e) => setAppealReason(e.target.value)}
          placeholder="Опишите причину апелляции..."
          className="min-h-[60px] text-xs"
          disabled={isSaving}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs flex-1"
          onClick={onViewDetails}
        >
          <Eye size={12} className="mr-1" />
          Детали
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs flex-1"
          onClick={handleSaveReason}
          disabled={isSaving || !appealReason.trim()}
        >
          <Save size={12} className="mr-1" />
          Сохранить
        </Button>
      </div>
    </Card>
  );
}