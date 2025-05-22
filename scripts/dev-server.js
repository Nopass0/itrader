#!/usr/bin/env node

import { spawn } from 'child_process';
import { checkAllPorts } from './check-ports.js';

async function startDevelopment() {
  console.log('🚀 Starting AI Trader Development Environment...\n');
  
  // Clean up ports first
  await checkAllPorts();
  
  console.log('🔧 Starting development servers...\n');
  
  // Start backend server
  const serverProcess = spawn('bun', ['run', '--watch', 'src/index.ts'], {
    cwd: './server',
    stdio: 'inherit'
  });
  
  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start frontend server
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: './frontend', 
    stdio: 'inherit'
  });
  
  // Handle process cleanup
  const cleanup = () => {
    console.log('\n🛑 Shutting down development servers...');
    serverProcess.kill('SIGTERM');
    frontendProcess.kill('SIGTERM');
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  
  // Handle server process errors
  serverProcess.on('error', (error) => {
    console.error('❌ Server process error:', error);
  });
  
  frontendProcess.on('error', (error) => {
    console.error('❌ Frontend process error:', error);
  });
  
  // Handle server process exit
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Server process exited with code ${code}`);
      cleanup();
    }
  });
  
  frontendProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`❌ Frontend process exited with code ${code}`);
      cleanup();
    }
  });
  
  console.log('✅ Development environment started!');
  console.log('📱 Frontend: http://localhost:3001');
  console.log('🚀 Backend: http://localhost:3000');
  console.log('🏥 Health: http://localhost:3000/health');
  console.log('\n💡 Press Ctrl+C to stop all servers\n');
}

startDevelopment().catch(console.error);