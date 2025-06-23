"use client";

import { useState } from "react";
import { RefreshCw, Info, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMailSlurpAccounts } from "@/hooks/useMailSlurpAccounts";

interface MailSlurpAccountFormProps {
  onSuccess: () => void;
}

export function MailSlurpAccountForm({ onSuccess }: MailSlurpAccountFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { syncInboxes } = useMailSlurpAccounts();

  const handleSync = async () => {
    setIsLoading(true);
    const success = await syncInboxes();
    setIsLoading(false);

    if (success) {
      onSuccess();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="mb-2">
              Нажмите кнопку ниже, чтобы автоматически синхронизировать все доступные MailSlurp inbox'ы из вашего API аккаунта.
            </p>
            <p className="text-xs">
              Убедитесь, что переменная окружения MAILSLURP_API_KEY настроена корректно.
            </p>
          </div>
        </div>
      </div>

      <Button 
        onClick={handleSync} 
        disabled={isLoading} 
        className="w-full"
        size="lg"
      >
        {isLoading ? (
          <RefreshCw size={16} className="mr-2 animate-spin" />
        ) : (
          <Download size={16} className="mr-2" />
        )}
        {isLoading ? "Синхронизация..." : "Синхронизировать MailSlurp аккаунты"}
      </Button>
    </div>
  );
}