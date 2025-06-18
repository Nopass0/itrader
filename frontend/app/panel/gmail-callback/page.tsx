"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { socketApi } from "@/services/socket-api";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function GmailCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      // Проверяем наличие ошибки от Google
      if (error) {
        setStatus("error");
        setErrorMessage(error === "access_denied" ? "Доступ был отклонен" : "Ошибка авторизации");
        toast({
          title: "Ошибка авторизации",
          description: "Не удалось получить доступ к Gmail",
          variant: "destructive",
        });
        setTimeout(() => router.push("/panel/accounts"), 3000);
        return;
      }

      // Проверяем наличие кода
      if (!code || !state) {
        setStatus("error");
        setErrorMessage("Отсутствуют необходимые параметры");
        toast({
          title: "Ошибка",
          description: "Некорректный ответ от Google",
          variant: "destructive",
        });
        setTimeout(() => router.push("/panel/accounts"), 3000);
        return;
      }

      // Проверяем state
      const savedState = localStorage.getItem("gmail_oauth_state");
      if (!savedState || savedState !== state) {
        setStatus("error");
        setErrorMessage("Неверный state. Возможна попытка атаки CSRF.");
        toast({
          title: "Ошибка безопасности",
          description: "Неверный state параметр",
          variant: "destructive",
        });
        setTimeout(() => router.push("/panel/accounts"), 3000);
        return;
      }

      // Очищаем сохраненный state
      localStorage.removeItem("gmail_oauth_state");

      try {
        // Завершаем OAuth процесс
        const response = await socketApi.emit("accounts:completeGmailOAuth", {
          code,
          state,
        });

        if (response.success) {
          setStatus("success");
          toast({
            title: "Успешно!",
            description: `Gmail аккаунт ${response.data.email} успешно добавлен`,
          });
          
          // Перенаправляем на страницу аккаунтов
          setTimeout(() => {
            router.push(response.data.returnUrl || "/panel/accounts");
          }, 2000);
        } else {
          throw new Error(response.error?.message || "Неизвестная ошибка");
        }
      } catch (error: any) {
        setStatus("error");
        setErrorMessage(error.message || "Не удалось завершить авторизацию");
        toast({
          title: "Ошибка",
          description: error.message || "Не удалось добавить Gmail аккаунт",
          variant: "destructive",
        });
        setTimeout(() => router.push("/panel/accounts"), 3000);
      }
    };

    handleCallback();
  }, [searchParams, router, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === "processing" && "Обработка авторизации"}
            {status === "success" && "Успешно!"}
            {status === "error" && "Ошибка"}
          </CardTitle>
          <CardDescription className="text-center">
            {status === "processing" && "Пожалуйста, подождите..."}
            {status === "success" && "Gmail аккаунт успешно добавлен"}
            {status === "error" && errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {status === "processing" && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === "success" && (
            <CheckCircle className="h-12 w-12 text-green-500" />
          )}
          {status === "error" && (
            <XCircle className="h-12 w-12 text-red-500" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}