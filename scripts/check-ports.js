#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PORTS = [3000, 3001];

async function checkAndKillPort(port) {
  try {
    console.log(`🔍 Checking port ${port}...`);
    
    // Check if port is in use
    const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || echo ""`);
    
    if (stdout.trim()) {
      const pids = stdout.trim().split('\n').filter(Boolean);
      console.log(`⚠️  Port ${port} is in use by PID(s): ${pids.join(', ')}`);
      
      // Kill processes using the port
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`);
          console.log(`✅ Killed process ${pid} on port ${port}`);
        } catch (error) {
          console.log(`⚠️  Could not kill process ${pid}: ${error.message}`);
        }
      }
      
      // Wait a moment for ports to be freed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } else {
      console.log(`✅ Port ${port} is available`);
    }
  } catch (error) {
    console.log(`⚠️  Error checking port ${port}: ${error.message}`);
  }
}

async function checkAllPorts() {
  console.log('🚀 Checking and cleaning up ports...\n');
  
  for (const port of PORTS) {
    await checkAndKillPort(port);
  }
  
  console.log('\n✨ Port cleanup complete!\n');
}

// Run if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  checkAllPorts().catch(console.error);
}

export { checkAndKillPort, checkAllPorts };