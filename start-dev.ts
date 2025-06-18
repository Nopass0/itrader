#!/usr/bin/env bun
import { spawn, execSync } from 'child_process';
import { platform } from 'os';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(prefix: string, color: string, message: string) {
  console.log(`${color}[${prefix}]${colors.reset} ${message}`);
}

async function main() {
  // Kill existing processes
  log('DEV', colors.yellow, 'Cleaning up existing processes...');

  const processesToKill = [
    'next-server',
    'npm run dev',
    'next dev',
    'bun.*app.ts'
  ];

  processesToKill.forEach(processName => {
    try {
      execSync(`pkill -f "${processName}"`, { stdio: 'ignore' });
    } catch (e) {
      // Process might not exist, that's okay
    }
  });

  // Kill processes on specific ports
  log('DEV', colors.yellow, 'Killing processes on ports 3000, 3001, 3002...');
  const ports = [3000, 3001, 3002];
  ports.forEach(port => {
    try {
      const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' }).trim();
      if (pid) {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        log('DEV', colors.green, `Killed process on port ${port}`);
      }
    } catch (e) {
      // Port might not be in use, that's okay
    }
  });

  // Wait for processes to stop
  log('DEV', colors.yellow, 'Waiting for processes to stop...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  log('DEV', colors.cyan, '🚀 Development server starting...');
  log('DEV', colors.cyan, '📝 Backend will run on port 3001 (WebSocket API)');
  log('DEV', colors.cyan, '🎨 Frontend will run on port 3000');
  log('DEV', colors.cyan, '🔥 Hot reload enabled for both frontend and backend');

  // Start backend with hot reload
  log('DEV', colors.green, 'Starting backend with hot reload...');
  const backend = spawn('bun', ['--hot', 'run', 'src/app.ts'], {
    stdio: 'pipe',
    shell: true
  });

  backend.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach((line: string) => {
      log('BACKEND', colors.blue, line);
    });
  });

  backend.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach((line: string) => {
      log('BACKEND', colors.red, line);
    });
  });

  // Wait a bit for backend to start, then start frontend
  setTimeout(() => {
    log('DEV', colors.green, 'Starting frontend...');
    
    const frontend = spawn('npm', ['run', 'dev'], {
      cwd: './frontend',
      stdio: 'pipe',
      shell: true
    });

    frontend.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach((line: string) => {
        log('FRONTEND', colors.magenta, line);
      });
    });

    frontend.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach((line: string) => {
        log('FRONTEND', colors.yellow, line);
      });
    });

    // Open browser after frontend starts
    frontend.stdout.once('data', () => {
      setTimeout(() => {
        log('DEV', colors.green, 'Opening browser...');
        const url = 'http://localhost:3000';
        
        // Open browser based on platform
        let openCommand: string;
        switch (platform()) {
          case 'darwin':
            openCommand = `open ${url}`;
            break;
          case 'win32':
            openCommand = `start ${url}`;
            break;
          default:
            openCommand = `xdg-open ${url}`;
        }
        
        spawn(openCommand, [], { shell: true });
      }, 3000); // Wait for Next.js to fully start
    });

    // Handle frontend exit
    frontend.on('exit', (code) => {
      log('FRONTEND', colors.yellow, `Process exited with code ${code}`);
      backend.kill();
      process.exit(code || 0);
    });
  }, 2000); // Wait 2 seconds for backend to start

  // Handle backend exit
  backend.on('exit', (code) => {
    log('BACKEND', colors.yellow, `Process exited with code ${code}`);
    process.exit(code || 0);
  });

  // Handle CTRL+C
  process.on('SIGINT', () => {
    log('DEV', colors.yellow, 'Shutting down...');
    backend.kill();
    process.exit(0);
  });

  // Handle errors
  backend.on('error', (err) => {
    log('BACKEND', colors.red, `Error: ${err.message}`);
    process.exit(1);
  });
}

// Run the main function
main().catch(err => {
  log('DEV', colors.red, `Fatal error: ${err.message}`);
  process.exit(1);
});