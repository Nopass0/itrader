"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PlusCircle, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { socketApi } from "@/services/socket-api";

// Form schemas
const gateAccountSchema = z.object({
  email: z.string().email({ message: "Введите корректный email" }),
  password: z.string().min(1, { message: "Пароль обязателен" }),
});

const bybitAccountSchema = z.object({
  apiKey: z.string().min(1, { message: "API ключ обязателен" }),
  apiSecret: z.string().min(1, { message: "API секрет обязателен" }),
});

type GateAccountFormValues = z.infer<typeof gateAccountSchema>;
type BybitAccountFormValues = z.infer<typeof bybitAccountSchema>;

interface AddAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountAdded: () => void;
}

export const AddAccountDialog: React.FC<AddAccountDialogProps> = ({
  isOpen,
  onClose,
  onAccountAdded,
}) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("gate");

  // Gate form
  const gateForm = useForm<GateAccountFormValues>({
    resolver: zodResolver(gateAccountSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Bybit form
  const bybitForm = useForm<BybitAccountFormValues>({
    resolver: zodResolver(bybitAccountSchema),
    defaultValues: {
      apiKey: "",
      apiSecret: "",
    },
  });

  const onGateSubmit = async (data: GateAccountFormValues) => {
    setIsLoading(true);
    try {
      const response = await socketApi.accounts.createGateAccount({
        email: data.email,
        password: data.password,
        apiKey: '', // Will be generated on backend
        apiSecret: '' // Will be generated on backend
      });
      
      if (response.success) {
        toast({
          title: "Аккаунт Gate.cx добавлен",
          description: "Аккаунт находится в процессе инициализации",
          variant: "success",
        });
        gateForm.reset();
        onAccountAdded();
        onClose();
      } else {
        toast({
          title: "Ошибка добавления аккаунта",
          description: response.error?.message || "Не удалось добавить аккаунт",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка добавления аккаунта",
        description: error.message || "Произошла ошибка при добавлении аккаунта",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onBybitSubmit = async (data: BybitAccountFormValues) => {
    setIsLoading(true);
    try {
      const response = await socketApi.accounts.createBybitAccount({
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        accountName: '' // Optional
      });
      
      if (response.success) {
        toast({
          title: "Аккаунт Bybit добавлен",
          description: "Аккаунт находится в процессе инициализации",
          variant: "success",
        });
        bybitForm.reset();
        onAccountAdded();
        onClose();
      } else {
        toast({
          title: "Ошибка добавления аккаунта",
          description: response.error?.message || "Не удалось добавить аккаунт",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Ошибка добавления аккаунта",
        description: error.message || "Произошла ошибка при добавлении аккаунта",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md"
      >
        <Card className="glassmorphism">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle size={20} />
                Добавить аккаунт
              </CardTitle>
              <CardDescription>
                Добавьте новый торговый аккаунт
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X size={16} />
            </Button>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="gate">Gate.cx</TabsTrigger>
                <TabsTrigger value="bybit">Bybit</TabsTrigger>
              </TabsList>
              
              <TabsContent value="gate" className="space-y-4 mt-4">
                <form onSubmit={gateForm.handleSubmit(onGateSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="gate-email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="gate-email"
                      type="email"
                      placeholder="Введите email от Gate.cx"
                      {...gateForm.register('email')}
                      className="glass-input"
                    />
                    {gateForm.formState.errors.email && (
                      <p className="text-destructive text-xs">
                        {gateForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="gate-password" className="text-sm font-medium">
                      Пароль
                    </label>
                    <Input
                      id="gate-password"
                      type="password"
                      placeholder="Введите пароль от Gate.cx"
                      {...gateForm.register('password')}
                      className="glass-input"
                    />
                    {gateForm.formState.errors.password && (
                      <p className="text-destructive text-xs">
                        {gateForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Добавление..." : "Добавить аккаунт Gate.cx"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="bybit" className="space-y-4 mt-4">
                <form onSubmit={bybitForm.handleSubmit(onBybitSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="bybit-apikey" className="text-sm font-medium">
                      API Key
                    </label>
                    <Input
                      id="bybit-apikey"
                      type="text"
                      placeholder="Введите API ключ от Bybit"
                      {...bybitForm.register('apiKey')}
                      className="glass-input"
                    />
                    {bybitForm.formState.errors.apiKey && (
                      <p className="text-destructive text-xs">
                        {bybitForm.formState.errors.apiKey.message}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="bybit-apisecret" className="text-sm font-medium">
                      API Secret
                    </label>
                    <Input
                      id="bybit-apisecret"
                      type="password"
                      placeholder="Введите API секрет от Bybit"
                      {...bybitForm.register('apiSecret')}
                      className="glass-input"
                    />
                    {bybitForm.formState.errors.apiSecret && (
                      <p className="text-destructive text-xs">
                        {bybitForm.formState.errors.apiSecret.message}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Добавление..." : "Добавить аккаунт Bybit"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};