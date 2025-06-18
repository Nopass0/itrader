"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PlusCircle, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { socketApi } from "@/services/socket-api";

// Form schemas
const gateAccountSchema = z.object({
  email: z.string().email({ message: "Введите корректный email" }),
  password: z.string().min(1, { message: "Пароль обязателен" }),
});

const bybitAccountSchema = z.object({
  apiKey: z.string().min(1, { message: "API ключ обязателен" }),
  apiSecret: z.string().min(1, { message: "API секрет обязателен" }),
});

const gmailAccountSchema = z.object({
  email: z.string().email({ message: "Введите корректный email" }),
});

type GateAccountFormValues = z.infer<typeof gateAccountSchema>;
type BybitAccountFormValues = z.infer<typeof bybitAccountSchema>;
type GmailAccountFormValues = z.infer<typeof gmailAccountSchema>;

interface AddAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: () => void;
}

export const AddAccountDialog: React.FC<AddAccountDialogProps> = ({
  isOpen,
  onClose,
  onAccountAdded,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("gate");

  // Gate form
  const gateForm = useForm<GateAccountFormValues>({
    resolver: zodResolver(gateAccountSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Bybit form
  const bybitForm = useForm<BybitAccountFormValues>({
    resolver: zodResolver(bybitAccountSchema),
    defaultValues: {
      apiKey: "",
      apiSecret: "",
    },
  });

  // Gmail form
  const gmailForm = useForm<GmailAccountFormValues>({
    resolver: zodResolver(gmailAccountSchema),
    defaultValues: {
      email: "",
    },
  });

  const onGateSubmit = async (data: GateAccountFormValues) => {
    setIsLoading(true);
    try {
      const response = await socketApi.accounts.createGateAccount({
        email: data.email,
        password: data.password,
        apiKey: '', // Will be generated on backend
        apiSecret: '' // Will be generated on backend
      });
      
      if (response.success) {
        toast({
          title: "Аккаунт Gate.cx добавлен",
          description: "Аккаунт находится в процессе инициализации",
        });
        gateForm.reset();
        onAccountAdded();
        onClose();
      } else {
        toast({
          title: "Ошибка добавления аккаунта",
          description: response.error?.message || "Не удалось добавить аккаунт",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка добавления аккаунта",
        description: error.message || "Произошла ошибка при добавлении аккаунта",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onBybitSubmit = async (data: BybitAccountFormValues) => {
    setIsLoading(true);
    try {
      const response = await socketApi.accounts.createBybitAccount({
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        accountName: '' // Optional
      });
      
      if (response.success) {
        toast({
          title: "Аккаунт Bybit добавлен",
          description: "Аккаунт находится в процессе инициализации",
        });
        bybitForm.reset();
        onAccountAdded();
        onClose();
      } else {
        toast({
          title: "Ошибка добавления аккаунта",
          description: response.error?.message || "Не удалось добавить аккаунт",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка добавления аккаунта",
        description: error.message || "Произошла ошибка при добавлении аккаунта",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const [showGmailCodeInput, setShowGmailCodeInput] = useState(false);
  const [gmailOAuthState, setGmailOAuthState] = useState<string>("");
  const [gmailAuthUrl, setGmailAuthUrl] = useState<string>("");
  const [gmailCode, setGmailCode] = useState<string>("");

  const onGmailSubmit = async (data: GmailAccountFormValues) => {
    setIsLoading(true);
    try {
      // Начинаем OAuth процесс
      const response = await socketApi.emit('accounts:startGmailOAuth', {
        returnUrl: '/panel/accounts'
      });
      
      if (response.success && response.data?.authUrl) {
        // Сохраняем state и URL
        setGmailOAuthState(response.data.state);
        setGmailAuthUrl(response.data.authUrl);
        localStorage.setItem('gmail_oauth_state', response.data.state);
        
        // Открываем в новой вкладке
        window.open(response.data.authUrl, '_blank');
        
        // Показываем поле для ввода кода
        setShowGmailCodeInput(true);
        
        toast({
          title: "Авторизация открыта в новой вкладке",
          description: "После авторизации скопируйте код или URL из адресной строки",
        });
      } else {
        toast({
          title: "Ошибка",
          description: response.error?.message || "Не удалось начать авторизацию",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Произошла ошибка при добавлении аккаунта",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onGmailCodeSubmit = async () => {
    if (!gmailCode.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите код авторизации или URL",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Извлекаем код из URL если нужно
      let code = gmailCode.trim();
      
      // Проверяем, является ли это URL
      if (code.includes("http") || code.includes("code=")) {
        const urlParams = new URLSearchParams(code.includes("?") ? code.split("?")[1] : code);
        const extractedCode = urlParams.get("code");
        if (extractedCode) {
          code = extractedCode;
        }
      }

      // Завершаем OAuth процесс
      const response = await socketApi.emit('accounts:completeGmailOAuth', {
        code,
        state: gmailOAuthState,
      });

      if (response.success) {
        toast({
          title: "Успешно!",
          description: `Gmail аккаунт ${response.data.email} успешно добавлен`,
        });
        
        // Сбрасываем форму
        gmailForm.reset();
        setShowGmailCodeInput(false);
        setGmailCode("");
        setGmailOAuthState("");
        setGmailAuthUrl("");
        
        onAccountAdded();
        onClose();
      } else {
        // Проверяем специфичные ошибки OAuth
        const errorMessage = response.error?.message || "Не удалось завершить авторизацию";
        const isInvalidGrant = errorMessage.toLowerCase().includes('invalid grant') || 
                               errorMessage.toLowerCase().includes('invalid_grant');
        
        if (isInvalidGrant) {
          toast({
            title: "Код авторизации истек",
            description: "Код авторизации устарел или уже был использован. Пожалуйста, начните процесс авторизации заново.",
            variant: "destructive",
          });
          
          // Предлагаем начать заново
          setShowGmailCodeInput(false);
          setGmailCode("");
          setGmailOAuthState("");
          setGmailAuthUrl("");
        } else {
          toast({
            title: "Ошибка",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить Gmail аккаунт",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md"
      >
        <Card className="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle size={20} />
                Добавить аккаунт
              </CardTitle>
              <CardDescription>
                Добавьте новый торговый аккаунт
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X size={16} />
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="gate">Gate.cx</TabsTrigger>
                <TabsTrigger value="bybit">Bybit</TabsTrigger>
                <TabsTrigger value="gmail">Gmail</TabsTrigger>
              </TabsList>
              
              <TabsContent value="gate" className="space-y-4 mt-4">
                <form onSubmit={gateForm.handleSubmit(onGateSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="gate-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="gate-email"
                      type="email"
                      placeholder="Введите email от Gate.cx"
                      {...gateForm.register('email')}
                      className="glass-input"
                    />
                    {gateForm.formState.errors.email && (
                      <p className="text-destructive text-xs">
                        {gateForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="gate-password" className="text-sm font-medium">
                      Пароль
                    </label>
                    <Input
                      id="gate-password"
                      type="password"
                      placeholder="Введите пароль от Gate.cx"
                      {...gateForm.register('password')}
                      className="glass-input"
                    />
                    {gateForm.formState.errors.password && (
                      <p className="text-destructive text-xs">
                        {gateForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Добавление..." : "Добавить аккаунт Gate.cx"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="bybit" className="space-y-4 mt-4">
                <form onSubmit={bybitForm.handleSubmit(onBybitSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="bybit-apikey" className="text-sm font-medium">
                      API Key
                    </label>
                    <Input
                      id="bybit-apikey"
                      type="text"
                      placeholder="Введите API ключ от Bybit"
                      {...bybitForm.register('apiKey')}
                      className="glass-input"
                    />
                    {bybitForm.formState.errors.apiKey && (
                      <p className="text-destructive text-xs">
                        {bybitForm.formState.errors.apiKey.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="bybit-apisecret" className="text-sm font-medium">
                      API Secret
                    </label>
                    <Input
                      id="bybit-apisecret"
                      type="password"
                      placeholder="Введите API секрет от Bybit"
                      {...bybitForm.register('apiSecret')}
                      className="glass-input"
                    />
                    {bybitForm.formState.errors.apiSecret && (
                      <p className="text-destructive text-xs">
                        {bybitForm.formState.errors.apiSecret.message}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Добавление..." : "Добавить аккаунт Bybit"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="gmail" className="space-y-4 mt-4">
                {!showGmailCodeInput ? (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>Для добавления Gmail аккаунта:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Нажмите кнопку ниже</li>
                        <li>В новой вкладке откроется страница Google</li>
                        <li>Войдите в свой Gmail аккаунт</li>
                        <li>Разрешите доступ приложению</li>
                        <li>Скопируйте код или URL из адресной строки</li>
                        <li>Вставьте его в появившееся поле</li>
                      </ol>
                    </div>
                    
                    <Button
                      onClick={() => onGmailSubmit({ email: '' })}
                      className="w-full"
                      disabled={isLoading}
                    >
                      {isLoading ? "Загрузка..." : "Начать авторизацию"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p className="font-medium">Авторизация открыта в новой вкладке</p>
                      <p>После авторизации в Google вы увидите URL вида:</p>
                      <code className="block p-2 bg-muted rounded text-xs break-all">
                        http://localhost/?code=4/0AX4XfWh...&scope=...
                      </code>
                      <p>Скопируйте либо:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Весь URL целиком из адресной строки</li>
                        <li>Только код между 'code=' и '&scope'</li>
                      </ul>
                      <p className="text-yellow-600 dark:text-yellow-400 mt-3">
                        ⚠️ Важно: используйте код в течение 5 минут после получения
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="gmail-code" className="text-sm font-medium">
                        Код авторизации или URL
                      </label>
                      <Input
                        id="gmail-code"
                        type="text"
                        placeholder="Вставьте код или полный URL"
                        value={gmailCode}
                        onChange={(e) => setGmailCode(e.target.value)}
                        className="glass-input"
                      />
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowGmailCodeInput(false);
                          setGmailCode("");
                          setGmailOAuthState("");
                          setGmailAuthUrl("");
                        }}
                        disabled={isLoading}
                        className="flex-1"
                      >
                        Отмена
                      </Button>
                      <Button
                        onClick={onGmailCodeSubmit}
                        disabled={isLoading || !gmailCode.trim()}
                        className="flex-1"
                      >
                        {isLoading ? "Проверка..." : "Подтвердить"}
                      </Button>
                    </div>
                    
                    <Button
                      variant="link"
                      onClick={() => window.open(gmailAuthUrl, '_blank')}
                      className="w-full text-xs"
                    >
                      Открыть авторизацию снова
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};