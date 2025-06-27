"use client";

import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { KanbanColumn } from './Column';
import { KanbanCard } from './Card';
import { KanbanProvider } from './KanbanContext';
import { useKanban } from './hooks/useKanban';
import { Transaction } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { createLogger } from '@/services/logger';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

const logger = createLogger('KanbanBoard');

// Stage configurations
export const KANBAN_STAGES = {
  0: {
    id: 0,
    title: 'Выплаты из gate',
    description: 'Выплаты со статусом < 7',
    color: 'bg-slate-500',
    textColor: 'text-slate-50',
    borderColor: 'border-slate-200',
  },
  1: {
    id: 1,
    title: 'Объявления',
    description: 'Активные объявления',
    color: 'bg-blue-500',
    textColor: 'text-blue-50',
    borderColor: 'border-blue-200',
  },
  2: {
    id: 2,
    title: 'Ордер',
    description: 'Ожидающие ордера',
    color: 'bg-indigo-500',
    textColor: 'text-indigo-50',
    borderColor: 'border-indigo-200',
  },
  3: {
    id: 3,
    title: 'Чат',
    description: 'Первое сообщение от контрагента',
    color: 'bg-purple-500',
    textColor: 'text-purple-50',
    borderColor: 'border-purple-200',
  },
  4: {
    id: 4,
    title: 'Оплачено контрагентом',
    description: 'Статус PAID',
    color: 'bg-violet-500',
    textColor: 'text-violet-50',
    borderColor: 'border-violet-200',
  },
  5: {
    id: 5,
    title: 'Чек подтверждён',
    description: 'Внутренняя проверка',
    color: 'bg-green-500',
    textColor: 'text-green-50',
    borderColor: 'border-green-200',
  },
  6: {
    id: 6,
    title: 'Отпуск средств',
    description: 'Активы отпущены',
    color: 'bg-emerald-500',
    textColor: 'text-emerald-50',
    borderColor: 'border-emerald-200',
  },
  7: {
    id: 7,
    title: 'Завершено',
    description: 'FINISHED',
    color: 'bg-teal-500',
    textColor: 'text-teal-50',
    borderColor: 'border-teal-200',
  },
  8: {
    id: 8,
    title: 'Отменено контрагентом',
    description: 'CancelledByBuyer',
    color: 'bg-orange-500',
    textColor: 'text-orange-50',
    borderColor: 'border-orange-200',
  },
  9: {
    id: 9,
    title: 'Апелляция',
    description: 'DISPUTE',
    color: 'bg-red-500',
    textColor: 'text-red-50',
    borderColor: 'border-red-200',
    substages: {
      '9.1': 'Отправлено не на тот банк',
      '9.2': 'Отправлено не та сумма',
      '9.3': 'Отправлено не с нужного банка',
      '9.4': 'Отправлено не на те реквизиты',
      '9.5': 'Произведена оплата более 1 раза',
      '9.6': 'Отправлено с личной почты',
      '9.7': 'Отправлено с фейк почты',
      '9.8': 'Отправлен фейк чек',
    },
  },
  10: {
    id: 10,
    title: 'Оплата отмененной сделки',
    description: 'Компенсация',
    color: 'bg-amber-500',
    textColor: 'text-amber-50',
    borderColor: 'border-amber-200',
  },
  11: {
    id: 11,
    title: 'Другое',
    description: 'Ручное размещение',
    color: 'bg-gray-500',
    textColor: 'text-gray-50',
    borderColor: 'border-gray-200',
  },
};

interface KanbanBoardProps {
  transactions: Transaction[];
  payouts: any[];
  advertisements: any[];
  loading: boolean;
  onRefresh: () => void;
  currentUser?: any;
}

