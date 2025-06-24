"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MessageSquare,
  Send,
  X,
  Maximize2,
  Minimize2,
  Check,
  CheckCheck,
  Bell,
  Circle,
  MoreVertical,
  Phone,
  Video,
  Info,
  Image as ImageIcon,
  Paperclip,
  Smile,
  ChevronLeft,
  RefreshCw,
  Expand
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocketApi } from '@/hooks/useSocketApi';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Types
interface ChatMessage {
  id: string;
  orderId: string;
  content: string;
  senderId: string;
  senderName: string;
  isMe: boolean;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  status?: 'sent' | 'delivered' | 'read';
  attachment?: {
    url: string;
    name: string;
    size: number;
  };
}

interface ChatRoom {
  orderId: string;
  counterpartyName: string;
  counterpartyId: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  status: 'active' | 'completed' | 'cancelled';
  type: 'buy' | 'sell';
  amount: number;
  currency: string;
  price: number;
}

interface GlobalChatProps {
  className?: string;
}

export function GlobalChat({ className }: GlobalChatProps) {
  const [isMinimized, setIsMinimized] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { api, isConnected } = useSocketApi();
  const { toast } = useToast();

  // Calculate total unread
  const totalUnread = chatRooms.reduce((sum, room) => sum + room.unreadCount, 0);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && activeChat) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeChat]);

  // Load chats from API
  const loadChats = useCallback(async () => {
    if (!isConnected) return;
    
    setIsLoading(true);
    try {
      const response = await api.emit('chats:list', {});
      if (response.success && response.data) {
        const chatsData = Array.isArray(response.data) ? response.data : (response.data.data || []);
        if (!Array.isArray(chatsData)) {
          console.error('Unexpected chats data format:', response.data);
          setChatRooms([]);
          return;
        }
        const rooms: ChatRoom[] = chatsData.map((chat: any) => ({
          orderId: chat.orderId,
          counterpartyName: chat.counterparty || chat.counterpartyName || 'Unknown',
          counterpartyId: chat.counterpartyId || '',
          lastMessage: chat.lastMessage?.content || chat.lastMessage?.message || '',
          lastMessageTime: chat.lastMessage?.createdAt ? new Date(chat.lastMessage.createdAt) : undefined,
          unreadCount: chat.unreadCount || 0,
          status: chat.status || 'active',
          type: chat.advertisement?.type || chat.type || 'buy',
          amount: chat.amount || 0,
          currency: chat.advertisement?.currency || chat.currency || 'USDT',
          price: chat.advertisement?.price || chat.price || 0
        }));
        setChatRooms(rooms);
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [api, isConnected]);

  // Load messages for a specific chat
  const loadMessages = useCallback(async (orderId: string) => {
    if (!isConnected) return;
    
    try {
      // Find transaction by orderId to get transactionId
      const transaction = await api.emit('transactions:list', { 
        orderId: orderId,
        limit: 1 
      });
      
      if (!transaction.success || !transaction.data?.data?.[0]) {
        console.error('Transaction not found for orderId:', orderId);
        return;
      }
      
      const transactionId = transaction.data.data[0].id;
      const response = await api.emit('chats:getMessages', { transactionId });
      if (response.success && response.data) {
        const messages = response.data.messages || response.data;
        const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
          id: msg.id || msg.messageId,
          orderId: orderId,
          content: msg.message || msg.content,
          senderId: msg.senderId || msg.sender,
          senderName: (msg.sender === 'us' || msg.sender === 'seller') ? 'Вы' : 'Покупатель',
          isMe: msg.sender === 'us' || msg.sender === 'seller',
          timestamp: new Date(msg.createdAt || msg.sentAt),
          type: msg.messageType === 'IMAGE' ? 'image' : msg.messageType === 'FILE' ? 'file' : 'text',
          status: msg.readAt ? 'read' : msg.sentAt ? 'delivered' : 'sent',
          attachment: msg.attachment
        }));
        setMessages(prev => ({ ...prev, [orderId]: chatMessages }));
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [api, isConnected]);

  // Load chats on mount and when connected
  useEffect(() => {
    if (isConnected) {
      loadChats();
    }
  }, [isConnected, loadChats]);

  // Listen for real-time chat events
  useEffect(() => {
    if (!isConnected || !api) return;

    // Listen for new messages
    const handleNewMessage = (data: any) => {
      if (data.orderId && data.message) {
        const newMsg: ChatMessage = {
          id: data.message.id || data.message.messageId,
          orderId: data.orderId,
          content: data.message.content || data.message.message,
          senderId: data.message.senderId || data.message.sender,
          senderName: (data.message.sender === 'us' || data.message.sender === 'seller') ? 'Вы' : 'Покупатель',
          isMe: data.message.sender === 'us' || data.message.sender === 'seller',
          timestamp: new Date(data.message.createdAt || data.message.sentAt),
          type: 'text',
          status: 'delivered'
        };

        // Add to messages
        setMessages(prev => ({
          ...prev,
          [data.orderId]: [...(prev[data.orderId] || []), newMsg]
        }));

        // Update chat room
        setChatRooms(prev => prev.map(room => 
          room.orderId === data.orderId 
            ? { 
                ...room, 
                lastMessage: newMsg.content, 
                lastMessageTime: newMsg.timestamp,
                unreadCount: activeChat === data.orderId ? 0 : room.unreadCount + 1
              }
            : room
        ));

        // Show notification if not active chat
        if (activeChat !== data.orderId) {
          toast({
            title: "Новое сообщение",
            description: `${newMsg.senderName}: ${newMsg.content.slice(0, 50)}...`
          });
        }
      }
    };

    // Listen for chat updates
    const handleChatUpdate = (data: any) => {
      if (data.orderId) {
        setChatRooms(prev => prev.map(room => 
          room.orderId === data.orderId 
            ? { ...room, ...data.updates }
            : room
        ));
      }
    };

    api.on('chat:newMessage', handleNewMessage);
    api.on('chat:updated', handleChatUpdate);

    return () => {
      api.off('chat:newMessage', handleNewMessage);
      api.off('chat:updated', handleChatUpdate);
    };
  }, [isConnected, api, activeChat, toast]);

  // Listen for openGlobalChat events
  useEffect(() => {
    const handleOpenChat = async (event: CustomEvent) => {
      const { orderId } = event.detail;
      if (orderId) {
        // Check if we already have this chat room
        const existingRoom = chatRooms.find(room => room.orderId === orderId);
        if (!existingRoom) {
          // Create a temporary room while loading
          const tempRoom: ChatRoom = {
            orderId,
            counterpartyName: 'Загрузка...',
            counterpartyId: '',
            lastMessage: '',
            unreadCount: 0,
            status: 'active',
            type: 'buy',
            amount: 0,
            currency: 'USDT',
            price: 0
          };
          setChatRooms(prev => [...prev, tempRoom]);
        }
        openChat(orderId);
      }
    };

    window.addEventListener('openGlobalChat', handleOpenChat as any);
    return () => {
      window.removeEventListener('openGlobalChat', handleOpenChat as any);
    };
  }, [chatRooms]);

  // Send message
  const sendMessage = async () => {
    if (newMessage.trim() && activeChat && isConnected) {
      const tempId = Date.now().toString();
      const message: ChatMessage = {
        id: tempId,
        orderId: activeChat,
        content: newMessage,
        senderId: 'me',
        senderName: 'Вы',
        isMe: true,
        timestamp: new Date(),
        type: 'text',
        status: 'sent'
      };
      
      // Add message to UI immediately
      setMessages(prev => ({
        ...prev,
        [activeChat]: [...(prev[activeChat] || []), message]
      }));
      
      // Update last message in room
      setChatRooms(prev => prev.map(room => 
        room.orderId === activeChat 
          ? { ...room, lastMessage: newMessage, lastMessageTime: new Date(), unreadCount: 0 }
          : room
      ));
      
      setNewMessage('');
      
      try {
        // Get transactionId first
        const transaction = await api.emit('transactions:list', { 
          orderId: activeChat,
          limit: 1 
        });
        
        if (!transaction.success || !transaction.data?.data?.[0]) {
          throw new Error('Transaction not found');
        }
        
        const transactionId = transaction.data.data[0].id;
        
        // Send message via API
        const response = await api.emit('chats:sendMessage', {
          transactionId: transactionId,
          message: newMessage
        });
        
        if (response.success) {
          // Update message with real ID and status
          setMessages(prev => ({
            ...prev,
            [activeChat]: prev[activeChat].map(msg => 
              msg.id === tempId ? { ...msg, id: response.data.id, status: 'delivered' } : msg
            )
          }));
        } else {
          // Show error and mark message as failed
          toast({
            title: "Ошибка",
            description: "Не удалось отправить сообщение",
            variant: "destructive"
          });
          setMessages(prev => ({
            ...prev,
            [activeChat]: prev[activeChat].map(msg => 
              msg.id === tempId ? { ...msg, status: 'failed' as any } : msg
            )
          }));
        }
      } catch (error) {
        console.error('Failed to send message:', error);
        toast({
          title: "Ошибка",
          description: "Не удалось отправить сообщение",
          variant: "destructive"
        });
      }
    }
  };

  // Open specific chat
  const openChat = async (orderId: string) => {
    setActiveChat(orderId);
    setIsMinimized(false);
    
    // Mark as read
    setChatRooms(prev => prev.map(room => 
      room.orderId === orderId ? { ...room, unreadCount: 0 } : room
    ));
    
    // Load messages if not already loaded
    if (!messages[orderId]) {
      await loadMessages(orderId);
    }
    
    // If we don't have this room, get transaction details to create it
    const existingRoom = chatRooms.find(room => room.orderId === orderId);
    if (!existingRoom) {
      try {
        const transaction = await api.emit('transactions:list', { 
          orderId: orderId,
          limit: 1 
        });
        
        if (transaction.success && transaction.data?.data?.[0]) {
          const trans = transaction.data.data[0];
          const newRoom: ChatRoom = {
            orderId,
            counterpartyName: trans.counterpartyName || 'Пользователь',
            counterpartyId: '',
            lastMessage: '',
            unreadCount: 0,
            status: trans.status || 'active',
            type: trans.advertisement?.type || 'buy',
            amount: trans.amount || 0,
            currency: trans.advertisement?.currency || 'USDT',
            price: trans.advertisement?.price || 0
          };
          setChatRooms(prev => [...prev.filter(r => r.orderId !== orderId), newRoom]);
        }
      } catch (error) {
        console.error('Failed to load transaction details:', error);
      }
    }
    
    // Mark messages as read via API
    if (isConnected) {
      try {
        // Get transactionId first
        const transaction = await api.emit('transactions:list', { 
          orderId: orderId,
          limit: 1 
        });
        
        if (transaction.success && transaction.data?.data?.[0]) {
          const transactionId = transaction.data.data[0].id;
          await api.emit('chats:markAsRead', { transactionId });
        }
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
    }
  };

  // Format time
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} мин назад`;
    } else if (hours < 24) {
      return `${hours} ч назад`;
    } else {
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    }
  };

  // Chat header
  const ChatHeader = ({ room }: { room: ChatRoom }) => (
    <div className="flex items-center justify-between p-3 border-b">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 lg:hidden"
          onClick={() => setActiveChat(null)}
        >
          <ChevronLeft size={16} />
        </Button>
        
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">
            {room.counterpartyName ? room.counterpartyName.split(' ').map(n => n[0]).join('').slice(0, 2) : '??'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{room.counterpartyName}</span>
            <Badge variant={room.type === 'buy' ? 'default' : 'destructive'} className="text-xs">
              {room.type === 'buy' ? 'BUY' : 'SELL'}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>#{room.orderId}</span>
            <span>•</span>
            <span>{room.amount} {room.currency}</span>
            <span>•</span>
            <span>{room.price} ₽</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          <Expand size={16} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Phone size={14} className="mr-2" />
              Позвонить
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Video size={14} className="mr-2" />
              Видеозвонок
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Info size={14} className="mr-2" />
              Информация
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  // Message component
  const Message = ({ message }: { message: ChatMessage }) => (
    <div
      className={cn(
        "flex gap-2",
        message.isMe ? "justify-end" : "justify-start"
      )}
    >
      {!message.isMe && (
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-xs">
            {message.senderName ? message.senderName.split(' ').map(n => n[0]).join('').slice(0, 2) : '??'}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div
        className={cn(
          "max-w-[70%] rounded-2xl px-3 py-2",
          message.isMe
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        <p className="text-sm break-words">{message.content}</p>
        <div className={cn(
          "flex items-center gap-1 mt-1",
          message.isMe ? "justify-end" : "justify-start"
        )}>
          <span className="text-xs opacity-60">
            {new Date(message.timestamp).toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {message.isMe && message.status && (
            <span className="text-xs opacity-80">
              {message.status === 'sent' && <Check size={12} />}
              {message.status === 'delivered' && <CheckCheck size={12} />}
              {message.status === 'read' && <CheckCheck size={12} className="text-blue-400" />}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Minimized state - floating button */}
      <AnimatePresence>
        {isMinimized && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              "fixed bottom-6 right-6 z-50",
              className
            )}
          >
            <Button
              onClick={() => setIsMinimized(false)}
              className="h-14 w-14 rounded-full shadow-lg relative"
            >
              <MessageSquare size={24} />
              {totalUnread > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-6 w-6 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <span className="text-xs text-white font-bold">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                </motion.div>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded chat window */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed bg-background border shadow-2xl z-50",
              isFullscreen 
                ? "inset-0 w-full h-full rounded-none" 
                : "bottom-6 right-6 w-[380px] h-[600px] lg:w-[700px] rounded-lg",
              "flex",
              className
            )}
          >
            {/* Chat list sidebar */}
            <div className={cn(
              "border-r bg-muted/20",
              activeChat && "hidden lg:block",
              "w-full lg:w-[280px]"
            )}>
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">P2P Чаты</h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setIsMinimized(true)}
                  >
                    <Minimize2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setIsMinimized(true)}
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>
              
              <ScrollArea className={isFullscreen ? "h-[calc(100vh-60px)]" : "h-[calc(600px-60px)]"}>
                <div className="p-2 space-y-1">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                        <p className="text-sm text-muted-foreground">Загрузка чатов...</p>
                      </div>
                    </div>
                  ) : chatRooms.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <MessageSquare className="mx-auto mb-2 opacity-20" size={48} />
                        <p className="text-sm text-muted-foreground">Нет активных чатов</p>
                      </div>
                    </div>
                  ) : (
                    chatRooms.map((room) => (
                    <motion.div
                      key={room.orderId}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Card
                        className={cn(
                          "p-3 cursor-pointer transition-colors",
                          "hover:bg-muted/50",
                          activeChat === room.orderId && "bg-muted"
                        )}
                        onClick={() => openChat(room.orderId)}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="text-sm">
                              {room.counterpartyName ? room.counterpartyName.split(' ').map(n => n[0]).join('').slice(0, 2) : '??'}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm truncate">
                                {room.counterpartyName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {room.lastMessageTime && formatTime(room.lastMessageTime)}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground truncate">
                                {room.lastMessage || 'Нет сообщений'}
                              </p>
                              {room.unreadCount > 0 && (
                                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                                  {room.unreadCount}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant={room.type === 'buy' ? 'default' : 'destructive'} 
                                className="text-xs h-4 px-1"
                              >
                                {room.type === 'buy' ? 'BUY' : 'SELL'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {room.amount} {room.currency}
                              </span>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs h-4 px-1",
                                  room.status === 'active' && "text-green-500 border-green-500/50",
                                  room.status === 'completed' && "text-blue-500 border-blue-500/50",
                                  room.status === 'cancelled' && "text-red-500 border-red-500/50"
                                )}
                              >
                                {room.status === 'active' && 'Активно'}
                                {room.status === 'completed' && 'Завершено'}
                                {room.status === 'cancelled' && 'Отменено'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Chat area */}
            {activeChat ? (
              <div className={cn(
                "flex-1 flex flex-col",
                !activeChat && "hidden"
              )}>
                <ChatHeader room={chatRooms.find(r => r.orderId === activeChat)!} />
                
                {/* Messages */}
                <ScrollArea ref={scrollRef} className="flex-1 p-4">
                  <div className="space-y-4">
                    {/* Date separator */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex-1 h-[1px] bg-border" />
                      <span>Сегодня</span>
                      <div className="flex-1 h-[1px] bg-border" />
                    </div>
                    
                    {messages[activeChat]?.map((message) => (
                      <Message key={message.id} message={message} />
                    ))}
                    
                    {isTyping && (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">АП</AvatarFallback>
                        </Avatar>
                        <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                          <div className="flex items-center gap-1">
                            <Circle className="h-2 w-2 fill-current animate-bounce" />
                            <Circle className="h-2 w-2 fill-current animate-bounce delay-100" />
                            <Circle className="h-2 w-2 fill-current animate-bounce delay-200" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Input */}
                <div className="p-3 border-t">
                  <div className="flex items-end gap-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Paperclip size={18} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ImageIcon size={18} />
                    </Button>
                    
                    <Input
                      placeholder="Введите сообщение..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="flex-1"
                    />
                    
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Smile size={18} />
                    </Button>
                    
                    <Button 
                      size="sm" 
                      onClick={sendMessage}
                      disabled={!newMessage.trim()}
                    >
                      <Send size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Выберите чат для начала общения</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Export function to open specific chat
export function openGlobalChat(orderId: string) {
  // This would be implemented with a global state manager
  window.dispatchEvent(new CustomEvent('openGlobalChat', { detail: { orderId } }));
}