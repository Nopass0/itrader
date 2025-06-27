"use client";

import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  DollarSign,
  FileText,
  Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Transaction } from '@/hooks/useTransactions';
import { TransactionCard } from './TransactionCard';

interface StatusViewProps {
  transactions: Transaction[];
  loading?: boolean;
  onRefresh?: () => void;
  onViewDetails?: (transaction: Transaction) => void;
  onOpenChat?: (transaction: Transaction) => void;
}

// Define all possible statuses
const TRANSACTION_STATUSES = [
  {
    id: 'all',
    label: 'Все',
    icon: FileText,
    color: 'bg-gray-500',
    textColor: 'text-gray-500',
  },
  {
    id: 'pending',
    label: 'Ожидание',
    icon: Clock,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-500',
  },
  {
    id: 'order_created',
    label: 'Ордер создан',
    icon: TrendingUp,
    color: 'bg-blue-500',
    textColor: 'text-blue-500',
  },
  {
    id: 'chat_started',
    label: 'Чат начат',
    icon: MessageSquare,
    color: 'bg-purple-500',
    textColor: 'text-purple-500',
  },
  {
    id: 'payment_received',
    label: 'Оплачено',
    icon: DollarSign,
    color: 'bg-green-500',
    textColor: 'text-green-500',
  },
  {
    id: 'check_received',
    label: 'Чек получен',
    icon: FileText,
    color: 'bg-indigo-500',
    textColor: 'text-indigo-500',
  },
  {
    id: 'release_money',
    label: 'Отпуск средств',
    icon: Banknote,
    color: 'bg-pink-500',
    textColor: 'text-pink-500',
  },
  {
    id: 'completed',
    label: 'Завершено',
    icon: CheckCircle,
    color: 'bg-green-600',
    textColor: 'text-green-600',
  },
  {
    id: 'cancelled',
    label: 'Отменено',
    icon: XCircle,
    color: 'bg-red-500',
    textColor: 'text-red-500',
  },
  {
    id: 'failed',
    label: 'Ошибка',
    icon: AlertCircle,
    color: 'bg-red-600',
    textColor: 'text-red-600',
  },
];

export function StatusView({ transactions, loading = false, onRefresh, onViewDetails, onOpenChat }: StatusViewProps) {
  const [activeStatus, setActiveStatus] = useState('all');

  // Group transactions by status
  const transactionsByStatus = useMemo(() => {
    const grouped: Record<string, Transaction[]> = {};
    
    // Initialize all statuses with empty arrays
    TRANSACTION_STATUSES.forEach(status => {
      grouped[status.id] = [];
    });

    // Group transactions
    transactions.forEach(transaction => {
      const status = transaction.status || 'pending';
      if (grouped[status]) {
        grouped[status].push(transaction);
      } else {
        // If status doesn't exist in our list, add to 'other'
        if (!grouped['other']) {
          grouped['other'] = [];
        }
        grouped['other'].push(transaction);
      }
      
      // Also add to 'all'
      grouped['all'].push(transaction);
    });

    return grouped;
  }, [transactions]);

  const filteredTransactions = activeStatus === 'all' 
    ? transactions 
    : transactionsByStatus[activeStatus] || [];

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeStatus} onValueChange={setActiveStatus} className="h-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          {TRANSACTION_STATUSES.map(status => {
            const Icon = status.icon;
            const count = transactionsByStatus[status.id]?.length || 0;
            
            return (
              <TabsTrigger 
                key={status.id} 
                value={status.id}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <Icon size={16} className={status.textColor} />
                <span>{status.label}</span>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "ml-1 text-xs",
                    activeStatus === status.id && status.color + ' text-white'
                  )}
                >
                  {count}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeStatus} className="flex-1 mt-4">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Загрузка...</div>
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">
                  Нет транзакций со статусом "{TRANSACTION_STATUSES.find(s => s.id === activeStatus)?.label}"
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-4">
                {filteredTransactions.map((transaction) => (
                  <TransactionCard
                    key={transaction.id}
                    transaction={transaction}
                    onOpenChat={onOpenChat ? () => onOpenChat(transaction) : undefined}
                    onViewDetails={() => onViewDetails ? onViewDetails(transaction) : undefined}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}