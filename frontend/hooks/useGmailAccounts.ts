import { useState, useEffect } from 'react';
import { socketApi } from '@/services/socket-api';
import { useToast } from '@/components/ui/use-toast';

export interface GmailAccount {
  id: string;
  email: string;
  isActive: boolean;
  lastSync?: string;
  createdAt: string;
  updatedAt: string;
  hasRefreshToken: boolean;
}

export function useGmailAccounts() {
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadAccounts = async () => {
    try {
      const response = await socketApi.emit('accounts:listGmailAccounts', {
        page: 1,
        limit: 100
      });
      
      if (response.success) {
        setAccounts(response.data?.data || []);
      }
    } catch (error) {
      console.error('Failed to load Gmail accounts:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить Gmail аккаунты",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const response = await socketApi.emit('accounts:deleteGmailAccount', { id });
      
      if (response.success) {
        await loadAccounts();
        toast({
          title: "Аккаунт удален",
          description: "Gmail аккаунт успешно удален",
        });
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить аккаунт",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadAccounts();

    // Подписываемся на обновления аккаунтов
    const handleAccountCreated = (data: any) => {
      if (data.platform === 'gmail') {
        loadAccounts();
      }
    };

    const handleAccountDeleted = (data: any) => {
      if (data.platform === 'gmail') {
        loadAccounts();
      }
    };

    socketApi.on('platform:accountCreated', handleAccountCreated);
    socketApi.on('platform:accountDeleted', handleAccountDeleted);

    return () => {
      socketApi.off('platform:accountCreated', handleAccountCreated);
      socketApi.off('platform:accountDeleted', handleAccountDeleted);
    };
  }, []);

  return {
    accounts,
    loading,
    refresh: loadAccounts,
    deleteAccount
  };
}