export function KanbanBoard({ 
  transactions, 
  payouts, 
  advertisements,
  loading,
  onRefresh,
  currentUser
}: KanbanBoardProps) {
  const { toast } = useToast();
  const {
    columns,
    moveCard,
    getColumnCards,
    activeId,
    setActiveId,
  } = useKanban(transactions, payouts, advertisements);

  const [isDragging, setIsDragging] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Appeal modal state
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [pendingAppeal, setPendingAppeal] = useState<{
    cardId: string;
    fromColumnId: number;
    toColumnId: number;
  } | null>(null);
  const [selectedSubstage, setSelectedSubstage] = useState('9.1');
  const [appealReason, setAppealReason] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Drag scroll functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag scroll if clicking on a draggable element or any card/column
    const target = e.target as HTMLElement;
    const isDraggableElement = target.closest('[data-draggable="true"]');
    const isCard = target.closest('.touch-none'); // Card elements
    const isColumn = target.closest('[data-droppable="true"]'); // Column elements
    const isButton = target.closest('button');
    
    if (isDraggableElement || isCard || isColumn || isButton || !scrollContainerRef.current) return;
    
    setIsMouseDown(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    scrollContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown || !scrollContainerRef.current || isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  useEffect(() => {
    const handleMouseUpGlobal = () => {
      setIsMouseDown(false);
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.cursor = 'grab';
      }
    };

    document.addEventListener('mouseup', handleMouseUpGlobal);
    return () => {
      document.removeEventListener('mouseup', handleMouseUpGlobal);
    };
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setIsDragging(true);
    logger.info('Drag started', { cardId: active.id });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    if (!over) return;

    const activeCard = columns
      .flatMap(col => getColumnCards(col.id))
      .find(card => card.id === active.id);

    if (!activeCard) return;

    const fromColumn = columns.find(col => 
      getColumnCards(col.id).some(card => card.id === active.id)
    );
    const toColumn = columns.find(col => col.id === Number(over.id));

    if (!fromColumn || !toColumn || fromColumn.id === toColumn.id) return;

    // Check if user is operator - they can only drag to appeals column
    const isOperator = currentUser?.role === 'operator';
    if (isOperator && toColumn.id !== 9) {
      toast({
        title: "Ограничение доступа",
        description: "Операторы могут перемещать карточки только в колонку 'Апелляция'",
        variant: "destructive",
      });
      return;
    }

    // If moving to Appeal stage (9), show appeal modal
    if (toColumn.id === 9) {
      setPendingAppeal({
        cardId: activeCard.id,
        fromColumnId: fromColumn.id,
        toColumnId: toColumn.id,
      });
      setShowAppealModal(true);
      return;
    }

    // Otherwise, move card directly
    moveCard(activeCard.id, fromColumn.id, toColumn.id);
  };

  const handleAppealConfirm = async () => {
    if (!pendingAppeal) return;

    try {
      await moveCard(
        pendingAppeal.cardId,
        pendingAppeal.fromColumnId,
        pendingAppeal.toColumnId,
        selectedSubstage,
        appealReason
      );

      logger.info('Card moved to appeal', {
        cardId: pendingAppeal.cardId,
        substage: selectedSubstage,
        reason: appealReason,
      });

      toast({
        title: "Успешно",
        description: "Транзакция перемещена в апелляцию",
      });

      // Reset modal state
      setShowAppealModal(false);
      setPendingAppeal(null);
      setSelectedSubstage('9.1');
      setAppealReason('');
    } catch (error) {
      logger.error('Failed to move card to appeal', error);
    }
  };

  const activeCard = activeId
    ? columns
        .flatMap(col => getColumnCards(col.id))
        .find(card => card.id === activeId)
    : null;

  return (
    <KanbanProvider>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b bg-background">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Kanban доска транзакций</h2>
            <div className="text-sm text-muted-foreground">
              Перетаскивайте карточки между колонками для изменения статуса
            </div>
          </div>
        </div>

        {/* Board */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative"
          style={{ height: 'calc(100vh - 200px)' }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div 
              className={cn(
                "flex gap-4 p-4 h-full min-w-max",
                !isDragging && "cursor-grab select-none",
                isMouseDown && !isDragging && "cursor-grabbing select-none"
              )}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseUp}
              style={{ userSelect: isMouseDown ? 'none' : 'auto' }}
            >
              <SortableContext
                items={columns.map(col => col.id)}
                strategy={horizontalListSortingStrategy}
              >
                {columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={getColumnCards(column.id)}
                    isDragging={isDragging}
                    currentUser={currentUser}
                  />
                ))}
              </SortableContext>
            </div>

            <DragOverlay>
              {activeCard ? (
                <KanbanCard
                  card={activeCard}
                  isDragging
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Appeal Modal */}
      <Dialog open={showAppealModal} onOpenChange={setShowAppealModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Перемещение в апелляцию
            </DialogTitle>
            <DialogDescription>
              Выберите причину апелляции и добавьте комментарий
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Причина апелляции</Label>
              <RadioGroup value={selectedSubstage} onValueChange={setSelectedSubstage}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.1" id="r1" />
                  <Label htmlFor="r1" className="font-normal cursor-pointer">
                    Отправлено не на тот банк
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.2" id="r2" />
                  <Label htmlFor="r2" className="font-normal cursor-pointer">
                    Отправлено не та сумма
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.3" id="r3" />
                  <Label htmlFor="r3" className="font-normal cursor-pointer">
                    Отправлено не с нужного банка
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.4" id="r4" />
                  <Label htmlFor="r4" className="font-normal cursor-pointer">
                    Отправлено не на те реквизиты
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.5" id="r5" />
                  <Label htmlFor="r5" className="font-normal cursor-pointer">
                    Произведена оплата более 1 раза
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.6" id="r6" />
                  <Label htmlFor="r6" className="font-normal cursor-pointer">
                    Отправлено с личной почты
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.7" id="r7" />
                  <Label htmlFor="r7" className="font-normal cursor-pointer">
                    Отправлено с фейк почты
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="9.8" id="r8" />
                  <Label htmlFor="r8" className="font-normal cursor-pointer">
                    Отправлен фейк чек
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appeal-reason">Дополнительный комментарий</Label>
              <Textarea
                id="appeal-reason"
                placeholder="Опишите подробности апелляции..."
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAppealModal(false);
                setPendingAppeal(null);
                setSelectedSubstage('9.1');
                setAppealReason('');
              }}
            >
              Отмена
            </Button>
            <Button
              variant="default"
              onClick={handleAppealConfirm}
              className="bg-red-500 hover:bg-red-600"
            >
              Переместить в апелляцию
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </KanbanProvider>
  );
}