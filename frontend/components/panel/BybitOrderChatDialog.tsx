"use client";

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, User, Bot } from 'lucide-react';
import apiClient from '@/lib/api';

interface BybitOrderChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderInfo?: {
    side: 'Buy' | 'Sell';
    tokenId: string;
    currencyId: string;
    amount: string;
    counterPartyNickName: string;
  };
}

interface ChatMessage {
  messageId: string;
  content: string;
  messageType: 'Text' | 'Image' | 'File';
  fromUserId: string;
  createTime: string;
  fileUrl?: string;
}

export function BybitOrderChatDialog({ 
  isOpen, 
  onClose, 
  orderId, 
  orderInfo 
}: BybitOrderChatDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && orderId) {
      loadChatMessages();
    }
  }, [isOpen, orderId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatMessages = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/bybit/orders/${orderId}/chat`);
      if (response.success && response.data) {
        const data = response.data as any;
        setMessages(data.list || data.messages || []);
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await apiClient.post(`/bybit/orders/${orderId}/chat`, {
        content: newMessage.trim()
      });

      if (response.success) {
        setNewMessage('');
        // Reload messages to get the new one
        await loadChatMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isMyMessage = (fromUserId: string) => {
    // This is a simplified check. In real implementation, 
    // you'd compare with the current user's ID
    return fromUserId === 'current_user_id';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glassmorphism max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare size={20} />
            Чат по ордеру #{orderId.substring(0, 8)}...
          </DialogTitle>
          <DialogDescription>
            {orderInfo && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={orderInfo.side === 'Buy' ? 'default' : 'secondary'}>
                  {orderInfo.side === 'Buy' ? 'Покупка' : 'Продажа'}
                </Badge>
                <span>{orderInfo.tokenId}/{orderInfo.currencyId}</span>
                <span>•</span>
                <span>{orderInfo.amount}</span>
                <span>•</span>
                <span>Контрагент: {orderInfo.counterPartyNickName}</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px] max-h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-muted-foreground">Загрузка сообщений...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center text-muted-foreground">
                <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
                <p>Сообщений пока нет</p>
                <p className="text-sm">Начните общение с контрагентом</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isMy = isMyMessage(message.fromUserId);
                return (
                  <motion.div
                    key={message.messageId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${isMy ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] ${isMy ? 'order-2' : 'order-1'}`}>
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          isMy
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        
                        {message.fileUrl && (
                          <div className="mt-2">
                            {message.messageType === 'Image' ? (
                              <img 
                                src={message.fileUrl} 
                                alt="Изображение" 
                                className="max-w-full rounded"
                              />
                            ) : (
                              <a 
                                href={message.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-500 underline"
                              >
                                📎 Файл
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className={`flex items-center gap-2 mt-1 text-xs text-muted-foreground ${isMy ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-center gap-1">
                          {isMy ? <User size={12} /> : <Bot size={12} />}
                          <span>{isMy ? 'Вы' : orderInfo?.counterPartyNickName || 'Контрагент'}</span>
                        </div>
                        <span>•</span>
                        <span>{formatTime(message.createTime)}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Введите сообщение..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!newMessage.trim() || sending}
              size="icon"
            >
              <Send size={16} />
            </Button>
          </div>
          
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Нажмите Enter для отправки</span>
            <span>{newMessage.length}/1000</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}