#!/usr/bin/env bun
/**
 * Test script for orchestrator toggle functionality
 * Tests the pause/resume feature via the WebSocket API
 */

import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.WS_URL || 'http://localhost:3001';

// Admin credentials
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

class OrchestratorToggleTest {
  private socket: Socket | null = null;
  private token: string | null = null;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to WebSocket server...');
      
      this.socket = io(WS_URL, {
        reconnection: false,
        timeout: 10000
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to WebSocket server');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error.message);
        reject(error);
      });
    });
  }

  async login(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔐 Logging in as admin...');
      
      this.socket!.emit('auth:login', { 
        username: ADMIN_USERNAME, 
        password: ADMIN_PASSWORD 
      }, (response: any) => {
        if (response.success && response.data?.token) {
          this.token = response.data.token;
          console.log('✅ Login successful');
          
          // Reconnect with auth token
          this.socket!.disconnect();
          this.socket = io(WS_URL, {
            auth: { token: this.token },
            reconnection: false
          });
          
          this.socket!.on('connect', () => {
            resolve();
          });
        } else {
          console.error('❌ Login failed:', response.error?.message || 'Unknown error');
          reject(new Error(response.error?.message || 'Login failed'));
        }
      });
    });
  }

  async getStatus(): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log('📊 Getting orchestrator status...');
      
      this.socket!.emit('orchestrator:getStatus', (response: any) => {
        if (response.success) {
          console.log('✅ Status:', response.data);
          resolve(response.data);
        } else {
          console.error('❌ Failed to get status:', response.error?.message);
          reject(new Error(response.error?.message || 'Failed to get status'));
        }
      });
    });
  }

  async pause(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('⏸️  Pausing orchestrator...');
      
      this.socket!.emit('orchestrator:pause', (response: any) => {
        if (response.success) {
          console.log('✅ Orchestrator paused');
          resolve();
        } else {
          console.error('❌ Failed to pause:', response.error?.message);
          reject(new Error(response.error?.message || 'Failed to pause'));
        }
      });
    });
  }

  async resume(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('▶️  Resuming orchestrator...');
      
      this.socket!.emit('orchestrator:resume', (response: any) => {
        if (response.success) {
          console.log('✅ Orchestrator resumed');
          resolve();
        } else {
          console.error('❌ Failed to resume:', response.error?.message);
          reject(new Error(response.error?.message || 'Failed to resume'));
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🔌 Disconnected from WebSocket server');
    }
  }
}

async function main() {
  const test = new OrchestratorToggleTest();
  
  try {
    // Connect and login
    await test.connect();
    await test.login();
    
    // Get initial status
    console.log('\n=== Initial Status ===');
    const initialStatus = await test.getStatus();
    
    // Test pause/resume toggle
    console.log('\n=== Testing Toggle ===');
    
    if (initialStatus.isRunning) {
      // If running, pause then resume
      await test.pause();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const pausedStatus = await test.getStatus();
      console.log('Status after pause:', pausedStatus);
      
      await test.resume();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const resumedStatus = await test.getStatus();
      console.log('Status after resume:', resumedStatus);
    } else {
      // If paused, resume then pause
      await test.resume();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const resumedStatus = await test.getStatus();
      console.log('Status after resume:', resumedStatus);
      
      await test.pause();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
      const pausedStatus = await test.getStatus();
      console.log('Status after pause:', pausedStatus);
    }
    
    console.log('\n✅ Toggle test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    test.disconnect();
  }
}

// Run the test
main().catch(console.error);