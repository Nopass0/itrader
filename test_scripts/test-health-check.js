const io = require('socket.io-client');

console.log('Connecting to WebSocket server...');
const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('Connected! Socket ID:', socket.id);
  
  // Test health check
  console.log('Sending health:check...');
  socket.emit('health:check', (response) => {
    console.log('Health check response:', response);
    socket.disconnect();
    process.exit(0);
  });
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('Timeout - no response received');
  process.exit(1);
}, 5000);