"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { ParticlesContainer, DotPattern } from '@/components/ui/particles';
import { ChartIncreasingEmoji } from '@/components/ui/animated-emoji';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import Logo from '@/components/Logo';
import socketApi from '@/services/socket-api';
import { useApiCheck } from '@/hooks/useApiCheckSingleton';

// Form validation schema
const registerSchema = z.object({
  username: z.string().min(3, { message: 'Имя пользователя должно содержать минимум 3 символа' }),
  email: z.string().email({ message: 'Введите корректный email адрес' }),
  password: z.string().min(6, { message: 'Пароль должен содержать минимум 6 символов' }),
  confirmPassword: z.string().min(6, { message: 'Подтверждение пароля должно содержать минимум 6 символов' }),
  adminToken: z.string().min(1, { message: 'Токен администратора обязателен' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { toast } = useToast();
  const { isOnline } = useApiCheck();
  const [isLoading, setIsLoading] = useState(false);

  // Set up form with validation
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      adminToken: '',
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    
    try {
      if (!isOnline) {
        // Mock registration when server is offline
        await mockRegister(data);
      } else {
        // Regular registration when server is online
        const { confirmPassword, ...registerData } = data;
        const response = await socketApi.emit('auth:register', registerData);
        
        if (response.success) {
          toast({
            title: "Регистрация успешна",
            description: "Теперь вы можете войти в систему",
          });
          router.push('/login');
        } else {
          toast({
            title: "Ошибка регистрации",
            description: typeof response.error === 'string' ? response.error : response.error?.message || "Не удалось зарегистрировать пользователя",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Ошибка регистрации",
        description: error.message || "Произошла ошибка при регистрации",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mock registration function when server is offline
  const mockRegister = async (data: RegisterFormValues) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check if admin token matches demo token
    if (data.adminToken !== 'demo') {
      toast({
        title: "Ошибка регистрации",
        description: "Неверный токен администратора. В демо-режиме используйте токен 'demo'",
        variant: "destructive",
      });
      return false;
    }
    
    toast({
      title: "Регистрация успешна (ДЕМО)",
      description: "Регистрация выполнена в демо-режиме. Теперь вы можете войти в систему.",
    });
    
    router.push('/login');
    return true;
  };

  return (
    <AnimatePresence>
      <div className="flex min-h-screen bg-gradient-to-br from-background to-muted overflow-hidden relative">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle size="sm" variant="icon" />
        </div>
        <ParticlesContainer className="absolute inset-0 -z-10" quantity={30} />
        <DotPattern
          className="absolute inset-0 -z-5 opacity-30"
          dotSpacing={30}
          dotSize={resolvedTheme === 'dark' ? 1.5 : 1}
        />
        
        {/* Left column with Logo */}
        <div className="hidden md:flex flex-col w-1/2 p-10 items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center max-w-md"
          >
            <Logo size="lg" className="mb-8" />
            <h2 className="text-3xl mb-4 text-center font-medium tracking-tight">Регистрация в <span className="text-primary">iTrader</span></h2>
            <p className="text-center text-muted-foreground mb-4">
              Создайте аккаунт для доступа к платформе интеграции с биржами Gate.cx и Bybit.
              {!isOnline && " В демо-режиме используйте токен 'demo'."}
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <ChartIncreasingEmoji size={30} />
              {!isOnline && (
                <div className="text-sm px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                  Демо-режим активен
                </div>
              )}
            </div>
          </motion.div>
        </div>
        
        {/* Right column with registration form */}
        <div className="w-full md:w-1/2 flex items-center justify-center p-4 sm:p-6 md:p-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-md"
          >
            <Card glass hover className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChartIncreasingEmoji size={22} /> Регистрация
                </CardTitle>
                <CardDescription>
                  Создайте новую учетную запись
                </CardDescription>
                {!isOnline && (
                  <div className="mt-2 text-sm px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                    Сервер недоступен. Активирован демо-режим.
                    <br />Используйте токен администратора: <strong>demo</strong>
                  </div>
                )}
              </CardHeader>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="username" className="text-sm font-medium">
                      Имя пользователя
                    </label>
                    <Input
                      id="username"
                      type="text" 
                      placeholder="Введите имя пользователя"
                      {...form.register('username')}
                      className="glass-input"
                    />
                    {form.formState.errors.username && (
                      <p className="text-destructive text-xs mt-1">
                        {form.formState.errors.username.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email" 
                      placeholder="Введите email адрес"
                      {...form.register('email')}
                      className="glass-input"
                    />
                    {form.formState.errors.email && (
                      <p className="text-destructive text-xs mt-1">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">
                      Пароль
                    </label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Введите пароль"
                      {...form.register('password')}
                      className="glass-input"
                    />
                    {form.formState.errors.password && (
                      <p className="text-destructive text-xs mt-1">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium">
                      Подтверждение пароля
                    </label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Подтвердите пароль"
                      {...form.register('confirmPassword')}
                      className="glass-input"
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="text-destructive text-xs mt-1">
                        {form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="adminToken" className="text-sm font-medium">
                      Токен администратора
                    </label>
                    <Input
                      id="adminToken"
                      type="text"
                      placeholder="Введите токен администратора"
                      {...form.register('adminToken')}
                      className="glass-input"
                    />
                    {form.formState.errors.adminToken && (
                      <p className="text-destructive text-xs mt-1">
                        {form.formState.errors.adminToken.message}
                      </p>
                    )}
                    {!isOnline && (
                      <p className="text-xs mt-1 text-muted-foreground">
                        В демо-режиме используйте токен: <code className="bg-primary/10 px-1 py-0.5 rounded text-primary">demo</code>
                      </p>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="flex flex-col">
                  <Button 
                    type="submit" 
                    className="w-full mb-4 apple-button"
                    disabled={isLoading}
                  >
                    {isLoading ? "Регистрация..." : "Зарегистрироваться"}
                  </Button>
                  
                  <p className="text-sm text-center text-muted-foreground">
                    Уже есть аккаунт?{" "}
                    <Link href="/login" className="text-primary hover:underline">
                      Войти
                    </Link>
                  </p>
                </CardFooter>
              </form>
            </Card>
            
            <div className="mt-4 text-center">
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
                Вернуться на главную
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
}