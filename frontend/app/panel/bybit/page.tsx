"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  RefreshCw, 
  Search, 
  Eye, 
  Edit, 
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Wallet,
  Key,
  User
} from 'lucide-react';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BybitAccount {
  id: number;
  apiKey: string;
  status: string;
  errorMessage?: string;
  lastCheckAt?: string;
  accountInfo?: any;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
  };
}

export default function BybitAccountsPage() {
  const [accounts, setAccounts] = useState<BybitAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BybitAccount | null>(null);
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    uid: '',
    email: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuthStore();
  const isAdmin = false; // TODO: implement admin role check

  const loadAccounts = async () => {
    try {
      setLoading(true);
      console.log('Loading Bybit accounts...');
      const response = await apiClient.get('/bybit/accounts');
      console.log('Bybit accounts response:', response);
      
      if (response.success && response.data) {
        // response.data is already an array of accounts
        const accountsData = Array.isArray(response.data) ? response.data : [];
        console.log('Setting accounts:', accountsData);
        setAccounts(accountsData);
      } else {
        console.error('Failed to load accounts:', response.error);
        setAccounts([]);
      }
    } catch (err) {
      console.error('Error loading accounts:', err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreateAccount = async () => {
    if (!formData.apiKey || !formData.apiSecret) {
      setError('API ключ и секрет обязательны');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.post('/bybit/accounts', {
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret
      });
      if (response.success) {
        setIsCreateDialogOpen(false);
        setFormData({ apiKey: '', apiSecret: '', uid: '', email: '' });
        await loadAccounts();
      } else {
        setError(response.error || 'Ошибка создания аккаунта');
      }
    } catch (err) {
      setError('Ошибка при создании аккаунта');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAccount = async () => {
    if (!selectedAccount) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await apiClient.put(`/bybit/accounts/${selectedAccount.id}`, formData);
      if (response.success) {
        setIsEditDialogOpen(false);
        setFormData({ apiKey: '', apiSecret: '', uid: '', email: '' });
        setSelectedAccount(null);
        await loadAccounts();
      } else {
        setError(response.error || 'Ошибка обновления аккаунта');
      }
    } catch (err) {
      setError('Ошибка при обновлении аккаунта');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот аккаунт?')) {
      return;
    }

    try {
      const response = await apiClient.delete(`/bybit/accounts/${id}`);
      if (response.success) {
        await loadAccounts();
      }
    } catch (err) {
      console.error('Error deleting account:', err);
    }
  };

  const handleVerifyAccount = async (id: number) => {
    try {
      const response = await apiClient.post(`/bybit/accounts/${id}/verify`);
      if (response.success) {
        await loadAccounts();
      }
    } catch (err) {
      console.error('Error verifying account:', err);
    }
  };

  const openEditDialog = (account: BybitAccount) => {
    setSelectedAccount(account);
    const accountInfo = account.accountInfo as any || {};
    const p2pUserInfo = accountInfo.p2pUserInfo || {};
    setFormData({ 
      apiKey: account.apiKey, 
      apiSecret: '',
      uid: accountInfo.uid || p2pUserInfo.userId || p2pUserInfo.uid || '',
      email: accountInfo.email || p2pUserInfo.email || p2pUserInfo.emailAddress || ''
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; text: string; className: string }> = {
      'active': { 
        variant: 'default', 
        icon: CheckCircle,
        text: 'Активен',
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
      },
      'initializing': { 
        variant: 'secondary', 
        icon: Clock,
        text: 'Инициализация',
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      },
      'error': { 
        variant: 'destructive', 
        icon: AlertTriangle,
        text: 'Ошибка',
        className: 'bg-red-500/10 text-red-500 border-red-500/20'
      },
      'disabled': { 
        variant: 'outline', 
        icon: null,
        text: 'Отключен',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      }
    };

    const config = statusConfig[status] || statusConfig['disabled'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        {Icon && <Icon size={12} className="mr-1" />}
        {config.text}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const filteredAccounts = accounts.filter(account =>
    account.apiKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (account.accountInfo?.uid && account.accountInfo.uid.includes(searchQuery))
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-3">
            <RefreshCw className="animate-spin" size={20} />
            <span>Загрузка...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold">Bybit Аккаунты</h1>
            <p className="text-muted-foreground">Управление API ключами Bybit</p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={loadAccounts}>
              <RefreshCw size={16} className="mr-2" />
              Обновить
            </Button>
            
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus size={16} className="mr-2" />
              Добавить аккаунт
            </Button>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Поиск по API ключу, пользователю или UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        {/* Accounts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {filteredAccounts.length === 0 ? (
            <Card className="glassmorphism">
              <CardContent className="p-12 text-center">
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Нет аккаунтов</h3>
                <p className="text-muted-foreground">
                  {searchQuery ? 'По вашему запросу ничего не найдено' : 'Добавьте первый Bybit аккаунт'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.map((account, index) => (
                <motion.div
                  key={account.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                >
                  <Card className="glassmorphism hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Key className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg">
                            {account.id} - {account.accountInfo?.email || account.accountInfo?.p2pUserInfo?.email || account.accountInfo?.p2pUserInfo?.emailAddress || account.apiKey.substring(0, 8) + '...'}
                          </CardTitle>
                        </div>
                        {getStatusBadge(account.status)}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      {account.accountInfo && (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">UID:</span>
                            <span className="font-medium">{account.accountInfo.uid || account.accountInfo.p2pUserInfo?.userId || account.accountInfo.p2pUserInfo?.uid}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Тип:</span>
                            <Badge variant="outline">{account.accountInfo.accountType}</Badge>
                          </div>
                          {account.accountInfo.kycLevel && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">KYC:</span>
                              <Badge variant="secondary">{account.accountInfo.kycLevel}</Badge>
                            </div>
                          )}
                        </div>
                      )}

                      {account.user && (
                        <div className="flex items-center gap-2 text-sm">
                          <User size={14} className="text-muted-foreground" />
                          <span className="text-muted-foreground">Пользователь:</span>
                          <span className="font-medium">{account.user.username}</span>
                        </div>
                      )}

                      {account.errorMessage && (
                        <div className="text-sm text-red-500 bg-red-500/10 p-2 rounded">
                          {account.errorMessage}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        {account.lastCheckAt && (
                          <div>Проверен: {formatDate(account.lastCheckAt)}</div>
                        )}
                        <div>Создан: {formatDate(account.createdAt)}</div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Link href={`/panel/bybit/${account.id}`} className="flex-1">
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye size={14} className="mr-1" />
                            Просмотр
                          </Button>
                        </Link>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleVerifyAccount(account.id)}
                        >
                          <RefreshCw size={14} />
                        </Button>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openEditDialog(account)}
                        >
                          <Edit size={14} />
                        </Button>
                        
                        {isAdmin && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteAccount(account.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Create Account Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить Bybit аккаунт</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded">
                {error}
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">API Key</label>
              <Input
                placeholder="Введите API ключ"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">API Secret</label>
              <Input
                type="password"
                placeholder="Введите API секрет"
                value={formData.apiSecret}
                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
              UID и Email будут получены автоматически после добавления аккаунта
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={submitting}
                className="flex-1"
              >
                Отмена
              </Button>
              
              <Button
                onClick={handleCreateAccount}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="animate-spin mr-2" size={16} />
                    Создание...
                  </>
                ) : (
                  'Создать'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать Bybit аккаунт</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {error && (
              <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded">
                {error}
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium">API Key</label>
              <Input
                placeholder="Введите API ключ"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">API Secret (оставьте пустым, чтобы не менять)</label>
              <Input
                type="password"
                placeholder="Введите новый API секрет"
                value={formData.apiSecret}
                onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">UID</label>
              <Input
                placeholder="Введите UID аккаунта"
                value={formData.uid || ''}
                onChange={(e) => setFormData({ ...formData, uid: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="Введите email аккаунта"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedAccount(null);
                  setFormData({ apiKey: '', apiSecret: '', uid: '', email: '' });
                }}
                disabled={submitting}
                className="flex-1"
              >
                Отмена
              </Button>
              
              <Button
                onClick={handleUpdateAccount}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="animate-spin mr-2" size={16} />
                    Обновление...
                  </>
                ) : (
                  'Обновить'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}