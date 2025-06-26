"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import {
  Users,
  ScrollText,
  CreditCard,
  BarChart4,
  LogOut,
  ChevronRight,
  Settings,
  Bell,
  HelpCircle,
  Receipt,
  Mail,
  TrendingUp
} from "lucide-react";

import Logo from "@/components/Logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useAuthStore } from "@/store/auth";
import { useApiCheck } from "@/hooks/useApiCheckSingleton";
import { useOrchestrator } from "@/hooks/useOrchestrator";
import { useLogsCount } from "@/hooks/useLogsCount";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/particles";
import { Badge } from "@/components/ui/badge";
import { RobotEmoji, MoneyBagEmoji, ChartIncreasingEmoji } from "@/components/ui/animated-emoji";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Pause, Play } from "lucide-react";

interface MenuItemProps {
  href: string;
  icon: React.ReactNode;
  emoji?: React.ReactNode;
  label: string;
  isActive: boolean;
  delay: number;
  badge?: string | number;
}

const menuItems = [
  {
    href: "/panel/accounts",
    icon: <Users size={20} />,
    emoji: <RobotEmoji size={20} />,
    label: "Аккаунты"
  },
  {
    href: "/panel/logs",
    icon: <ScrollText size={20} />,
    emoji: <AnimatePresence><motion.span>📋</motion.span></AnimatePresence>,
    label: "Логи"
  },
  {
    href: "/panel/transactions",
    icon: <CreditCard size={20} />,
    emoji: <MoneyBagEmoji size={20} />,
    label: "Транзакции"
  },
  {
    href: "/panel/receipts",
    icon: <Receipt size={20} />,
    emoji: <AnimatePresence><motion.span>🧾</motion.span></AnimatePresence>,
    label: "Чеки"
  },
  {
    href: "/panel/emails",
    icon: <Mail size={20} />,
    emoji: <AnimatePresence><motion.span>📧</motion.span></AnimatePresence>,
    label: "Почта"
  },
  {
    href: "/panel/analytics",
    icon: <BarChart4 size={20} />,
    emoji: <ChartIncreasingEmoji size={20} />,
    label: "Аналитика"
  }
];

