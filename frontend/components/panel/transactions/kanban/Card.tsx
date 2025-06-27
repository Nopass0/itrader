"use client";

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import { TransactionChat } from '@/components/TransactionChat';
import { PayoutCard } from './cards/PayoutCard';
import { TransactionCard } from './cards/TransactionCard';
import { AdvertisementCard } from './cards/AdvertisementCard';
import { AppealCard } from './cards/AppealCard';
import { OrderCard } from './cards/OrderCard';

interface KanbanCardProps {
  card: any;
  columnId?: number;
  isDragging?: boolean;
  currentUser?: any;
}

export function KanbanCard({ card, columnId, isDragging, currentUser }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ 
    id: card.id,
    disabled: card.type !== 'transaction', // Only transactions are draggable
  });

  const [showDetails, setShowDetails] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const renderCardContent = () => {
    // Special handling for appeal stage
    if (columnId === 9) {
      return (
        <AppealCard
          card={card}
          onViewDetails={() => setShowDetails(true)}
        />
      );
    }

    switch (card.type) {
      case 'transaction':
        return (
          <TransactionCard
            transaction={card}
            stage={columnId || 0}
            unreadCount={card.unreadCount}
            onViewDetails={() => setShowDetails(true)}
            onOpenChat={() => setShowChat(true)}
            currentUser={currentUser}
          />
        );

      case 'payout':
        return (
          <PayoutCard
            payout={card}
            onViewDetails={() => setShowDetails(true)}
          />
        );

      case 'advertisement':
        return (
          <AdvertisementCard
            advertisement={card}
            onViewDetails={() => setShowDetails(true)}
          />
        );

      case 'order':
        return (
          <OrderCard
            order={card}
            onViewDetails={() => setShowDetails(true)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        data-draggable={card.type === 'transaction' ? "true" : "false"}
        className={cn(
          "touch-none",
          isSortableDragging && "opacity-50",
          isDragging && "opacity-50"
        )}
        {...attributes}
        {...listeners}
      >
        {renderCardContent()}
      </div>

      {/* Dialogs */}
      <TransactionDetailsDialog
        item={card}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onOpenChat={(orderId) => {
          setShowDetails(false);
          setShowChat(true);
        }}
      />

      {card.type === 'transaction' && card.orderId && (
        <TransactionChat
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          transactionId={card.id}
          orderId={card.orderId}
          counterpartyName={card.counterpartyName}
        />
      )}
    </>
  );
}