"use client";

import { useState, useEffect } from 'react';
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
import { RobotEmoji } from '@/components/ui/animated-emoji';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import Logo from '@/components/Logo';
import { useAuthStore } from '@/store/auth';
import { useApiCheck } from '@/hooks/useApiCheckSingleton';

// Form validation schema
const loginSchema = z.object({
  username: z.string().min(3, { message: 'Имя пользователя должно содержать минимум 3 символа' }),
  password: z.string().min(1, { message: 'Пароль обязателен' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { login } = useAuthStore();
  const { toast } = useToast();
  const { isOnline } = useApiCheck();
  const [isLoading, setIsLoading] = useState(false);

  // Set up form with validation
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      if (!isOnline) {
        // Mock mode login when server is offline
        await mockLogin(data);
      } else {
        // Regular login when server is online
        const success = await login(data);
        
        if (success) {
          toast({
            title: "Вход успешно выполнен",
            variant: "success",
          });
          // Don't manually navigate, let AuthProvider handle it
        } else {
          toast({
            title: "Ошибка входа",
            description: "Неверное имя пользователя или пароль",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Ошибка входа",
        description: "Произошла ошибка при попытке входа",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mock login function when server is offline
  const mockLogin = async (data: LoginFormValues) => {
    // Use the store's mock mode login
    const success = await login(data);
    
    if (success) {
      toast({
        title: "Вход в режиме ДЕМО",
        description: "Вход выполнен в демо-режиме. Данные являются тестовыми.",
        variant: "success",
      });
      // Don't manually navigate, let AuthProvider handle it
    } else {
      toast({
        title: "Ошибка входа",
        description: "Неверное имя пользователя или пароль",
        variant: "destructive",
      });
    }
    
    return success;
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
            <h2 className="text-3xl mb-4 text-center font-medium tracking-tight">Добро пожаловать в <span className="text-primary">iTrader</span></h2>
            <p className="text-center text-muted-foreground mb-4">
              Платформа для интеграции с биржами Gate.cx и Bybit, 
              с современным интерфейсом в стиле стекломорфизма.
            </p>
            <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">Демо-данные для входа:</p>
              <p className="text-xs text-blue-500 dark:text-blue-300">
                Логин: <code className="bg-blue-500/10 px-1 py-0.5 rounded">admin</code>
              </p>
              <p className="text-xs text-blue-500 dark:text-blue-300">
                Пароль: <code className="bg-blue-500/10 px-1 py-0.5 rounded">admin123</code>
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 mt-4">
              <RobotEmoji size={30} />
              {!isOnline && (
                <div className="text-sm px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                  Демо-режим активен
                </div>
              )}
            </div>
          </motion.div>
        </div>
        
        {/* Right column with login form */}
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
                  <RobotEmoji size={22} /> Вход в систему
                </CardTitle>
                <CardDescription>
                  Введите свои данные для входа
                </CardDescription>
                {!isOnline && (
                  <div className="mt-2 text-sm px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                    Сервер недоступен. Активирован демо-режим.
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
                </CardContent>
                
                <CardFooter className="flex flex-col">
                  <Button 
                    type="submit" 
                    className="w-full mb-4 apple-button"
                    disabled={isLoading}
                  >
                    {isLoading ? "Вход..." : "Войти"}
                  </Button>
                  
                  <p className="text-sm text-center text-muted-foreground">
                    Нет аккаунта?{" "}
                    <Link href="/register" className="text-primary hover:underline">
                      Зарегистрироваться
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