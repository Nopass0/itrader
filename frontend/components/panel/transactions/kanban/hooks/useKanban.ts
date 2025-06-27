import { useState, useMemo, useCallback } from 'react';
import { Transaction } from '@/hooks/useTransactions';
import { KANBAN_STAGES } from '../Board';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/use-toast';
import { createLogger } from '@/services/logger';

const logger = createLogger('useKanban');

// Map transaction status to kanban stage
export function mapStatusToStage(transaction: Transaction, payouts: any[]): number {
  // Check if this transaction has a payout with status < 7
  const payout = payouts.find(p => p.transactionId === transaction.id);
  if (payout && payout.status < 7) {
    return 0; // Stage 0: Payouts
  }

  // Map transaction statuses to stages
  switch (transaction.status) {
    case 'pending':
      if (!transaction.advertisementId) return 11; // Other
      if (!transaction.orderId) return 2; // Order (waiting for order creation)
      return 2; // Order
    
    case 'order_created':
    case 'order_pending':
      return 2; // Order
    
    case 'chat_started':
      return 3; // Chat
    
    case 'payment_received':
    case 'waiting_payment':
      return 4; // Paid by counterparty
    
    case 'check_received':
    case 'receipt_received':
      return 5; // Check confirmed
    
    case 'release_money':
      return 6; // Release funds
    
    case 'completed':
      return 7; // Completed
    
    case 'cancelled_by_counterparty':
      return 8; // Cancelled by counterparty
    
    case 'failed':
    case 'cancelled':
      // Check for dispute status
      if (transaction.customStatuses?.some(s => s.includes('dispute'))) {
        return 9; // Appeal
      }
      return 10; // Payment for cancelled deal
    
    case 'stupid':
      return 11; // Other
    
    default:
      return 11; // Other
  }
}

export function useKanban(
  transactions: Transaction[], 
  payouts: any[], 
  advertisements: any[],
  orders?: any[]
) {
  const { socket } = useSocket();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Create columns
  const columns = useMemo(() => {
    return Object.entries(KANBAN_STAGES).map(([id, config]) => ({
      id: Number(id),
      title: config.title,
      description: config.description,
      color: config.color,
      textColor: config.textColor,
      borderColor: config.borderColor,
    }));
  }, []);

  // Group items by stage
  const cardsByColumn = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    
    // Initialize all columns
    columns.forEach(col => {
      grouped[col.id] = [];
    });

    // Add transactions
    transactions.forEach(transaction => {
      const stage = mapStatusToStage(transaction, payouts);
      const card = {
        ...transaction,
        type: 'transaction',
        unreadCount: 0, // TODO: Get from unread counts
      };
      grouped[stage].push(card);
    });

    // Add payouts with status < 7 to stage 0
    payouts
      .filter(payout => payout.status < 7)
      .forEach(payout => {
        const card = {
          ...payout,
          type: 'payout',
        };
        grouped[0].push(card);
      });

    // Add active advertisements to stage 1
    advertisements
      .filter(ad => ad.isActive)
      .forEach(ad => {
        const card = {
          ...ad,
          type: 'advertisement',
          // Ensure we have itemId for Bybit API compatibility
          itemId: ad.itemId || ad.bybitAdId || ad.id,
        };
        grouped[1].push(card);
      });

    // Add orders to stage 2
    if (orders) {
      orders.forEach(order => {
        const card = {
          ...order,
          type: 'order',
          id: order.orderId || order.id,
          amount: order.amount || 0,
          createdAt: order.createdAt || order.orderMtime || new Date().toISOString(),
        };
        grouped[2].push(card);
      });
    }

    // Sort cards by creation date (newest first)
    Object.keys(grouped).forEach(key => {
      grouped[Number(key)].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return grouped;
  }, [transactions, payouts, advertisements, orders, columns]);

  // Get cards for a specific column
  const getColumnCards = useCallback((columnId: number) => {
    return cardsByColumn[columnId] || [];
  }, [cardsByColumn]);

  // Move card to another column
  const moveCard = useCallback(async (
    cardId: string, 
    fromColumnId: number, 
    toColumnId: number,
    substage?: string,
    reason?: string
  ) => {
    try {
      // Find the card
      const card = cardsByColumn[fromColumnId]?.find(c => c.id === cardId);
      if (!card) {
        throw new Error('Карточка не найдена');
      }

      // Only transactions can be moved
      if (card.type !== 'transaction') {
        toast({
          title: "Ограничение",
          description: "Можно перемещать только транзакции",
          variant: "destructive",
        });
        return;
      }

      // Map stage to status
      let newStatus: string;
      let customStatus: string | undefined;
      
      switch (toColumnId) {
        case 0: // Payouts
          newStatus = 'pending';
          break;
        case 1: // Advertisement
          newStatus = 'pending';
          break;
        case 2: // Order
          newStatus = 'pending';
          break;
        case 3: // Chat
          newStatus = 'chat_started';
          break;
        case 4: // Paid by counterparty
          newStatus = 'payment_received';
          break;
        case 5: // Check confirmed
          newStatus = 'check_received';
          break;
        case 6: // Release funds
          newStatus = 'release_money';
          break;
        case 7: // Completed
          newStatus = 'completed';
          break;
        case 8: // Cancelled by counterparty
          newStatus = 'cancelled_by_counterparty';
          break;
        case 9: // Appeal
          newStatus = 'failed';
          customStatus = `dispute_${substage || '9.1'}`;
          break;
        case 10: // Payment for cancelled deal
          newStatus = 'cancelled';
          break;
        case 11: // Other
          newStatus = 'stupid';
          break;
        default:
          throw new Error('Неизвестная стадия');
      }

      // Update transaction status via socket
      await new Promise((resolve, reject) => {
        socket.emit('transactions:updateStatus', {
          id: cardId,
          status: newStatus,
          customStatus: customStatus,
          appealReason: reason,
        }, (response: any) => {
          if (!response.success) {
            reject(new Error(response.error?.message || 'Failed to update transaction status'));
          } else {
            resolve(response.data);
          }
        });
      });

      logger.info('Transaction moved', {
        transactionId: cardId,
        from: fromColumnId,
        to: toColumnId,
        newStatus: newStatus,
        customStatus: customStatus,
      });

      toast({
        title: "Успешно",
        description: `Транзакция перемещена в "${KANBAN_STAGES[toColumnId as keyof typeof KANBAN_STAGES].title}"`,
      });
    } catch (error: any) {
      logger.error('Failed to move card', error, { cardId, fromColumnId, toColumnId });
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось переместить транзакцию",
        variant: "destructive",
      });
    }
  }, [cardsByColumn, socket, toast]);

  return {
    columns,
    cardsByColumn,
    getColumnCards,
    moveCard,
    activeId,
    setActiveId,
  };
}