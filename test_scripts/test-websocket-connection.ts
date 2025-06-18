import { io } from 'socket.io-client';

const wsUrl = 'http://localhost:3001';

console.log('Connecting to WebSocket server at', wsUrl);

const socket = io(wsUrl, {
  transports: ['websocket', 'polling'],
  timeout: 10000
});

socket.on('connect', () => {
  console.log('✅ Connected! Socket ID:', socket.id);
  
  // Test health check
  socket.emit('health:check', (response: any) => {
    console.log('Health check response:', response);
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (error: any) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('error', (error: any) => {
  console.error('❌ Socket error:', error);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ Connection timeout');
  process.exit(1);
}, 5000);