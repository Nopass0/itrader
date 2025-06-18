"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedText } from "@/components/ui/particles";

// Sample notifications for demo
const SAMPLE_NOTIFICATIONS = [
  {
    id: "1",
    title: "Новая транзакция",
    message: "Транзакция #12345 успешно завершена",
    type: "success",
    isRead: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
    source: "gate"
  },
  {
    id: "2",
    title: "Ошибка авторизации",
    message: "Не удалось авторизоваться в аккаунте Gate.cx #3",
    type: "error",
    isRead: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    source: "gate"
  },
  {
    id: "3",
    title: "Система обновлена",
    message: "Система была обновлена до версии 1.2.0",
    type: "info",
    isRead: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    source: "system"
  },
  {
    id: "4",
    title: "Успешный вход",
    message: "Успешный вход в аккаунт Bybit #2",
    type: "success",
    isRead: true,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    source: "bybit"
  }
];

interface NotificationItemProps {
  notification: {
    id: string;
    title: string;
    message: string;
    type: "success" | "error" | "info" | "warning";
    isRead: boolean;
    timestamp: string;
    source: string;
  };
  onMarkAsRead: (id: string) => void;
  onRemove: (id: string) => void;
}

// Helper to format relative time
const getRelativeTime = (timestamp: string) => {
  const now = new Date();
  const date = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "только что";
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин. назад`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч. назад`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
};

// Icon mapping for notification types
const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "success":
      return <Check className="text-green-500" size={18} />;
    case "error":
      return <X className="text-red-500" size={18} />;
    case "info":
      return <Bell className="text-blue-500" size={18} />;
    case "warning":
      return <Bell className="text-amber-500" size={18} />;
    default:
      return <Bell className="text-muted-foreground" size={18} />;
  }
};

// Source icon/label for notifications
const SourceBadge = ({ source }: { source: string }) => {
  let label = "Система";
  let emoji = "🤖";
  
  switch (source) {
    case "gate":
      label = "Gate.cx";
      emoji = "🌐";
      break;
    case "bybit":
      label = "Bybit";
      emoji = "💹";
      break;
    case "system":
      label = "Система";
      emoji = "🤖";
      break;
  }
  
  return (
    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-foreground/80">
      <span className="mr-1">{emoji}</span>
      {label}
    </div>
  );
};

// Single notification item component
const NotificationItem: React.FC<NotificationItemProps> = ({ 
  notification, 
  onMarkAsRead,
  onRemove
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      className={`p-3 border-b border-primary/5 relative transition-colors ${
        notification.isRead ? "bg-transparent" : "bg-primary/5"
      }`}
    >
      {!notification.isRead && (
        <span className="absolute right-3 top-3 w-2 h-2 rounded-full bg-primary" />
      )}
      
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-full bg-primary/10">
          <NotificationIcon type={notification.type} />
        </div>
        
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h4 className="text-sm font-medium">{notification.title}</h4>
            <span className="text-xs text-muted-foreground">
              {getRelativeTime(notification.timestamp)}
            </span>
          </div>
          
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {notification.message}
          </p>
          
          <div className="mt-2 flex items-center justify-between">
            <SourceBadge source={notification.source} />
            
            <div className="flex items-center gap-1">
              {!notification.isRead && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2"
                  onClick={() => onMarkAsRead(notification.id)}
                >
                  <CheckCheck size={14} />
                </Button>
              )}
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-muted-foreground"
                onClick={() => onRemove(notification.id)}
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main notifications menu component
export const NotificationsMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const [activeTab, setActiveTab] = useState("all");
  
  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !notification.isRead;
    return notification.source === activeTab;
  });
  
  // Count unread notifications
  const unreadCount = notifications.filter(notification => !notification.isRead).length;
  
  // Mark notification as read
  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(notification => 
      notification.id === id 
        ? { ...notification, isRead: true } 
        : notification
    ));
  };
  
  // Remove notification
  const handleRemoveNotification = (id: string) => {
    setNotifications(notifications.filter(notification => notification.id !== id));
  };
  
  // Mark all as read
  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(notification => ({ ...notification, isRead: true })));
  };
  
  // Clear all notifications
  const handleClearAll = () => {
    setNotifications([]);
  };
  
  // Animation variants
  const menuVariants = {
    hidden: { opacity: 0, y: -20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -20, scale: 0.95 }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed right-4 top-16 w-80 sm:w-96 max-h-[75vh] overflow-hidden z-50 rounded-xl border border-primary/10 shadow-lg bg-background/80 backdrop-blur-lg"
          variants={menuVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          <div className="flex items-center justify-between p-4 border-b border-primary/10">
            <div className="flex items-center gap-2">
              <AnimatedText className="text-lg font-medium">
                Уведомления
              </AnimatedText>
              
              {unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                >
                  {unreadCount}
                </motion.div>
              )}
            </div>
            
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X size={16} />
            </Button>
          </div>
          
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <div className="px-4 pt-2 pb-0">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="all">Все</TabsTrigger>
                <TabsTrigger value="unread">Новые</TabsTrigger>
                <TabsTrigger value="system">Система</TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="all" className="m-0">
              <div className="p-2 flex justify-end gap-2 border-b border-primary/5">
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
                  <CheckCheck size={14} className="mr-1" />
                  <span className="text-xs">Прочитать все</span>
                </Button>
                
                <Button variant="ghost" size="sm" onClick={handleClearAll} disabled={notifications.length === 0}>
                  <X size={14} className="mr-1" />
                  <span className="text-xs">Очистить</span>
                </Button>
              </div>
              
              <div className="max-h-[calc(75vh-120px)] overflow-y-auto">
                <AnimatePresence>
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification as any}
                        onMarkAsRead={handleMarkAsRead}
                        onRemove={handleRemoveNotification}
                      />
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6 text-center text-muted-foreground"
                    >
                      <p className="text-3xl mb-2">🔔</p>
                      <p>Нет уведомлений</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
            
            <TabsContent value="unread" className="m-0">
              <div className="max-h-[calc(75vh-80px)] overflow-y-auto">
                <AnimatePresence>
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification as any}
                        onMarkAsRead={handleMarkAsRead}
                        onRemove={handleRemoveNotification}
                      />
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6 text-center text-muted-foreground"
                    >
                      <p className="text-3xl mb-2">✅</p>
                      <p>Нет непрочитанных уведомлений</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
            
            <TabsContent value="system" className="m-0">
              <div className="max-h-[calc(75vh-80px)] overflow-y-auto">
                <AnimatePresence>
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification as any}
                        onMarkAsRead={handleMarkAsRead}
                        onRemove={handleRemoveNotification}
                      />
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="p-6 text-center text-muted-foreground"
                    >
                      <p className="text-3xl mb-2">🤖</p>
                      <p>Нет системных уведомлений</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Export notification bell component
export const NotificationBell: React.FC<{
  onClick: () => void;
  count?: number;
}> = ({ onClick, count = 0 }) => {
  return (
    <button
      className="relative p-2 rounded-full hover:bg-primary/10 transition-colors"
      onClick={onClick}
      aria-label="Notifications"
    >
      <Bell size={20} />
      
      {count > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-1.5"
        >
          {count <= 9 ? count : "9+"}
        </motion.div>
      )}
    </button>
  );
};

export default NotificationsMenu;