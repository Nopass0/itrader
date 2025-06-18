"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { AlertCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useApiCheck } from "@/hooks/useApiCheckSingleton";
import { useToast } from "@/components/ui/use-toast";
import { ParticlesContainer, DotPattern } from "@/components/ui/particles";
import Sidebar from "@/components/panel/Sidebar";
import MobileNav from "@/components/panel/MobileNav";
import { NotificationsMenu } from "@/components/panel/NotificationsMenu";
import { RobotEmoji } from "@/components/ui/animated-emoji";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, user, checkAuth, isMockMode } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const { isOnline } = useApiCheck();
  const { toast } = useToast();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      if (!token) {
        router.push('/login');
        setIsLoading(false);
        return;
      }
      
      const isAuthenticated = await checkAuth();
      if (!isAuthenticated) {
        router.push('/login');
      }
      setIsLoading(false);
    };
    
    verifyAuth();
  }, []); // Remove dependencies to prevent re-runs
  
  // Show demo mode notification
  useEffect(() => {
    if (isMockMode) {
      toast({
        title: "Демо-режим активен",
        description: "Система работает с тестовыми данными",
        duration: 5000,
      });
    }
  }, [isMockMode, toast]);

  // If no user or token, show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center"
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl"></div>
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent relative z-10 mx-auto mb-4"></div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <RobotEmoji size={40} className="mb-4 mt-2" />
            <p className="text-lg font-medium">Загрузка панели</p>
            <p className="text-sm text-muted-foreground">Проверка авторизации...</p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background to-muted relative overflow-hidden">
      {/* Background elements */}
      <ParticlesContainer className="absolute inset-0 -z-10" quantity={20} />
      <DotPattern
        className="absolute inset-0 -z-5 opacity-20"
        dotSpacing={35}
        dotSize={resolvedTheme === 'dark' ? 1.5 : 1}
      />
      <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-primary/5 to-transparent opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-primary/10 to-transparent opacity-30"></div>
      
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>
      
      {/* Mobile navigation */}
      <div className="block md:hidden">
        <MobileNav />
      </div>
      
      {/* Main content */}
      <div className="flex-1 md:ml-64 relative min-h-screen">
        {/* Server status indicator when offline and not in mock mode */}
        {!isOnline && !isMockMode && (
          <div className="sticky top-0 w-full bg-destructive text-destructive-foreground px-4 py-1.5 text-sm text-center font-medium z-30 shadow-md flex items-center justify-center gap-2">
            <AlertCircle size={14} />
            Сервер недоступен. Включите демо-режим для работы с тестовыми данными.
          </div>
        )}
        
        {/* Page content */}
        <main className="p-4 sm:p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      
      {/* Notifications panel */}
      <AnimatePresence>
        {notificationsOpen && (
          <NotificationsMenu 
            isOpen={notificationsOpen} 
            onClose={() => setNotificationsOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}