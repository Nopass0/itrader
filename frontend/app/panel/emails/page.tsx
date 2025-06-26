"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Paperclip, 
  Download, 
  RefreshCw, 
  Search,
  Calendar,
  User,
  ExternalLink,
  Eye,
  Archive,
  Trash2
} from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/use-toast';
import { useEmails } from '@/hooks/useEmails';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  downloadUrl?: string;
}

interface Email {
  id: string;
  subject: string;
  from: string;
  to: string[];
  body: string;
  bodyExcerpt?: string;
  createdAt: string;
  read: boolean;
  attachments: EmailAttachment[];
  inboxId: string;
  emailAddress: string;
}

export default function EmailsPage() {
  const { socket } = useSocket();
  const { toast } = useToast();
  const { 
    listEmails, 
    downloadAttachment: downloadAttachmentHook, 
    markAsRead: markAsReadHook,
    getInboxes,
    sendTestEmail 
  } = useEmails();
  
  const [emails, setEmails] = useState<Email[]>([]);
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Load inboxes
  const loadInboxes = async () => {
    try {
      const response = await getInboxes();
      setInboxes(response.inboxes || []);
      console.log('Loaded inboxes:', response.inboxes);
    } catch (error) {
      console.error('Failed to load inboxes:', error);
    }
  };

  // Load emails from MailSlurp
  const loadEmails = async (retryCount = 0) => {
    if (!socket?.connected) return;
    
    setLoading(true);
    try {
      const response = await listEmails({
        limit: 100,
        search: searchQuery
      });

      console.log('Email response:', {
        response,
        hasEmails: !!response?.emails,
        emailCount: response?.emails?.length || 0,
        firstEmail: response?.emails?.[0]
      });

      if (!response || !response.emails) {
        console.error('Invalid response structure:', response);
        toast({
          title: 'Ошибка формата данных',
          description: 'Получен неверный формат данных от сервера',
          variant: 'destructive'
        });
        setEmails([]);
      } else {
        setEmails(response.emails);
        console.log(`Successfully loaded ${response.emails.length} emails`);
      }
    } catch (error) {
      console.error('Failed to load emails:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Не удалось загрузить письма';
      
      toast({
        title: 'Ошибка загрузки писем',
        description: errorMessage,
        variant: 'destructive'
      });
      
      // Show more detailed error in console
      console.error('Failed to load emails:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack
        });
        
        if (error.message.includes('MAILSLURP_API_KEY')) {
          console.error('MailSlurp API key not configured. Please add MAILSLURP_API_KEY to your .env file.');
        } else if (error.message.includes('not initialized')) {
          console.error('MailSlurp service not initialized. The service might still be starting up.');
          
          // Retry after a delay if service is not initialized yet
          if (retryCount < 3) {
            console.log(`Retrying in 2 seconds... (attempt ${retryCount + 1}/3)`);
            setTimeout(() => {
              loadEmails(retryCount + 1);
            }, 2000);
            return;
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Download attachment
  const downloadAttachment = async (emailId: string, attachmentId: string, fileName: string) => {
    if (!socket?.connected) return;
    
    try {
      const response = await downloadAttachmentHook(emailId, attachmentId);

      // Create download link
      if (response.downloadUrl) {
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast({
        title: 'Успешно',
        description: 'Вложение загружено'
      });
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: error instanceof Error ? error.message : 'Не удалось загрузить вложение',
        variant: 'destructive'
      });
    }
  };

  // Mark email as read
  const markAsRead = async (emailId: string, inboxId: string) => {
    if (!socket?.connected) return;
    
    try {
      await markAsReadHook(emailId, inboxId);

      // Update local state
      setEmails(prev => 
        prev.map(email => 
          email.id === emailId ? { ...email, read: true } : email
        )
      );
    } catch (error) {
      console.error('Failed to mark email as read:', error);
    }
  };

  // Open email dialog
  const openEmail = (email: Email) => {
    setSelectedEmail(email);
    setShowEmailDialog(true);
    
    // Mark as read if not already read
    if (!email.read) {
      markAsRead(email.id, email.inboxId);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU');
  };

  // Filter emails
  const filteredEmails = emails.filter(email => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.from.toLowerCase().includes(query) ||
      email.body.toLowerCase().includes(query) ||
      email.emailAddress.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    if (socket?.connected) {
      // Add a small delay to ensure backend services are ready
      const initializeEmails = async () => {
        await loadInboxes();
        // Wait a bit after loading inboxes to ensure service is ready
        setTimeout(() => {
          loadEmails();
        }, 500);
      };
      initializeEmails();
    }
  }, [socket?.connected]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadEmails();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Почта</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin mr-2" size={24} />
              <span className="text-muted-foreground">Загрузка писем...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Почта</h1>
        <div className="flex gap-2">
          <Button 
            onClick={async () => {
              try {
                await sendTestEmail();
                toast({
                  title: 'Тестовое письмо отправлено',
                  description: 'Обновите страницу через несколько секунд'
                });
                setTimeout(() => loadEmails(), 3000);
              } catch (error) {
                console.error('Test email error:', error);
                toast({
                  title: 'Ошибка',
                  description: error instanceof Error ? error.message : 'Не удалось отправить тестовое письмо',
                  variant: 'destructive'
                });
              }
            }} 
            variant="outline" 
            size="sm"
          >
            <Mail size={16} className="mr-2" />
            Тест
          </Button>
          <Button onClick={() => loadEmails()} variant="outline" size="sm">
            <RefreshCw size={16} className="mr-2" />
            Обновить
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Поиск по теме, отправителю или содержимому..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Mail className="text-purple-500" size={20} />
              <div>
                <p className="text-sm text-muted-foreground">Почтовые ящики</p>
                <p className="text-2xl font-bold">{inboxes.length}</p>
                {inboxes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {inboxes[0].emailAddress}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Mail className="text-blue-500" size={20} />
              <div>
                <p className="text-sm text-muted-foreground">Всего писем</p>
                <p className="text-2xl font-bold">{emails.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Eye className="text-green-500" size={20} />
              <div>
                <p className="text-sm text-muted-foreground">Прочитано</p>
                <p className="text-2xl font-bold">{emails.filter(e => e.read).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Paperclip className="text-orange-500" size={20} />
              <div>
                <p className="text-sm text-muted-foreground">С вложениями</p>
                <p className="text-2xl font-bold">{emails.filter(e => e.attachments.length > 0).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emails List */}
      <Card>
        <CardHeader>
          <CardTitle>Письма ({filteredEmails.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail size={48} className="mx-auto mb-4 opacity-50" />
              <p>Письма не найдены</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-2">
                {filteredEmails.map((email) => (
                  <Card 
                    key={email.id} 
                    className={cn(
                      "cursor-pointer hover:bg-muted/50 transition-colors",
                      !email.read && "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                    onClick={() => openEmail(email)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={cn(
                              "font-medium truncate",
                              !email.read && "font-semibold"
                            )}>
                              {email.subject || 'Без темы'}
                            </h4>
                            {!email.read && (
                              <Badge variant="default" className="text-xs">
                                Новое
                              </Badge>
                            )}
                            {email.attachments.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Paperclip size={12} className="mr-1" />
                                {email.attachments.length}
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground mb-1">
                            <User size={12} className="inline mr-1" />
                            {email.from}
                          </p>
                          
                          <p className="text-sm text-muted-foreground mb-2">
                            <Mail size={12} className="inline mr-1" />
                            {email.emailAddress}
                          </p>
                          
                          {email.bodyExcerpt && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {email.bodyExcerpt}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            <Calendar size={12} className="inline mr-1" />
                            {formatDate(email.createdAt)}
                          </p>
                          
                          {email.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {email.attachments.slice(0, 3).map((attachment) => (
                                <Button
                                  key={attachment.id}
                                  variant="outline"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadAttachment(email.id, attachment.id, attachment.name);
                                  }}
                                >
                                  <Download size={10} className="mr-1" />
                                  {attachment.name}
                                </Button>
                              ))}
                              {email.attachments.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{email.attachments.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail size={20} />
              {selectedEmail?.subject || 'Без темы'}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="space-y-4">
              {/* Email Headers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">От:</p>
                  <p className="text-sm text-muted-foreground">{selectedEmail.from}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Кому:</p>
                  <p className="text-sm text-muted-foreground">{selectedEmail.emailAddress}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Дата:</p>
                  <p className="text-sm text-muted-foreground">{formatDate(selectedEmail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Статус:</p>
                  <Badge variant={selectedEmail.read ? 'secondary' : 'default'}>
                    {selectedEmail.read ? 'Прочитано' : 'Новое'}
                  </Badge>
                </div>
              </div>
              
              {/* Attachments */}
              {selectedEmail.attachments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Paperclip size={16} />
                    Вложения ({selectedEmail.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedEmail.attachments.map((attachment) => (
                      <Card key={attachment.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{attachment.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.contentType} • {formatFileSize(attachment.size)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadAttachment(selectedEmail.id, attachment.id, attachment.name)}
                          >
                            <Download size={14} />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Email Body */}
              <div>
                <h4 className="font-medium mb-2">Содержимое письма:</h4>
                <ScrollArea className="h-[300px] w-full border rounded-md p-4">
                  <div 
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: selectedEmail.body || 'Нет содержимого' }}
                  />
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}