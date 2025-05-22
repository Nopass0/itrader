"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  RefreshCw, 
  Calendar, 
  ArrowDownUp, 
  Search, 
  Filter,
  Check,
  Clock,
  AlertCircle,
  ExternalLink,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnimatedText } from "@/components/ui/particles";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Sample transaction data for Gate.cx
const SAMPLE_GATE_TRANSACTIONS = [
  {
    id: "gate-tx-1",
    type: "spot",
    pair: "BTC/USDT",
    amount: 0.12,
    price: 60250.45,
    total: 7230.05,
    status: "completed",
    side: "buy",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    accountName: "Gate.cx #1",
    fee: 3.62,
    feeAsset: "USDT",
    orderId: "g-12345abcde"
  },
  {
    id: "gate-tx-2",
    type: "spot",
    pair: "ETH/USDT",
    amount: 1.5,
    price: 3120.75,
    total: 4681.13,
    status: "completed",
    side: "sell",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    accountName: "Gate.cx #1",
    fee: 2.34,
    feeAsset: "USDT",
    orderId: "g-67890fghij"
  },
  {
    id: "gate-tx-3",
    type: "withdrawal",
    asset: "BTC",
    amount: 0.05,
    network: "BTC",
    address: "3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5",
    status: "pending",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
    accountName: "Gate.cx #2",
    fee: 0.0001,
    feeAsset: "BTC",
    txid: "0x5ba0e4d7a1abcdefg12345"
  }
];

// Sample transaction data for Bybit
const SAMPLE_BYBIT_TRANSACTIONS = [
  {
    id: "bybit-tx-1",
    type: "futures",
    pair: "BTC/USDT",
    amount: 0.5,
    price: 60180.25,
    total: 30090.13,
    status: "completed",
    side: "buy",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    accountName: "Bybit #1",
    leverage: "10x",
    pnl: "+240.36",
    orderId: "b-abcde12345"
  },
  {
    id: "bybit-tx-2",
    type: "futures",
    pair: "ETH/USDT",
    amount: 2.0,
    price: 3105.50,
    total: 6211.00,
    status: "error",
    side: "sell",
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    accountName: "Bybit #1",
    leverage: "5x",
    pnl: "-120.55",
    orderId: "b-fghij67890"
  },
  {
    id: "bybit-tx-3",
    type: "deposit",
    asset: "USDT",
    amount: 5000,
    network: "TRC20",
    address: "TJCBZhkRYDLfXKVEU5RrqngmkZpYSaFuDc",
    status: "completed",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    accountName: "Bybit #2",
    txid: "0x5fab34e6c8abcdefg67890"
  }
];

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

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  let color = "";
  let text = "";
  let icon = null;
  
  switch (status) {
    case "completed":
      color = "text-green-500 bg-green-500/10 border-green-500/20";
      text = "Выполнено";
      icon = <Check size={14} className="mr-1" />;
      break;
    case "pending":
      color = "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
      text = "В обработке";
      icon = <Clock size={14} className="mr-1" />;
      break;
    case "error":
      color = "text-red-500 bg-red-500/10 border-red-500/20";
      text = "Ошибка";
      icon = <AlertCircle size={14} className="mr-1" />;
      break;
    default:
      color = "text-muted-foreground bg-muted/50";
      text = "Неизвестно";
  }
  
  return (
    <Badge variant="outline" className={`${color} flex items-center`}>
      {icon}
      {text}
    </Badge>
  );
};

// Transaction type badge
const TypeBadge = ({ type }: { type: string }) => {
  let color = "";
  let text = "";
  
  switch (type) {
    case "spot":
      color = "text-blue-500 bg-blue-500/10 border-blue-500/20";
      text = "Спот";
      break;
    case "futures":
      color = "text-purple-500 bg-purple-500/10 border-purple-500/20";
      text = "Фьючерсы";
      break;
    case "withdrawal":
      color = "text-orange-500 bg-orange-500/10 border-orange-500/20";
      text = "Вывод";
      break;
    case "deposit":
      color = "text-green-500 bg-green-500/10 border-green-500/20";
      text = "Депозит";
      break;
    default:
      color = "text-muted-foreground bg-muted/50";
      text = type;
  }
  
  return (
    <Badge variant="outline" className={`${color}`}>
      {text}
    </Badge>
  );
};

// Side badge (buy/sell)
const SideBadge = ({ side }: { side: string }) => {
  if (!side) return null;
  
  const color = side === "buy" 
    ? "text-green-500 bg-green-500/10 border-green-500/20" 
    : "text-red-500 bg-red-500/10 border-red-500/20";
  
  const text = side === "buy" ? "Покупка" : "Продажа";
  
  return (
    <Badge variant="outline" className={`${color}`}>
      {text}
    </Badge>
  );
};

