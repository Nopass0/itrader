import { Transaction } from '@/hooks/useTransactions';

export function getStageTimestamp(transaction: Transaction | any, stage: number): Date | null {
  // For payouts
  if (transaction.type === 'payout') {
    return transaction.createdAt;
  }

  // For advertisements
  if (transaction.type === 'advertisement') {
    return transaction.createdAt;
  }

  // For transactions
  switch (stage) {
    case 0: // Payouts
      return transaction.payout?.createdAt || transaction.createdAt;
    
    case 1: // Advertisement
      return transaction.advertisement?.createdAt || transaction.createdAt;
    
    case 2: // Order
      return transaction.orderId ? transaction.createdAt : null;
    
    case 3: // Chat
      return transaction.chatStartedAt || null;
    
    case 4: // Paid by counterparty
      // Use updatedAt when status changed to payment_received
      if (transaction.status === 'payment_received' || transaction.status === 'waiting_payment') {
        return transaction.updatedAt;
      }
      return null;
    
    case 5: // Check confirmed
      return transaction.checkReceivedAt || null;
    
    case 6: // Release funds
      if (transaction.status === 'release_money') {
        return transaction.updatedAt;
      }
      return null;
    
    case 7: // Completed
      return transaction.completedAt || null;
    
    case 8: // Cancelled by counterparty
      if (transaction.status === 'cancelled_by_counterparty') {
        return transaction.updatedAt;
      }
      return null;
    
    case 9: // Appeal
      // Check for dispute custom status
      if (transaction.customStatuses?.some((s: any) => s.includes('dispute'))) {
        return transaction.updatedAt;
      }
      return null;
    
    case 10: // Payment for cancelled deal
      if (transaction.status === 'cancelled') {
        return transaction.updatedAt;
      }
      return null;
    
    case 11: // Other
      return transaction.createdAt;
    
    default:
      return null;
  }
}