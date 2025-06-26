"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Send, 
  RefreshCw, 
  MessageSquare, 
  Clock, 
  Check, 
  CheckCheck,
  User,
  Bot,
  AlertCircle,
  ImageIcon,
  Paperclip,
  ExternalLink,
  Maximize2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { useSocket } from '@/hooks/useSocket';

interface ChatMessage {
  id: string;
  messageId?: string;
  content: string;
  sender: 'us' | 'them' | 'system';
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  imageUrl?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface TransactionChatProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: string;
  orderId?: string;
  counterpartyName?: string;
}

export function TransactionChat({ 
  isOpen, 
  onClose, 
  transactionId, 
  orderId,
  counterpartyName 
}: TransactionChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { socket, isConnected } = useSocket();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Get current user role
  useEffect(() => {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      try {
        const authData = JSON.parse(authStorage);
        const user = authData.state?.user;
        if (user) {
          setCurrentUser(user);
        }
      } catch (e) {
        console.error('Failed to parse auth-storage:', e);
      }
    }
  }, []);

  // Mark messages as read when chat is opened
  useEffect(() => {
    if (isOpen && transactionId && socket && isConnected) {
      socket.emit('bybit:markMessagesAsRead', { transactionId }, (response: any) => {
        if (response.error) {
          console.error('Failed to mark messages as read:', response.error);
        }
      });
    }
  }, [isOpen, transactionId, socket, isConnected]);

  // Load messages from Bybit API
  const loadMessages = useCallback(async () => {
    console.log('Loading messages:', { orderId, socket: !!socket, isConnected });
    if (!orderId || !socket || !isConnected) {
      console.log('Cannot load messages - missing requirements');
      return;
    }
    
    setIsLoading(true);
    try {

      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('bybit:getChatMessages', { 
          orderId,
          transactionId 
        }, (res: any) => {
          console.log('Chat messages response:', res);
          if (res.error) {
            const errorMessage = typeof res.error === 'object' 
              ? res.error.message || JSON.stringify(res.error)
              : res.error;
            reject(new Error(errorMessage));
          } else {
            resolve(res);
          }
        });
      });

      if (response.success && response.data) {
        const formattedMessages: ChatMessage[] = response.data.messages.map((msg: any) => {
          console.log('Processing message:', msg);
          return {
            id: msg.id || msg.messageId,
            messageId: msg.messageId,
            content: msg.content || msg.message,
            sender: msg.sender === 'us' ? 'us' : msg.sender === 'system' ? 'system' : 'them',
            timestamp: new Date(msg.timestamp || msg.createdAt),
            type: msg.type || 'text',
            imageUrl: msg.imageUrl,
            status: 'delivered'
          };
        });

        // Sort messages by timestamp (oldest first)
        formattedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        setMessages(formattedMessages);
        
        // Scroll to bottom on new messages
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }, 100);
      }
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      
      // Extract error details
      let errorMessage = "Не удалось загрузить сообщения";
      if (error.message) {
        try {
          const errorObj = JSON.parse(error.message);
          if (errorObj.code === 'ORDER_NOT_FOUND') {
            errorMessage = "Ордер не найден в Bybit";
          } else if (errorObj.message) {
            errorMessage = errorObj.message;
          }
        } catch {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, transactionId, toast, socket, isConnected]);

  // Send message via Bybit API
  const sendMessage = async () => {
    console.log('Sending message:', { inputMessage, orderId, socket: !!socket, isConnected });
    if (!inputMessage.trim() || !orderId || !socket || !isConnected) {
      console.log('Cannot send message - missing requirements');
      return;
    }

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content: inputMessage,
      sender: 'us',
      timestamp: new Date(),
      type: 'text',
      status: 'sending'
    };

    setMessages(prev => [...prev, tempMessage]);
    setInputMessage('');
    setIsSending(true);

    try {

      const response = await new Promise<any>((resolve, reject) => {
        socket.emit('bybit:sendChatMessage', {
          orderId,
          transactionId,
          message: inputMessage
        }, (res: any) => {
          console.log('Send message response:', res);
          if (res.error) {
            const errorMessage = typeof res.error === 'object' 
              ? res.error.message || JSON.stringify(res.error)
              : res.error;
            reject(new Error(errorMessage));
          } else {
            resolve(res);
          }
        });
      });

      if (response.success) {
        // Update temp message status
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? { ...msg, status: 'sent', id: response.data.messageId || msg.id }
            : msg
        ));

        toast({
          title: "Отправлено",
          description: "Сообщение успешно отправлено",
        });

        // Reload messages to get the latest
        setTimeout(() => loadMessages(), 1000);
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
      
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось отправить сообщение",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !socket || !isConnected || !orderId) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Ошибка",
        description: "Файл слишком большой. Максимальный размер: 10MB",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'video/mp4'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Ошибка",
        description: "Неподдерживаемый тип файла. Разрешены: JPG, PNG, PDF, MP4",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingFile(true);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1]; // Remove data:type;base64, prefix

        // Upload file to Bybit
        const uploadResponse = await new Promise<any>((resolve, reject) => {
          socket.emit('bybit:uploadChatFile', {
            fileData: base64Data,
            fileName: file.name,
            mimeType: file.type,
            transactionId
          }, (res: any) => {
            if (res.error) {
              reject(new Error(res.error.message || res.error));
            } else {
              resolve(res);
            }
          });
        });

        if (uploadResponse.success) {
          // Send the file URL as a message
          const fileUrl = uploadResponse.data.url;
          const messageContent = uploadResponse.data.type === 'IMAGE' 
            ? fileUrl 
            : `[Файл: ${file.name}] ${fileUrl}`;

          // Send message with file URL
          await new Promise((resolve, reject) => {
            socket.emit('bybit:sendChatMessage', {
              orderId,
              transactionId,
              message: messageContent
            }, (res: any) => {
              if (res.error) {
                reject(new Error(res.error.message || res.error));
              } else {
                resolve(res);
              }
            });
          });

          toast({
            title: "Успешно",
            description: "Файл отправлен",
          });

          // Reload messages
          setTimeout(() => loadMessages(), 1000);
        }
      };

      reader.onerror = () => {
        toast({
          title: "Ошибка",
          description: "Не удалось прочитать файл",
          variant: "destructive",
        });
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Failed to upload file:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить файл",
        variant: "destructive",
      });
    } finally {
      setIsUploadingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Auto-refresh messages
  useEffect(() => {
    if (isOpen && orderId && autoRefresh && isConnected) {
      loadMessages();
      
      // Set up auto-refresh every 3 seconds
      refreshIntervalRef.current = setInterval(() => {
        loadMessages();
      }, 3000);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [isOpen, orderId, autoRefresh, isConnected, loadMessages]);

  // Format time
  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get message alignment
  const getMessageAlignment = (sender: string) => {
    return sender === 'us' ? 'justify-end' : 'justify-start';
  };

  // Get message style
  const getMessageStyle = (sender: string) => {
    if (sender === 'us') {
      return 'bg-primary text-primary-foreground';
    } else if (sender === 'system') {
      return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20';
    } else {
      return 'bg-secondary';
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[90vw] h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare size={20} />
                Чат с {counterpartyName || 'контрагентом'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Чат для общения по ордеру {orderId}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {orderId && (
                <a
                  href={`https://www.bybit.com/ru-RU/fiat/trade/otc/orderList/${orderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                >
                  <Badge variant="outline" className="text-xs cursor-pointer hover:bg-secondary">
                    <ExternalLink size={12} className="mr-1" />
                    {orderId}
                  </Badge>
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={cn(autoRefresh && "text-primary")}
              >
                <RefreshCw size={16} className={cn(autoRefresh && "animate-spin")} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          {isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="animate-spin h-6 w-6 text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageSquare size={48} className="mb-2" />
              <p>Нет сообщений</p>
              {!orderId && (
                <p className="text-xs mt-2 text-orange-600">
                  Требуется ID ордера для загрузки чата
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn("flex animate-in fade-in-0 slide-in-from-bottom-2", getMessageAlignment(message.sender))}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={cn("flex gap-2 max-w-[70%]", message.sender === 'us' && "flex-row-reverse")}>
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {message.sender === 'us' ? <User size={16} /> : 
                         message.sender === 'system' ? <Bot size={16} /> : 
                         <User size={16} />}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="space-y-1">
                      <div className={cn(
                        "rounded-lg px-4 py-2",
                        getMessageStyle(message.sender)
                      )}>
                        {message.type === 'image' && message.imageUrl ? (
                          <div className="space-y-2">
                            <div 
                              className="relative cursor-pointer group"
                              onClick={() => setSelectedImage(message.imageUrl!)}
                            >
                              <img 
                                src={message.imageUrl?.includes('http') ? message.imageUrl : `https://api2.bybit.com${message.imageUrl}`} 
                                alt="Chat image" 
                                className="max-w-full max-h-64 rounded hover:opacity-90 transition-opacity"
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded">
                                <Maximize2 size={24} className="text-white" />
                              </div>
                            </div>
                            {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                          </div>
                        ) : message.content.includes('/fiat/p2p/oss/') ? (
                          // Handle Bybit image URLs
                          <div className="space-y-2">
                            <div 
                              className="relative cursor-pointer group"
                              onClick={() => {
                                console.log('Image clicked:', message.content);
                                setSelectedImage(message.content);
                              }}
                            >
                              <img 
                                src={(() => {
                                  const url = message.content.includes('http') 
                                    ? message.content 
                                    : `https://api2.bybit.com${message.content}`;
                                  console.log('Image URL:', url);
                                  return url;
                                })()} 
                                alt="Chat image" 
                                className="max-w-full max-h-64 rounded hover:opacity-90 transition-opacity bg-muted animate-pulse"
                                onLoad={(e) => {
                                  console.log('Image loaded successfully');
                                  (e.target as HTMLElement).classList.remove('animate-pulse');
                                }}
                                onError={(e) => {
                                  console.error('Image failed to load:', (e.target as HTMLImageElement).src);
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded">
                                <Maximize2 size={24} className="text-white" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        )}
                      </div>
                      
                      <div className={cn(
                        "flex items-center gap-2 text-xs text-muted-foreground",
                        message.sender === 'us' && "justify-end"
                      )}>
                        <span>{formatTime(message.timestamp)}</span>
                        {message.sender === 'us' && message.status && (
                          <>
                            {message.status === 'sending' && <Clock size={12} />}
                            {message.status === 'sent' && <Check size={12} />}
                            {message.status === 'delivered' && <CheckCheck size={12} />}
                            {message.status === 'read' && <CheckCheck size={12} className="text-primary" />}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="p-4 space-y-3">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex gap-2"
          >
            {/* File upload button for operators and admins */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'operator') && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.mp4"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingFile || !orderId}
                  title="Прикрепить файл"
                >
                  {isUploadingFile ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <Paperclip size={16} />
                  )}
                </Button>
              </>
            )}
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Введите сообщение..."
              disabled={isSending || !orderId}
              className="flex-1"
            />
            <Button 
              type="submit" 
              disabled={!inputMessage.trim() || isSending || !orderId}
              size="icon"
            >
              {isSending ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </form>
          
          {!orderId && (
            <div className="mt-2 flex items-center gap-2 text-xs text-orange-600">
              <AlertCircle size={14} />
              <span>Для отправки сообщений необходим ID ордера</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Image viewer modal */}
    {selectedImage && (
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-0">
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-50"
              onClick={() => setSelectedImage(null)}
            >
              <X size={24} />
            </Button>
            <img
              src={selectedImage.startsWith('http') ? selectedImage : `https://api2.bybit.com${selectedImage}`}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain animate-in zoom-in-50 fade-in-0 duration-300"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}