"use client";

import { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { KanbanCard } from './Card';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { KANBAN_STAGES } from './Board';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useGateAccounts, useBybitAccounts } from '@/hooks/useAccounts';

interface KanbanColumnProps {
  column: {
    id: number;
    title: string;
    description?: string;
    color?: string;
    textColor?: string;
    borderColor?: string;
  };
  cards: any[];
  isDragging?: boolean;
  currentUser?: any;
}

export function KanbanColumn({ column, cards, isDragging, currentUser }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id.toString(),
  });
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const { accounts: gateAccounts } = useGateAccounts();
  const { accounts: bybitAccounts } = useBybitAccounts();

  const stageConfig = KANBAN_STAGES[column.id as keyof typeof KANBAN_STAGES];

  // Filter cards based on selected filter
  const filteredCards = useMemo(() => {
    if (filter === 'all') return cards;
    
    return cards.filter(card => {
      // Filter by Gate account for payouts
      if (column.id === 0 && card.type === 'payout') {
        return card.gateAccount === filter || 
               card.gateAccountRef?.email === filter ||
               card.gateAccountId === filter;
      }
      // Filter by Bybit account for advertisements
      if (column.id === 1 && card.type === 'advertisement') {
        return card.bybitAccountId === filter;
      }
      // Add more filter logic as needed
      return true;
    });
  }, [cards, filter, column.id]);

  const cardIds = useMemo(() => filteredCards.map(card => card.id), [filteredCards]);

  // Calculate statistics
  const totalAmount = filteredCards.reduce((sum, card) => {
    if (card.type === 'transaction' && card.amount) {
      return sum + card.amount;
    } else if (card.type === 'payout' && card.amount) {
      return sum + card.amount;
    }
    return sum;
  }, 0);

  // Collapsed view
  if (isCollapsed) {
    return (
      <div
        className={cn(
          "flex flex-col h-auto bg-muted/30 rounded-lg transition-all duration-300 w-[240px]",
          stageConfig?.color || 'bg-gray-500'
        )}
      >
        <div className={cn(
          "p-4 rounded-lg cursor-pointer",
          stageConfig?.textColor || 'text-white'
        )}
        onClick={() => setIsCollapsed(false)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChevronUp size={16} />
              <h3 className="font-semibold text-sm">{column.title}</h3>
            </div>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs",
                stageConfig?.color ? 'bg-white/20 text-white' : ''
              )}
            >
              {cards.length}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-droppable="true"
      className={cn(
        "flex flex-col w-[320px] h-full bg-muted/30 rounded-lg transition-all duration-300",
        isOver && "ring-2 ring-primary bg-primary/5"
      )}
      style={{ maxHeight: 'calc(100vh - 240px)' }}
    >
      {/* Column Header */}
      <div className={cn(
        "p-3 rounded-t-lg space-y-2 flex-shrink-0",
        stageConfig?.color || 'bg-gray-500',
        stageConfig?.textColor || 'text-white'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{column.title}</h3>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs",
                stageConfig?.color ? 'bg-white/20 text-white' : ''
              )}
            >
              {filteredCards.length}{cards.length !== filteredCards.length && `/${cards.length}`}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-white/20"
            onClick={() => setIsCollapsed(true)}
          >
            <ChevronDown size={14} />
          </Button>
        </div>
        
        {/* Filters for specific columns */}
        {column.id === 0 && gateAccounts && gateAccounts.length > 0 && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-7 text-xs bg-white/10 border-white/20">
              <SelectValue placeholder="Все аккаунты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все аккаунты</SelectItem>
              {gateAccounts.map((account) => (
                <SelectItem key={account.id} value={account.email}>
                  {account.name || account.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {column.id === 1 && bybitAccounts && bybitAccounts.length > 0 && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-7 text-xs bg-white/10 border-white/20">
              <SelectValue placeholder="Все аккаунты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все аккаунты</SelectItem>
              {bybitAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.accountName || account.name || account.accountId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        {column.description && (
          <p className="text-xs opacity-90">{column.description}</p>
        )}
        {totalAmount > 0 && (
          <p className="text-xs font-medium">
            Сумма: {totalAmount.toLocaleString('ru-RU', { 
              style: 'currency', 
              currency: 'RUB' 
            })}
          </p>
        )}
      </div>

      {/* Column Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2" style={{ minHeight: 0 }}>
        <SortableContext
          items={cardIds}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 pb-2">
            {filteredCards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                columnId={column.id}
                currentUser={currentUser}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      {/* Drop indicator */}
      {isDragging && (
        <div className="p-4 border-t border-dashed border-primary">
          <p className="text-xs text-center text-muted-foreground">
            {column.id === 9 ? 'Перетащите сюда для создания апелляции' : 'Перетащите карточку сюда'}
          </p>
        </div>
      )}
    </div>
  );
}