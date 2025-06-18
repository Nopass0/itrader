"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart4, RefreshCw, CalendarRange, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedText } from "@/components/ui/particles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Sample placeholder for statistics page
export default function StatsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("week");
  
  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-semibold mb-2 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <AnimatedText>Статистика</AnimatedText>
        </h1>
        <p className="text-muted-foreground">
          Аналитика и отчеты по всем аккаунтам
        </p>
      </motion.div>
      
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="gate">Gate.cx</TabsTrigger>
          <TabsTrigger value="bybit">Bybit</TabsTrigger>
          <TabsTrigger value="accounts">По аккаунтам</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Выберите период" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="quarter">Квартал</SelectItem>
              <SelectItem value="year">Год</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" className="gap-1">
            <CalendarRange size={16} />
            Указать даты
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-1">
            <Download size={16} />
            Экспорт
          </Button>
          
          <Button variant="ghost" className="gap-1">
            <RefreshCw size={16} />
            Обновить
          </Button>
        </div>
      </div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="glass shadow-sm border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <BarChart4 size={18} className="mr-2" />
              Заглушка страницы статистики
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="p-8 flex flex-col items-center justify-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-medium mb-2">Здесь будет отображаться статистика</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Эта страница находится в разработке. В будущем здесь будут отображаться 
                графики, диаграммы и аналитические данные по всем платформам и аккаунтам.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl mt-4">
                {['Количество транзакций', 'Объемы', 'Балансы', 'Прибыль'].map((stat, index) => (
                  <Card key={index} className="text-center p-4 shadow-sm">
                    <div className="font-medium">{stat}</div>
                    <div className="text-2xl font-bold mt-1">--</div>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}