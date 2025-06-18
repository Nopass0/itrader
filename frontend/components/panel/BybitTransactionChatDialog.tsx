"use client";

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Clock, DollarSign, Hash, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { websocketService } from '@/services/websocket';
import apiClient from '@/lib/api';

interface TransactionDetails {
  type: 'deposit' | 'withdrawal' | 'transfer' | 'p2p';
  txID?: string;
  withdrawId?: string;
  transferId?: string;
  coin: string;
  amount: string;
  fee?: string;
  status: number | string;
  toAddress?: string;
  toAccountType?: string;
  fromAddress?: string;
  fromAccountType?: string;
  tag?: string;
  successAt?: string;
  createdTime?: string;
  updateTime?: string;
  timestamp?: string;
  txid?: string;
  blockNumber?: string;
  confirmations?: string;
  // P2P specific fields
  side?: 'Buy' | 'Sell';
  price?: string;
  counterparty?: string;
  orderId?: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'bot';
  message: string;
  timestamp: Date;
  metadata?: any;
}

interface BybitTransactionChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionDetails | null;
  accountId: number;
}

export function BybitTransactionChatDialog({
  open,
  onOpenChange,
  transaction,
  accountId
}: BybitTransactionChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socket = websocketService.getSocket();
  const isConnected = websocketService.isConnected();

  // Format date
  const formatDate = (dateString: string | number | undefined) => {
    if (!dateString) return 'Н/Д';
    
    let date: Date;
    if (typeof dateString === 'number') {
      const timestamp = dateString < 10000000000 ? dateString * 1000 : dateString;
      date = new Date(timestamp);
    } else if (typeof dateString === 'string') {
      const numericValue = parseInt(dateString);
      if (!isNaN(numericValue)) {
        const timestamp = numericValue < 10000000000 ? numericValue * 1000 : numericValue;
        date = new Date(timestamp);
      } else {
        date = new Date(dateString);
      }
    } else {
      return 'Н/Д';
    }
    
    if (isNaN(date.getTime())) return 'Н/Д';
    
    return date.toLocaleString('ru-RU');
  };

  // Format amount
  const formatAmount = (amount: string | number, decimals: number = 8) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    return value.toLocaleString('ru-RU', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: decimals 
    });
  };

  // Get transaction ID
  const getTransactionId = () => {
    if (!transaction) return null;
    return transaction.orderId || transaction.txID || transaction.withdrawId || transaction.transferId || 'unknown';
  };

  // Load chat history
  const loadChatHistory = async () => {
    const txId = getTransactionId();
    if (!txId || !accountId) return;

    setLoading(true);
    try {
      // Use P2P chat endpoint for P2P orders
      const endpoint = transaction?.type === 'p2p' && transaction?.orderId 
        ? `/bybit/orders/${transaction.orderId}/chat`
        : `/bybit/account/${accountId}/transaction/${txId}/chat`;
      const response = await apiClient.get(endpoint);
      if (response.success && response.data) {
        const chatData = response.data as any;
        const messages = Array.isArray(chatData) ? chatData : (chatData.messages || []);
        setMessages(messages.map((msg: any) => ({
          id: msg.id || msg.msgId || Date.now().toString(),
          type: msg.senderId === 'system' ? 'system' : (msg.isBot ? 'bot' : 'user'),
          message: msg.message || msg.content || '',
          timestamp: new Date(msg.timestamp || msg.createTime || Date.now())
        })));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
      // Initialize with system message about transaction
      const initMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'system',
        message: `Транзакция ${
          transaction!.type === 'deposit' ? 'депозита' : 
          transaction!.type === 'withdrawal' ? 'вывода' : 
          transaction!.type === 'p2p' ? `P2P ${transaction!.side || ''}` :
          'перевода'
        } ${formatAmount(transaction!.amount)} ${transaction!.coin}`,
        timestamp: new Date(),
        metadata: { transaction }
      };
      setMessages([initMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const txId = getTransactionId();
    if (!txId || !accountId) return;

    setSending(true);
    const messageToSend = newMessage.trim();
    setNewMessage('');

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      message: messageToSend,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Use P2P chat endpoint for P2P orders
      const endpoint = transaction?.type === 'p2p' && transaction?.orderId 
        ? `/bybit/orders/${transaction.orderId}/chat`
        : `/bybit/account/${accountId}/transaction/${txId}/chat`;
      const response = await apiClient.post(endpoint, {
        message: messageToSend,
        content: messageToSend // P2P API uses 'content' field
      });

      if (response.success && response.data) {
        // Add bot response if any
        const botResponse = response.data as any;
        if (botResponse.reply) {
          const botMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'bot',
            message: botResponse.reply,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, botMessage]);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'system',
        message: 'Не удалось отправить сообщение',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  // Set up WebSocket listeners
  useEffect(() => {
    // WebSocket is currently disabled, skip setup
    return;
    
    if (!socket || !isConnected || !open || !transaction) return;

    const txId = getTransactionId();
    if (!txId) return;

    // Join Bybit account room
    socket.emit('join_bybit_account', accountId);

    const handleChatMessage = (data: any) => {
      if (data.transactionId === txId && data.accountId === accountId) {
        const newMsg: ChatMessage = {
          id: data.id || Date.now().toString(),
          type: data.type || 'bot',
          message: data.message,
          timestamp: new Date(data.timestamp || Date.now()),
          metadata: data.metadata
        };
        setMessages(prev => [...prev, newMsg]);
      }
    };

    const handleP2PChatMessage = (data: any) => {
      if (transaction?.type === 'p2p' && transaction?.orderId === data.orderId) {
        const newMsg: ChatMessage = {
          id: data.msgId || Date.now().toString(),
          type: data.senderId === accountId.toString() ? 'user' : 'bot',
          message: data.content || data.message,
          timestamp: new Date(data.createTime || Date.now())
        };
        setMessages(prev => [...prev, newMsg]);
      }
    };

    socket.on('bybit:transaction:chat', handleChatMessage);
    socket.on('bybit:p2p:chat', handleP2PChatMessage);

    // Join P2P order room if it's a P2P transaction
    if (transaction?.type === 'p2p' && transaction?.orderId) {
      socket.emit('join_p2p_order', transaction.orderId);
    }

    return () => {
      socket.off('bybit:transaction:chat', handleChatMessage);
      socket.off('bybit:p2p:chat', handleP2PChatMessage);
      if (transaction?.type === 'p2p' && transaction?.orderId) {
        socket.emit('leave_p2p_order', transaction.orderId);
      }
    };
  }, [socket, isConnected, open, transaction, accountId]);

  // Load chat when dialog opens
  useEffect(() => {
    if (open && transaction) {
      loadChatHistory();
    }
  }, [open, transaction]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!transaction) return null;

  const getStatusBadge = (status: string | number) => {
    const isSuccess = status === 1 || status === 'SUCCESS' || status === '1';
    const isPending = status === 0 || status === 'PENDING' || status === '0';
    
    return (
      <Badge 
        variant={isSuccess ? 'default' : isPending ? 'secondary' : 'destructive'}
        className={
          isSuccess 
            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
            : isPending 
            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            : 'bg-red-500/10 text-red-500 border-red-500/20'
        }
      >
        {isSuccess ? 'Успешно' : isPending ? 'В процессе' : 'Ошибка'}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant={
                transaction.type === 'deposit' ? 'default' : 
                transaction.type === 'withdrawal' ? 'secondary' : 
                transaction.type === 'p2p' ? 'destructive' :
                'outline'
              }>
                {transaction.type === 'deposit' ? (
                  <><ArrowDownRight size={12} className="mr-1" />Депозит</>
                ) : transaction.type === 'withdrawal' ? (
                  <><ArrowUpRight size={12} className="mr-1" />Вывод</>
                ) : transaction.type === 'p2p' ? (
                  <><DollarSign size={12} className="mr-1" />P2P {transaction.side}</>
                ) : (
                  <>Перевод</>
                )}
              </Badge>
              <span>{formatAmount(transaction.amount)} {transaction.coin}</span>
              {getStatusBadge(transaction.status)}
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
              isConnected 
                ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'В сети' : 'Отключен'}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Transaction details */}
        <div className="px-6 py-3">
          <Card className="p-4 bg-muted/50">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {transaction.txid && (
                <div>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Hash size={12} />
                    TX ID:
                  </span>
                  <span className="font-mono text-xs">
                    {transaction.txid.substring(0, 8)}...{transaction.txid.substring(transaction.txid.length - 6)}
                  </span>
                </div>
              )}
              
              {transaction.fee && (
                <div>
                  <span className="text-muted-foreground">Комиссия:</span>
                  <div className="font-medium">{formatAmount(transaction.fee)} {transaction.coin}</div>
                </div>
              )}
              
              <div>
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock size={12} />
                  Дата:
                </span>
                <div className="font-medium">
                  {formatDate(transaction.successAt || transaction.createdTime)}
                </div>
              </div>

              {transaction.toAddress && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">На адрес:</span>
                  <div className="font-mono text-xs break-all">{transaction.toAddress}</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-hidden px-6">
          <ScrollArea className="h-full pr-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Нет сообщений
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.type !== 'user' && (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        {msg.type === 'bot' ? <Bot size={16} /> : <DollarSign size={16} />}
                      </div>
                    )}
                    
                    <div className={`max-w-[70%] ${msg.type === 'user' ? 'order-first' : ''}`}>
                      <Card className={`p-3 ${
                        msg.type === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : msg.type === 'system'
                          ? 'bg-muted'
                          : 'bg-card'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-xs mt-1 ${
                          msg.type === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </Card>
                    </div>
                    
                    {msg.type === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <User size={16} className="text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Message input */}
        <div className="p-6 pt-3 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-3"
          >
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Введите сообщение..."
              disabled={sending || !isConnected}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || sending || !isConnected}
              size="icon"
            >
              {sending ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}