// Single menu item with animation
const MenuItem: React.FC<MenuItemProps> = ({ href, icon, emoji, label, isActive, delay, badge }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Link href={href} passHref>
        <div 
          className={`flex items-center p-3 my-1 rounded-lg transition-all group relative ${
            isActive 
              ? "bg-primary/10 text-primary" 
              : "hover:bg-primary/5 text-foreground"
          }`}
        >
          {/* Animated indicator for active item */}
          {isActive && (
            <motion.div
              layoutId="active-indicator"
              className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
          
          {/* Icon with emoji hover effect */}
          <div className="relative w-6 mr-3 flex items-center justify-center">
            <motion.div
              animate={{ opacity: isActive ? 0 : 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {icon}
            </motion.div>
            
            <motion.div
              animate={{ opacity: isActive ? 1 : 0 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {emoji || icon}
            </motion.div>
          </div>
          
          <AnimatedText
            className={isActive ? "font-medium" : ""}
            highlightColor={isActive ? "text-primary" : ""}
          >
            {label}
          </AnimatedText>
          
          {/* Badge if provided */}
          {badge && (
            <Badge 
              variant="outline" 
              className={`ml-auto ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted/50'}`}
            >
              {badge}
            </Badge>
          )}
          
          {/* Active indicator arrow */}
          {isActive && !badge && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-auto"
            >
              <ChevronRight size={16} className="text-primary" />
            </motion.div>
          )}
        </div>
      </Link>
    </motion.div>
  );
};

export const Sidebar: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isMockMode } = useAuthStore();
  const { isOnline } = useApiCheck();
  const { status: orchestratorStatus, isLoading: orchestratorLoading, canControl, toggle: toggleOrchestrator } = useOrchestrator();
  const { formattedCount: logsCount } = useLogsCount();
  
  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user || !user.username) return "U";
    return user.username.substring(0, 2).toUpperCase();
  };
  
  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 border-r border-primary/10 bg-background/40 backdrop-blur-lg z-20 flex flex-col">
      {/* Logo with glow effect */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="p-4 flex justify-center border-b border-primary/10 relative"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-10 bg-primary/20 rounded-full blur-xl"></div>
        <Logo size="md" className="relative z-10" />
      </motion.div>
      
      {/* Status indicator with enhanced styling */}
      {(isMockMode || !isOnline) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="px-3 py-2"
        >
          <Card glass hover className="p-3 flex items-center gap-3 overflow-hidden border-primary/10 shadow-sm">
            {isMockMode ? (
              <>
                <div className="flex-shrink-0 p-2 rounded-full bg-amber-500/10">
                  <RobotEmoji size={20} className="animate-pulse" />
                </div>
                <div className="text-xs flex flex-col min-w-0">
                  <span className="font-medium text-amber-500">Демо-режим активен</span>
                  <span className="text-muted-foreground truncate">Тестовые данные</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex-shrink-0 p-2 rounded-full bg-destructive/10">
                  <HelpCircle size={20} className="text-destructive" />
                </div>
                <div className="text-xs flex flex-col min-w-0">
                  <span className="font-medium text-destructive">Сервер недоступен</span>
                  <span className="text-muted-foreground truncate">Включите демо-режим</span>
                </div>
              </>
            )}
          </Card>
        </motion.div>
      )}
      
      {/* Orchestrator control */}
      {canControl && isOnline && !isMockMode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="px-3 py-2"
        >
          <Card glass hover className="p-3 flex items-center gap-3 overflow-hidden border-primary/10 shadow-sm">
            <div className={`flex-shrink-0 p-2 rounded-full ${
              orchestratorStatus?.isRunning ? 'bg-green-500/10' : 'bg-yellow-500/10'
            }`}>
              {orchestratorLoading ? (
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              ) : orchestratorStatus?.isRunning ? (
                <Play size={20} className="text-green-500" />
              ) : (
                <Pause size={20} className="text-yellow-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">Оркестратор</div>
              <div className="text-xs text-muted-foreground">
                {orchestratorLoading ? 'Загрузка...' : 
                 orchestratorStatus?.isRunning ? 'Активен' : 'Приостановлен'}
              </div>
            </div>
            <Switch
              checked={orchestratorStatus?.isRunning || false}
              onCheckedChange={toggleOrchestrator}
              disabled={orchestratorLoading || !orchestratorStatus}
              className="data-[state=checked]:bg-green-500"
            />
          </Card>
        </motion.div>
      )}
      
      {/* Menu items with enhanced styling */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg blur-md opacity-70"></div>
          <div className="text-xs text-primary/70 uppercase font-medium px-3 pt-3 pb-2 relative">
            Навигация
          </div>
        </motion.div>
        
        <div className="space-y-1 pt-1">
          {menuItems.map((item, index) => (
            <MenuItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              emoji={item.emoji}
              label={item.label}
              isActive={pathname === item.href || pathname?.startsWith(`${item.href}/`)}
              delay={0.15 + index * 0.05}
              badge={item.href === "/panel/logs" ? logsCount : undefined}
            />
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="relative mt-4"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-lg blur-md opacity-70"></div>
          <div className="text-xs text-primary/70 uppercase font-medium px-3 pt-3 pb-2 relative">
            Система
          </div>
        </motion.div>
        
        <div className="pt-1">
          <MenuItem
            href="/panel/settings"
            icon={<Settings size={20} />}
            label="Настройки"
            isActive={pathname === "/panel/settings" || pathname?.startsWith("/panel/settings/")}
            delay={0.4}
          />
        </div>
      </div>
      
      {/* User and theme section with enhanced styling */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.5 }}
        className="p-4 border-t border-primary/10 bg-gradient-to-b from-transparent to-primary/5"
      >
        <div className="flex items-center mb-3 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-md opacity-0 group-hover:opacity-70 transition-opacity"></div>
            <Avatar className="h-10 w-10 mr-3 border border-primary/20 shadow-md relative">
              <AvatarImage src={(user as any)?.avatar || ""} />
              <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/5 text-primary/90 font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
              {user?.username || "Пользователь"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {(user as any)?.role || "Трейдер"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-primary/10">
          <div className="flex gap-1">
            <ThemeToggle size="sm" variant="icon" className="h-9 w-9" />
            
            <Button 
              variant="ghost" 
              size="icon"
              className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-primary/10" 
            >
              <Bell size={18} />
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={handleLogout} 
            className="rounded-full h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </motion.div>
    </aside>
  );
};

export default Sidebar;