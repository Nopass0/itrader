"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useSpring, useTransform, PanInfo } from "framer-motion";
import { 
  Users, 
  ScrollText, 
  CreditCard, 
  BarChart4, 
  Grip, 
  LogOut, 
  Settings,
  Moon,
  Sun
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuthStore } from "@/store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/particles";

const menuItems = [
  {
    href: "/panel/accounts",
    icon: <Users size={20} />,
    label: "Аккаунты",
    emoji: "👤"
  },
  {
    href: "/panel/logs",
    icon: <ScrollText size={20} />,
    label: "Логи",
    emoji: "📋"
  },
  {
    href: "/panel/transactions",
    icon: <CreditCard size={20} />,
    label: "Транзакции",
    emoji: "💳"
  },
  {
    href: "/panel/stats",
    icon: <BarChart4 size={20} />,
    label: "Статистика",
    emoji: "📊"
  }
];

export const MobileNav: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const isDark = resolvedTheme === "dark";
  
  // Refs for drag behavior
  const constraintsRef = useRef(null);
  const dragY = useSpring(0, { stiffness: 300, damping: 30 });
  const dragYPercent = useTransform(dragY, [0, 300], ["0%", "100%"]);
  
  // Handle swipe gestures
  const handleDragEnd = (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      setIsOpen(false);
    } else {
      dragY.set(0);
    }
  };
  
  // Set user initials for avatar
  const getInitials = () => {
    if (!user || !user.username) return "U";
    return user.username.substring(0, 2).toUpperCase();
  };
  
  // Handle logout
  const handleLogout = () => {
    logout();
    router.push("/login");
  };
  
  // Toggle theme
  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <>
      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-lg border-t border-primary/10 z-40">
        <div className="flex justify-around items-center py-2">
          {menuItems.slice(0, 4).map((item) => (
            <Link href={item.href} key={item.href} className="flex-1">
              <div 
                className={`flex flex-col items-center justify-center py-1 px-2 transition-all ${
                  pathname === item.href || pathname?.startsWith(`${item.href}/`)
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <div className="text-2xl pb-0.5">{item.emoji}</div>
                <div className="text-[10px] font-medium">{item.label}</div>
              </div>
            </Link>
          ))}
          
          {/* Drag handle */}
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="flex flex-col items-center justify-center py-1 px-3 text-muted-foreground"
          >
            <div className="text-2xl pb-0.5">⋮</div>
            <div className="text-[10px] font-medium">Ещё</div>
          </button>
        </div>
      </div>
      
      {/* Swipeable expanded menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={constraintsRef}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl rounded-t-3xl shadow-lg border border-primary/10"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            style={{ y: dragYPercent }}
          >
            {/* Visual drag handle */}
            <div className="flex justify-center pt-2 pb-4">
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full" />
            </div>
            
            {/* User info */}
            <div className="px-4 pb-3 border-b border-primary/10">
              <div className="flex items-center mb-2">
                <Avatar className="h-12 w-12 mr-3 border border-primary/20 shadow-sm">
                  <AvatarImage src={(user as any)?.avatar || ""} />
                  <AvatarFallback>{getInitials()}</AvatarFallback>
                </Avatar>
                
                <div>
                  <p className="font-medium text-lg">{user?.username || "Пользователь"}</p>
                  <p className="text-sm text-muted-foreground">{(user as any)?.role || "Трейдер"}</p>
                </div>
              </div>
            </div>
            
            {/* Extra menu items */}
            <div className="p-3 pb-20">
              <div className="flex items-center justify-between py-3 px-1 mb-2">
                <p className="text-sm font-medium">Тема интерфейса</p>
                <button 
                  onClick={toggleTheme}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary"
                >
                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
                </button>
              </div>
              
              <AnimatedText className="text-xs text-muted-foreground uppercase font-medium px-2 pt-2 pb-1">
                Действия
              </AnimatedText>
              
              <button
                onClick={handleLogout}
                className="flex items-center w-full p-3 my-1 rounded-lg hover:bg-primary/5 transition-all text-destructive"
              >
                <LogOut size={20} className="mr-3" />
                <span>Выйти из системы</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Overlay for when menu is open */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black/20 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default MobileNav;