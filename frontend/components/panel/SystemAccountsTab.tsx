"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UserPlus,
  RefreshCw,
  Trash,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  Key,
  User,
  Settings
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { socketApi } from "@/services/socket-api";

interface SystemAccount {
  id: string;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  createdBy?: string;
}

export function SystemAccountsTab() {
  const [accounts, setAccounts] = useState<SystemAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [copiedPassword, setCopiedPassword] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    role: "operator" as 'admin' | 'operator' | 'viewer'
  });

  // Load accounts
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await socketApi.emit('accounts:list', {});
      if (response.success && response.data) {
        setAccounts(Array.isArray(response.data) ? response.data : []);
      } else {
        setAccounts([]);
      }
    } catch (error) {
      console.error('Failed to fetch system accounts:', error);
      setAccounts([]);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список аккаунтов",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Generate random password
  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Create account
  const handleCreate = async () => {
    if (!formData.username) {
      toast({
        title: "Ошибка",
        description: "Введите имя пользователя",
        variant: "destructive"
      });
      return;
    }

    const password = generatePassword();
    
    try {
      const response = await socketApi.emit('accounts:create', {
        username: formData.username,
        password: password,
        role: formData.role
      });

      if (response.success) {
        setGeneratedPassword(password);
        setShowPasswordDialog(true);
        setShowCreateDialog(false);
        setFormData({ username: "", role: "operator" });
        loadAccounts();
        
        toast({
          title: "Аккаунт создан",
          description: `Аккаунт ${formData.username} успешно создан`
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать аккаунт",
        variant: "destructive"
      });
    }
  };

  // Delete account
  const handleDelete = async (accountId: string, username: string) => {
    if (!confirm(`Вы уверены, что хотите удалить аккаунт ${username}?`)) {
      return;
    }

    try {
      const response = await socketApi.emit('accounts:delete', { id: accountId });
      
      if (response.success) {
        toast({
          title: "Аккаунт удален",
          description: `Аккаунт ${username} успешно удален`
        });
        loadAccounts();
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить аккаунт",
        variant: "destructive"
      });
    }
  };

  // Reset password
  const handleResetPassword = async (accountId: string, username: string) => {
    const password = generatePassword();
    
    try {
      const response = await socketApi.emit('accounts:resetPassword', {
        id: accountId,
        password: password
      });

      if (response.success) {
        setGeneratedPassword(password);
        setShowPasswordDialog(true);
        
        toast({
          title: "Пароль сброшен",
          description: `Пароль для ${username} успешно изменен`
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось сбросить пароль",
        variant: "destructive"
      });
    }
  };

  // Copy password to clipboard
  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  // Get role badge color
  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'operator':
        return 'default';
      case 'viewer':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return Shield;
      case 'operator':
        return User;
      case 'viewer':
        return Eye;
      default:
        return User;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Системные аккаунты</h3>
          <p className="text-sm text-muted-foreground">
            Управление администраторами и операторами системы
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAccounts}>
            <RefreshCw size={16} className="mr-2" />
            Обновить
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus size={16} className="mr-2" />
            Создать аккаунт
          </Button>
        </div>
      </div>

      {/* Accounts List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-primary/20 rounded w-3/4"></div>
                <div className="h-3 bg-primary/10 rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-primary/10 rounded"></div>
                  <div className="h-3 bg-primary/10 rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Shield size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Нет системных аккаунтов</h3>
            <p className="text-muted-foreground mb-6">
              Создайте первый аккаунт администратора или оператора
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <UserPlus size={16} className="mr-2" />
              Создать аккаунт
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {accounts.map((account, index) => {
              const RoleIcon = getRoleIcon(account.role);
              
              return (
                <motion.div
                  key={account.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="group hover:shadow-lg transition-all">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10">
                            <RoleIcon size={20} />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{account.username}</CardTitle>
                            <CardDescription>
                              Создан: {new Date(account.createdAt).toLocaleDateString('ru-RU')}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={getRoleBadgeVariant(account.role)}>
                          {account.role === 'admin' ? 'Админ' : 
                           account.role === 'operator' ? 'Оператор' : 'Просмотр'}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Статус:</span>
                        <Badge variant={account.isActive ? "outline" : "secondary"}>
                          {account.isActive ? "Активен" : "Заблокирован"}
                        </Badge>
                      </div>
                      
                      {account.lastLogin && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Последний вход:</span>
                          <span>{new Date(account.lastLogin).toLocaleString('ru-RU')}</span>
                        </div>
                      )}
                      
                      {account.createdBy && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Создал:</span>
                          <span>{account.createdBy}</span>
                        </div>
                      )}
                    </CardContent>
                    
                    <CardFooter className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetPassword(account.id, account.username)}
                        className="flex-1"
                      >
                        <Key size={14} className="mr-1" />
                        Новый пароль
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(account.id, account.username)}
                        disabled={account.username === 'admin'}
                      >
                        <Trash size={14} />
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create Account Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать системный аккаунт</DialogTitle>
            <DialogDescription>
              Создайте новый аккаунт администратора или оператора. Пароль будет сгенерирован автоматически.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Введите имя пользователя"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'operator' | 'viewer') => 
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield size={16} />
                      Администратор
                    </div>
                  </SelectItem>
                  <SelectItem value="operator">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      Оператор
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye size={16} />
                      Просмотр
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreate}>
              Создать аккаунт
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый пароль</DialogTitle>
            <DialogDescription>
              Сохраните этот пароль в надежном месте. Он показывается только один раз.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg font-mono text-center relative">
              <div className="text-lg break-all">{generatedPassword}</div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={copyPassword}
              >
                {copiedPassword ? (
                  <Check size={16} className="text-green-500" />
                ) : (
                  <Copy size={16} />
                )}
              </Button>
            </div>
            
            <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                ⚠️ Обязательно сохраните этот пароль! После закрытия окна его нельзя будет восстановить.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setShowPasswordDialog(false)}>
              Я сохранил пароль
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}