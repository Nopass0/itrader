import { useState, useEffect } from 'react';
import { socketApi } from '@/services/socket-api';
import { useToast } from '@/components/ui/use-toast';

interface MailSlurpAccount {
  id: string;
  email: string;
  inboxId: string;
  isActive: boolean;
  createdAt: string;
  lastUsed?: string;
}

export function useMailSlurpAccounts() {
  const [accounts, setAccounts] = useState<MailSlurpAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const response = await socketApi.emit('mailslurp:listAccounts', {});
      if (response.success && response.data) {
        setAccounts(Array.isArray(response.data) ? response.data : []);
      } else {
        setAccounts([]);
      }
    } catch (error) {
      console.error('Failed to fetch MailSlurp accounts:', error);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async (email: string, inboxId: string) => {
    try {
      const response = await socketApi.emit('mailslurp:createAccount', {
        email,
        inboxId
      });
      
      if (response.success) {
        toast({
          title: "Аккаунт добавлен",
          description: `MailSlurp аккаунт ${email} успешно добавлен`,
        });
        fetchAccounts();
        return true;
      } else {
        toast({
          title: "Ошибка",
          description: response.error?.message || "Не удалось добавить аккаунт",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить аккаунт",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      const response = await socketApi.emit('mailslurp:deleteAccount', { id });
      
      if (response.success) {
        toast({
          title: "Аккаунт удален",
          description: "MailSlurp аккаунт успешно удален",
        });
        fetchAccounts();
        return true;
      } else {
        toast({
          title: "Ошибка",
          description: response.error?.message || "Не удалось удалить аккаунт",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить аккаунт",
        variant: "destructive",
      });
      return false;
    }
  };

  const setActiveAccount = async (id: string) => {
    try {
      const response = await socketApi.emit('mailslurp:setActive', { id });
      
      if (response.success) {
        toast({
          title: "Аккаунт активирован",
          description: "MailSlurp аккаунт установлен как активный",
        });
        fetchAccounts();
        return true;
      } else {
        toast({
          title: "Ошибка",
          description: response.error?.message || "Не удалось активировать аккаунт",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось активировать аккаунт",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const syncInboxes = async () => {
    try {
      const response = await socketApi.emit('mailslurp:syncInboxes', {});
      
      if (response.success) {
        toast({
          title: "Синхронизация завершена",
          description: `Синхронизировано ${response.data.synced} новых аккаунтов, обновлено ${response.data.updated}`,
        });
        fetchAccounts();
        return true;
      } else {
        toast({
          title: "Ошибка",
          description: response.error?.message || "Не удалось синхронизировать аккаунты",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось синхронизировать аккаунты",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    accounts,
    loading,
    refresh: fetchAccounts,
    createAccount,
    deleteAccount,
    setActiveAccount,
    syncInboxes
  };
}