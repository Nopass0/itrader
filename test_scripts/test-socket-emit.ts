// Test if socket.io-client emit with callback works correctly

import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

socket.on('connect', () => {
  console.log('Connected!');
  
  // Test 1: Using callback directly
  console.log('Test 1: Direct callback');
  socket.emit('health:check', (response: any) => {
    console.log('Response from callback:', response);
  });
  
  // Test 2: Using timeout emit (the way frontend does it)
  console.log('\nTest 2: Timeout emit');
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'));
    }, 5000);
    
    const callback = (response: any) => {
      clearTimeout(timeout);
      resolve(response);
    };
    
    socket.emit('health:check', callback);
  }).then(response => {
    console.log('Response from promise:', response);
    process.exit(0);
  }).catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  process.exit(1);
});