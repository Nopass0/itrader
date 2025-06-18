"use client";

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import ApiStatus from '@/components/ApiStatus';
import Logo from '@/components/Logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { RobotEmoji, MoneyFaceEmoji, ChartIncreasingEmoji, DollarEmoji, MoneyBagEmoji } from '@/components/ui/animated-emoji';
import { ParticlesContainer, DotPattern, AuroraText, AnimatedText } from '@/components/ui/particles';

export default function Home() {
  const { token, user } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const router = useRouter();

  // If user is logged in, redirect to dashboard
  useEffect(() => {
    if (token && user) {
      router.push('/dashboard');
    }
  }, [token, user, router]);

  return (
    <AnimatePresence>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-muted relative overflow-hidden">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle size="sm" variant="icon" />
        </div>
        <ParticlesContainer className="absolute inset-0 -z-10" quantity={40} />
        <DotPattern
          className="absolute inset-0 -z-5 opacity-30"
          dotSpacing={30}
          dotSize={resolvedTheme === 'dark' ? 1.5 : 1}
        />
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
        <div className="w-full max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8 md:mb-12 flex flex-col items-center"
          >
            <Logo size="lg" className="mb-6 scale-110 sm:scale-125 md:scale-150" />
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 px-4">
              <span className="inline-block hidden sm:block"><ChartIncreasingEmoji size={28} /></span>
              <AnimatedText
                highlightColor=""
                className="text-lg sm:text-xl md:text-2xl font-medium text-muted-foreground">
                Платформа для торговли на Gate.cx и Bybit
              </AnimatedText>
              <span className="inline-block hidden sm:block"><MoneyBagEmoji size={28} /></span>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card glass hover>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RobotEmoji size={20} /> Вход в систему
                  </CardTitle>
                  <CardDescription>
                    Войдите в аккаунт для доступа к платформе
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                    Если у вас уже есть аккаунт, войдите для доступа к панели управления.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button className="w-full py-5 sm:py-6" onClick={() => router.push('/login')}>
                    Войти
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <Card glass hover>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChartIncreasingEmoji size={20} /> Регистрация
                  </CardTitle>
                  <CardDescription>
                    Зарегистрируйтесь для начала работы
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                    Для регистрации необходим токен администратора. Обратитесь к администратору платформы.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full py-5 sm:py-6"
                    onClick={() => router.push('/register')}
                  >
                    Зарегистрироваться
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </div>

          <div className="mt-8 sm:mt-10 md:mt-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <ApiStatus />
            </motion.div>
          </div>
        </div>
      </main>
      
      <footer className="py-4 sm:py-6 md:py-8 text-center text-xs sm:text-sm text-muted-foreground relative z-10">
        <motion.div
          className="flex flex-wrap items-center justify-center gap-1 sm:gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          © {new Date().getFullYear()} <Logo size="sm" withText={false} />
          <AuroraText
            gradientColors={['#4f46e5', '#06b6d4', '#8b5cf6']}
            className="font-medium">
            iTrader
          </AuroraText>
          . Все права защищены.
        </motion.div>
      </footer>
    </div>
    </AnimatePresence>
  );
}