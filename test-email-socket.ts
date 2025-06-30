import { io, Socket } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3002';

async function testEmailSocket() {
  console.log('Connecting to socket...');
  
  const socket: Socket = io(SOCKET_URL, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Connected to socket, ID:', socket.id);
    
    // Test email list
    console.log('Calling emails:list...');
    socket.emit('emails:list', { limit: 10 }, (response: any) => {
      console.log('emails:list response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data.emails.length > 0) {
        // Test getting specific email
        const firstEmail = response.data.emails[0];
        console.log('\nTesting emails:get for first email...');
        socket.emit('emails:get', { 
          emailId: firstEmail.id, 
          inboxId: firstEmail.inboxId 
        }, (emailResponse: any) => {
          console.log('emails:get response:', JSON.stringify(emailResponse, null, 2));
          socket.disconnect();
          process.exit(0);
        });
      } else {
        socket.disconnect();
        process.exit(0);
      }
    });
  });

  socket.on('connect_error', (error: Error) => {
    console.error('Connection error:', error.message);
  });

  socket.on('error', (error: any) => {
    console.error('Socket error:', error);
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    console.error('Timeout - no response within 10 seconds');
    socket.disconnect();
    process.exit(1);
  }, 10000);
}

testEmailSocket();