'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import Logo from '@/components/Logo';
import { ParticlesContainer, DotPattern, AuroraText, AnimatedText } from '@/components/ui/particles';
import { AnimatedEmoji } from '@/components/ui/animated-emoji';

export default function NotFound() {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  return (
    <AnimatePresence>
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-muted relative overflow-hidden">
        <ParticlesContainer className="absolute inset-0 -z-10" quantity={30} />
        <DotPattern
          className="absolute inset-0 -z-5 opacity-30"
          dotSpacing={30}
          dotSize={resolvedTheme === 'dark' ? 1.5 : 1}
        />
        <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-primary/5 to-transparent opacity-50"></div>
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-primary/10 to-transparent opacity-30"></div>
        
        <main className="flex-grow flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 relative z-10">
          <div className="w-full max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8 md:mb-12 flex flex-col items-center"
            >
              <div className="relative">
                <div className="absolute -top-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
                <Logo size="lg" className="mb-4 scale-110 sm:scale-125 md:scale-150 relative z-10" />
              </div>
              
              <div className="mt-8 sm:mt-12 flex flex-col items-center">
                <div className="flex items-center justify-center gap-4 mb-6 relative">
                  <div className="absolute -top-12 -left-12 w-24 h-24 bg-primary/5 rounded-full blur-xl"></div>
                  <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-primary/5 rounded-full blur-xl"></div>

                  <span className="text-4xl animate-bounce relative">🔍</span>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-7xl sm:text-8xl font-bold relative z-10"
                  >
                    <AuroraText
                      gradientColors={['#ff7eb9', '#ff65a7', '#7ea0ff', '#7eb8ff', '#6366f1']}
                    >
                      404
                    </AuroraText>
                    <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-sm"></div>
                  </motion.div>
                  <span className="text-4xl animate-bounce delay-100 relative">😭</span>
                </div>
                
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="text-2xl sm:text-3xl font-semibold mb-4 relative"
                >
                  <span className="relative">Страница не найдена
                    <span className="absolute -bottom-2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></span>
                  </span>
                </motion.h1>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                  className="text-muted-foreground text-lg mb-8 max-w-md mx-auto"
                >
                  <p className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-background to-muted/50 shadow-sm border border-primary/10">
                    <span className="text-xl mr-1">🧐</span>
                    Кажется, эта страница потерялась в цифровом пространстве
                  </p>
                </motion.div>
                
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                  className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                  <Button
                    size="lg"
                    onClick={() => router.push('/')}
                    className="px-8 py-6 glass-button relative overflow-hidden group"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    <span className="mr-2 text-xl group-hover:animate-pulse">🏠</span>
                    <span className="relative z-10">На главную</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => router.back()}
                    className="px-8 py-6 relative overflow-hidden group border-primary/30 hover:border-primary/80 transition-colors"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-background to-background/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                    <span className="mr-2 group-hover:animate-pulse">↩️</span>
                    <span className="relative z-10">Назад</span>
                  </Button>
                </motion.div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
              className="absolute bottom-4 w-full text-center flex justify-center"
            >
              <div className="flex items-center gap-2 text-muted-foreground text-sm px-4 py-2 rounded-full bg-background/50 backdrop-blur-sm border border-muted/20 shadow-sm">
                <span className="text-yellow-500 animate-pulse">💡</span>
                <span>Возможно, адрес был введен неправильно или страница больше не существует</span>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </AnimatePresence>
  );
}