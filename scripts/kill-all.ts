#!/usr/bin/env bun

import { execSync } from 'child_process';
import { createLogger } from '../src/webserver/utils/logger';

const logger = createLogger('KillScript');

interface ProcessInfo {
  pid: string;
  name: string;
  port?: string;
}

function executeCommand(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8' }).toString().trim();
  } catch (error) {
    return '';
  }
}

function getProcessesByName(names: string[]): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  
  for (const name of names) {
    try {
      // Use ps command to find processes
      const psOutput = executeCommand(`ps aux | grep -E "${name}" | grep -v grep | grep -v kill-all`);
      
      if (psOutput) {
        const lines = psOutput.split('\n').filter(line => line.trim());
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const pid = parts[1];
            // Skip if it's our own process
            if (pid !== process.pid.toString()) {
              processes.push({ pid, name });
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors for processes that don't exist
    }
  }
  
  return processes;
}

function getProcessesByPort(ports: number[]): ProcessInfo[] {
  const processes: ProcessInfo[] = [];
  
  for (const port of ports) {
    try {
      // Use lsof to find processes using the port
      const lsofOutput = executeCommand(`lsof -ti:${port}`);
      
      if (lsofOutput) {
        const pids = lsofOutput.split('\n').filter(pid => pid.trim());
        for (const pid of pids) {
          processes.push({ pid: pid.trim(), name: 'unknown', port: port.toString() });
        }
      }
    } catch (error) {
      // Port might not be in use
    }
  }
  
  return processes;
}

function killProcess(pid: string): boolean {
  try {
    // First try SIGTERM
    process.kill(parseInt(pid), 'SIGTERM');
    
    // Give it a moment to shut down gracefully
    const startTime = Date.now();
    while (Date.now() - startTime < 1000) {
      try {
        // Check if process still exists
        process.kill(parseInt(pid), 0);
      } catch {
        // Process no longer exists
        return true;
      }
    }
    
    // If still running, use SIGKILL
    process.kill(parseInt(pid), 'SIGKILL');
    return true;
  } catch (error: any) {
    if (error.code === 'ESRCH') {
      // Process doesn't exist
      return true;
    }
    return false;
  }
}

async function main() {
  console.log('🔪 Starting process cleanup...\n');
  
  // Process names to kill
  const targetProcesses = ['bun', 'node', 'npm', 'npx', 'next', 'tsx', 'ts-node'];
  
  // Ports to check
  const targetPorts = [3000, 3001, 3002];
  
  // Get processes by name
  console.log('📋 Finding processes by name...');
  const processesByName = getProcessesByName(targetProcesses);
  
  // Get processes by port
  console.log('🔌 Finding processes by port...');
  const processesByPort = getProcessesByPort(targetPorts);
  
  // Combine and deduplicate
  const allProcesses = new Map<string, ProcessInfo>();
  
  for (const proc of processesByName) {
    allProcesses.set(proc.pid, proc);
  }
  
  for (const proc of processesByPort) {
    if (!allProcesses.has(proc.pid)) {
      allProcesses.set(proc.pid, proc);
    } else {
      // Update with port info if we have it
      const existing = allProcesses.get(proc.pid)!;
      existing.port = proc.port;
    }
  }
  
  if (allProcesses.size === 0) {
    console.log('✅ No processes found to kill');
    logger.info('No processes found to kill');
    return;
  }
  
  console.log(`\n🎯 Found ${allProcesses.size} processes to kill:\n`);
  
  let killed = 0;
  let failed = 0;
  
  for (const [pid, proc] of allProcesses) {
    const portInfo = proc.port ? ` (port ${proc.port})` : '';
    process.stdout.write(`  • PID ${pid} - ${proc.name}${portInfo}... `);
    
    if (killProcess(pid)) {
      console.log('✅ killed');
      killed++;
      logger.info(`Killed process ${pid} - ${proc.name}${portInfo}`);
    } else {
      console.log('❌ failed');
      failed++;
      logger.error(`Failed to kill process ${pid} - ${proc.name}${portInfo}`);
    }
  }
  
  console.log(`\n📊 Summary: ${killed} killed, ${failed} failed\n`);
  
  // Double-check ports are free
  console.log('🔍 Verifying ports are free...');
  let allPortsFree = true;
  
  for (const port of targetPorts) {
    const stillUsing = getProcessesByPort([port]);
    if (stillUsing.length > 0) {
      console.log(`  ❌ Port ${port} is still in use by PID ${stillUsing[0].pid}`);
      allPortsFree = false;
    } else {
      console.log(`  ✅ Port ${port} is free`);
    }
  }
  
  if (allPortsFree) {
    console.log('\n✨ All processes killed successfully!');
    logger.info('All processes killed successfully', { killed, failed });
  } else {
    console.log('\n⚠️  Some ports are still in use. You may need to run with sudo.');
    logger.warn('Some ports are still in use', { killed, failed });
  }
}

// Run the script
main().catch(error => {
  console.error('❌ Error:', error);
  logger.error('Script error', error);
  process.exit(1);
});