import { Orchestrator, type TaskConfig } from "../";

interface TradingContext {
  balance: number;
  positions: Map<string, number>;
  marketData: Map<string, number>;
  isMarketOpen: boolean;
}

async function advancedExample() {
  const orchestrator = new Orchestrator<TradingContext>({
    name: "TradingBot",
    context: {
      balance: 10000,
      positions: new Map(),
      marketData: new Map(),
      isMarketOpen: true,
    },
    statePersistPath: "./trading-state.json",
    maxConcurrentTasks: 5,
    defaultTimeout: 30000,
    errorHandler: (error, task) => {
      console.error(`Critical error in ${task.id}:`, error);
      // Could send alerts, log to monitoring system, etc.
    },
  });

  // Market data fetcher with retry
  orchestrator.addTask({
    id: "market-data",
    name: "Market Data Fetcher",
    fn: async (context) => {
      // Simulate API call
      const prices = {
        BTC: Math.random() * 50000 + 30000,
        ETH: Math.random() * 3000 + 2000,
        SOL: Math.random() * 100 + 50,
      };

      for (const [symbol, price] of Object.entries(prices)) {
        context.shared.marketData.set(symbol, price);
      }

      return prices;
    },
    interval: 2000,
    priority: 10,
    maxRetries: 3,
    retryDelay: 1000,
    condition: (context) => context.shared.isMarketOpen,
  });

  // Trading strategy
  orchestrator.addTask({
    id: "trading-strategy",
    name: "Simple Trading Strategy",
    fn: async (context) => {
      const btcPrice = context.shared.marketData.get("BTC") || 0;
      const currentPosition = context.shared.positions.get("BTC") || 0;

      // Simple strategy: buy if price < 35000, sell if > 45000
      if (btcPrice < 35000 && context.shared.balance > btcPrice) {
        const amount = 0.1;
        context.shared.balance -= btcPrice * amount;
        context.shared.positions.set("BTC", currentPosition + amount);
        console.log(`Bought ${amount} BTC at ${btcPrice}`);
        return { action: "buy", symbol: "BTC", amount, price: btcPrice };
      } else if (btcPrice > 45000 && currentPosition > 0) {
        const amount = Math.min(0.1, currentPosition);
        context.shared.balance += btcPrice * amount;
        context.shared.positions.set("BTC", currentPosition - amount);
        console.log(`Sold ${amount} BTC at ${btcPrice}`);
        return { action: "sell", symbol: "BTC", amount, price: btcPrice };
      }

      return { action: "hold" };
    },
    interval: 5000,
    priority: 5,
    condition: (context) =>
      context.shared.isMarketOpen && context.shared.marketData.size > 0,
  });

  // Portfolio reporter
  orchestrator.addCron(
    "portfolio-report",
    async (context) => {
      let totalValue = context.shared.balance;

      console.log("\\n=== Portfolio Report ===");
      console.log(`Cash Balance: $${context.shared.balance.toFixed(2)}`);

      for (const [symbol, amount] of context.shared.positions) {
        const price = context.shared.marketData.get(symbol) || 0;
        const value = price * amount;
        totalValue += value;
        console.log(
          `${symbol}: ${amount} units @ $${price.toFixed(2)} = $${value.toFixed(2)}`,
        );
      }

      console.log(`Total Portfolio Value: $${totalValue.toFixed(2)}`);
      console.log("=======================\\n");

      return {
        totalValue,
        positions: Object.fromEntries(context.shared.positions),
      };
    },
    "*/30 * * * * *",
  ); // Every 30 seconds

  // Market hours checker
  orchestrator.addInterval(
    "market-hours",
    async (context) => {
      const hour = new Date().getHours();
      const isOpen = hour >= 9 && hour < 17; // 9 AM to 5 PM

      if (context.shared.isMarketOpen !== isOpen) {
        context.shared.isMarketOpen = isOpen;
        console.log(`Market is now ${isOpen ? "OPEN" : "CLOSED"}`);
      }
    },
    60000,
  ); // Check every minute

  // Risk monitor
  orchestrator.addTask({
    id: "risk-monitor",
    name: "Risk Monitor",
    fn: async (context) => {
      const totalPositionValue = Array.from(
        context.shared.positions.entries(),
      ).reduce((sum, [symbol, amount]) => {
        const price = context.shared.marketData.get(symbol) || 0;
        return sum + price * amount;
      }, 0);

      const totalValue = context.shared.balance + totalPositionValue;
      const exposureRatio = totalPositionValue / totalValue;

      if (exposureRatio > 0.8) {
        console.warn(
          `⚠️  High exposure warning: ${(exposureRatio * 100).toFixed(1)}% of portfolio in positions`,
        );
        return { warning: "high_exposure", ratio: exposureRatio };
      }

      return { status: "ok", ratio: exposureRatio };
    },
    interval: 10000,
    priority: 8,
    runOnStart: true,
  });

  // Emergency stop
  orchestrator.addTask({
    id: "emergency-stop",
    name: "Emergency Stop",
    fn: async (context) => {
      // Close all positions
      for (const [symbol, amount] of context.shared.positions) {
        const price = context.shared.marketData.get(symbol) || 0;
        context.shared.balance += price * amount;
        console.log(`🚨 Emergency sale: ${amount} ${symbol} at ${price}`);
      }
      context.shared.positions.clear();

      // Pause trading
      orchestrator.pauseTask("trading-strategy");

      return { action: "emergency_stop", finalBalance: context.shared.balance };
    },
    condition: (context) => context.shared.balance < 1000, // Trigger if balance drops below $1000
    interval: 5000,
    priority: 100, // Highest priority
  });

  // Set up event listeners
  orchestrator.on("taskQueued", (task) => {
    console.log(`Task ${task.name} queued (too many concurrent tasks)`);
  });

  orchestrator.on("stateRestored", (state) => {
    console.log("Previous state restored:", {
      wasPaused: state.isPaused,
      startTime: state.startTime,
      tasksCount: state.tasks?.length,
    });
  });

  // Start orchestrator
  await orchestrator.initialize();
  await orchestrator.start();

  console.log("Trading bot started. Press Ctrl+C to stop.");
  console.log("Commands:");
  console.log("  p - Pause/Resume");
  console.log("  s - Show status");
  console.log("  q - Quit");

  // Handle user input
  process.stdin.setRawMode(true);
  process.stdin.on("data", async (data) => {
    const key = data.toString();

    switch (key) {
      case "p":
        if (orchestrator.getState().isPaused) {
          await orchestrator.start();
          console.log("Resumed");
        } else {
          await orchestrator.pause();
          console.log("Paused");
        }
        break;

      case "s":
        const state = orchestrator.getState();
        console.log("\\nOrchestrator Status:");
        console.log(`  Name: ${state.name}`);
        console.log(`  Status: ${state.isPaused ? "Paused" : "Running"}`);
        console.log(`  Tasks: ${state.tasks.length}`);
        console.log(`  Context:`, state.context);
        break;

      case "q":
      case "\\x03": // Ctrl+C
        console.log("\\nShutting down...");
        await orchestrator.stop();
        process.exit(0);
    }
  });
}

advancedExample().catch(console.error);
