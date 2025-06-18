import { Orchestrator } from '../orchestrator';

// Define shared context type
interface AppContext {
  apiKey: string;
  counter: number;
  lastUpdate: Date;
}

async function example() {
  // Create orchestrator with initial context
  const orchestrator = new Orchestrator<AppContext>({
    name: 'MyApp',
    context: {
      apiKey: 'secret-key',
      counter: 0,
      lastUpdate: new Date()
    },
    statePersistPath: './orchestrator-state.json',
    maxConcurrentTasks: 3
  });

  // Initialize to restore previous state if exists
  await orchestrator.initialize();

  // Add a task that runs every 5 seconds
  orchestrator.addInterval('counter', async (context) => {
    context.shared.counter++;
    console.log(`Counter: ${context.shared.counter}`);
    return context.shared.counter;
  }, 5000);

  // Add a task that runs only at start
  orchestrator.addOneTime('startup', async (context) => {
    console.log('Application started!');
    console.log('API Key:', context.shared.apiKey);
  });

  // Add a conditional task that runs when counter reaches 10
  orchestrator.addConditional(
    'milestone',
    async (context) => {
      console.log('Counter reached 10! 🎉');
      context.shared.lastUpdate = new Date();
    },
    (context) => context.shared.counter >= 10,
    1000 // Check every second
  );

  // Add async tasks that run concurrently
  orchestrator.addInterval('task1', async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Task 1 completed');
  }, 10000);

  orchestrator.addInterval('task2', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Task 2 completed');
  }, 8000);

  // Add a cron task (runs every minute)
  orchestrator.addCron('report', async (context) => {
    console.log(`Report: Counter is ${context.shared.counter} at ${new Date().toISOString()}`);
  }, '* * * * *');

  // Listen to events
  orchestrator.on('taskCompleted', (task, result) => {
    console.log(`Task ${task.name || task.id} completed with result:`, result);
  });

  orchestrator.on('taskError', (task, error) => {
    console.error(`Task ${task.name || task.id} failed:`, error.message);
  });

  // Start the orchestrator
  await orchestrator.start();

  // Simulate pause after 20 seconds
  setTimeout(async () => {
    console.log('Pausing orchestrator...');
    await orchestrator.pause();
    
    // Update context while paused
    orchestrator.updateContext({ counter: 100 });
    
    // Resume after 5 seconds
    setTimeout(async () => {
      console.log('Resuming orchestrator...');
      await orchestrator.start();
    }, 5000);
  }, 20000);

  // Graceful shutdown on exit
  process.on('SIGINT', async () => {
    console.log('\\nStopping orchestrator...');
    await orchestrator.stop();
    process.exit(0);
  });
}

// Run example
example().catch(console.error);