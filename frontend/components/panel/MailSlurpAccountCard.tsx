"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { 
  Mail,
  Check,
  Trash,
  Copy,
  Eye,
  EyeOff,
  Clock,
  Star,
  StarOff
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

interface MailSlurpAccountCardProps {
  account: {
    id: string;
    email: string;
    inboxId: string;
    isActive: boolean;
    createdAt: string;
    lastUsed?: string;
  };
  onDelete: (id: string) => Promise<boolean>;
  onSetActive: (id: string) => Promise<boolean>;
}

export function MailSlurpAccountCard({ account, onDelete, onSetActive }: MailSlurpAccountCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState<'email' | 'inbox' | null>(null);
  const { toast } = useToast();

  const handleCopy = (text: string, type: 'email' | 'inbox') => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    toast({
      title: "Скопировано",
      description: `${type === 'email' ? 'Email' : 'Inbox ID'} скопирован в буфер обмена`,
    });
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async () => {
    if (confirm(`Удалить аккаунт ${account.email}?`)) {
      await onDelete(account.id);
    }
  };

  const handleSetActive = async () => {
    await onSetActive(account.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="glassmorphism hover:shadow-lg transition-all duration-300 border-0 shadow-xl hover:shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 backdrop-blur-sm">
                <Mail size={24} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  MailSlurp
                  {account.isActive && (
                    <Badge variant="default" className="text-xs">
                      <Star size={12} className="mr-1" />
                      Активный
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-1">
                  Временная почта для получения чеков
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Email */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Email адрес</div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm flex-1 truncate">
                {showDetails ? account.email : account.email.replace(/(.{3}).*(@.*)/, "$1***$2")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleCopy(account.email, 'email')}
              >
                {copied === 'email' ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>

          {/* Inbox ID */}
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Inbox ID</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs flex-1 truncate">
                {showDetails ? account.inboxId : account.inboxId.substring(0, 8) + '...'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => handleCopy(account.inboxId, 'inbox')}
              >
                {copied === 'inbox' ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>

          {/* Status info */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground">Создан</div>
              <div>{new Date(account.createdAt).toLocaleDateString('ru-RU')}</div>
            </div>
            {account.lastUsed && (
              <div className="space-y-1">
                <div className="text-muted-foreground">Использован</div>
                <div>{new Date(account.lastUsed).toLocaleDateString('ru-RU')}</div>
              </div>
            )}
          </div>

          {/* Active status message */}
          {account.isActive && (
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check size={12} />
                Этот аккаунт используется для получения чеков
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between pt-3 pb-3 border-t border-border/50">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock size={12} />
            {account.lastUsed 
              ? `Использован: ${new Date(account.lastUsed).toLocaleTimeString('ru-RU')}`
              : 'Не использовался'
            }
          </div>
          <div className="flex gap-1">
            {!account.isActive && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSetActive}
                className="text-xs"
              >
                <Star size={12} className="mr-1" />
                Сделать активным
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
              disabled={account.isActive}
              title={account.isActive ? "Нельзя удалить активный аккаунт" : "Удалить аккаунт"}
            >
              <Trash size={14} />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}