// Transaction card component
const TransactionCard = ({ transaction }: { transaction: any }) => {
  const isTrading = transaction.type === "spot" || transaction.type === "futures";
  const isTransfer = transaction.type === "withdrawal" || transaction.type === "deposit";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      layout
    >
      <Card glass hover className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">
                  {isTrading ? (
                    <>
                      <AnimatedText>{transaction.pair}</AnimatedText>
                    </>
                  ) : (
                    <>
                      <AnimatedText>{transaction.asset}</AnimatedText>
                    </>
                  )}
                </CardTitle>
                <TypeBadge type={transaction.type} />
                {isTrading && <SideBadge side={transaction.side} />}
              </div>
              <CardDescription className="mt-1">
                {transaction.accountName}
              </CardDescription>
            </div>
            <StatusBadge status={transaction.status} />
          </div>
        </CardHeader>
        
        <CardContent className="pb-2">
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
            {isTrading && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Количество:</span>
                  <span className="font-medium">{transaction.amount}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Цена:</span>
                  <span className="font-medium">${transaction.price.toLocaleString('ru-RU')}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Сумма:</span>
                  <span className="font-medium">${transaction.total.toLocaleString('ru-RU')}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Комиссия:</span>
                  <span className="font-medium">{transaction.fee} {transaction.feeAsset || ""}</span>
                </div>
                
                {transaction.leverage && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Плечо:</span>
                    <span className="font-medium">{transaction.leverage}</span>
                  </div>
                )}
                
                {transaction.pnl && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PnL:</span>
                    <span className={`font-medium ${transaction.pnl.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                      {transaction.pnl} USDT
                    </span>
                  </div>
                )}
              </>
            )}
            
            {isTransfer && (
              <>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Количество:</span>
                  <span className="font-medium">{transaction.amount} {transaction.asset}</span>
                </div>
                
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Сеть:</span>
                  <span className="font-medium">{transaction.network}</span>
                </div>
                
                <div className="flex justify-between col-span-2 overflow-hidden">
                  <span className="text-muted-foreground">Адрес:</span>
                  <span className="font-medium truncate ml-2" style={{ maxWidth: "180px" }}>{transaction.address}</span>
                </div>
                
                {transaction.fee && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground">Комиссия:</span>
                    <span className="font-medium">{transaction.fee} {transaction.feeAsset}</span>
                  </div>
                )}
              </>
            )}
            
            <div className={`flex justify-between ${isTrading ? "col-span-2" : ""}`}>
              <span className="text-muted-foreground">Время:</span>
              <span className="font-medium">{getRelativeTime(transaction.timestamp)}</span>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="pt-2 flex gap-2 justify-between">
          <div className="text-xs text-muted-foreground overflow-hidden">
            ID: <span className="font-mono truncate">{transaction.orderId || transaction.txid}</span>
          </div>
          
          <div className="flex gap-2">
            <Button size="sm" variant="ghost">
              <Info size={14} />
            </Button>
            
            <Button size="sm" variant="ghost">
              <ExternalLink size={14} />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

// Main transactions page component
export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  
  // Combine all transactions
  const allTransactions = [...SAMPLE_GATE_TRANSACTIONS, ...SAMPLE_BYBIT_TRANSACTIONS]
    .sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  
  // Filter by platform
  const gateTransactions = SAMPLE_GATE_TRANSACTIONS.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });
  
  const bybitTransactions = SAMPLE_BYBIT_TRANSACTIONS.sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
  });
  
  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === "newest" ? "oldest" : "newest");
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-semibold mb-2 flex items-center gap-2">
          <span className="text-2xl">💳</span>
          <AnimatedText>Транзакции</AnimatedText>
        </h1>
        <p className="text-muted-foreground">
          История торговых и финансовых операций
        </p>
      </motion.div>
      
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Поиск по транзакциям..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Button variant="outline" className="gap-1.5" onClick={toggleSortOrder}>
          <ArrowDownUp size={16} />
          {sortOrder === "newest" ? "Сначала новые" : "Сначала старые"}
        </Button>
        
        <Button variant="outline" className="gap-1.5">
          <Calendar size={16} />
          Дата
        </Button>
        
        <Button variant="outline" className="gap-1.5">
          <Filter size={16} />
          Фильтры
        </Button>
        
        <Button variant="ghost" className="gap-1.5">
          <RefreshCw size={16} />
          Обновить
        </Button>
      </div>
      
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="mb-6">
          <TabsTrigger value="all" className="flex items-center gap-1.5">
            <span>Все</span>
            <Badge className="ml-1" variant="outline">{allTransactions.length}</Badge>
          </TabsTrigger>
          
          <TabsTrigger value="gate" className="flex items-center gap-1.5">
            <span className="text-lg">🌐</span>
            <span>Gate.cx</span>
            <Badge className="ml-1" variant="outline">{gateTransactions.length}</Badge>
          </TabsTrigger>
          
          <TabsTrigger value="bybit" className="flex items-center gap-1.5">
            <span className="text-lg">💹</span>
            <span>Bybit</span>
            <Badge className="ml-1" variant="outline">{bybitTransactions.length}</Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4 mt-2">
          <AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allTransactions.map(transaction => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </AnimatePresence>
        </TabsContent>
        
        <TabsContent value="gate" className="space-y-4 mt-2">
          <AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {gateTransactions.map(transaction => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </AnimatePresence>
        </TabsContent>
        
        <TabsContent value="bybit" className="space-y-4 mt-2">
          <AnimatePresence>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bybitTransactions.map(transaction => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </AnimatePresence>
        </TabsContent>
      </Tabs>
    </div>
  );
}