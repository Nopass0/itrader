"use client";

import { createContext, useContext, useState, ReactNode } from 'react';
import { Transaction } from '@/hooks/useTransactions';

interface KanbanContextType {
  selectedCards: Set<string>;
  toggleCardSelection: (cardId: string) => void;
  clearSelection: () => void;
  dragEnabled: boolean;
  setDragEnabled: (enabled: boolean) => void;
}

const KanbanContext = createContext<KanbanContextType | undefined>(undefined);

export function KanbanProvider({ children }: { children: ReactNode }) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [dragEnabled, setDragEnabled] = useState(false);

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedCards(new Set());
  };

  return (
    <KanbanContext.Provider value={{
      selectedCards,
      toggleCardSelection,
      clearSelection,
      dragEnabled,
      setDragEnabled,
    }}>
      {children}
    </KanbanContext.Provider>
  );
}

export function useKanbanContext() {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error('useKanbanContext must be used within a KanbanProvider');
  }
  return context;
}