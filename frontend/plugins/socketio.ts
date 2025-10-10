import { io, Socket } from "socket.io-client";

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();  
  const socketHost = config.public.SOCKETIO_SERVER_URL || 'http://localhost';
  const socketPort = config.public.SOCKETIO_SERVER_PORT || 3002;
  
  console.log(`Attempting to connect to Socket.IO server at ${socketHost}:${socketPort}`);
  
  const socket: Socket = io(`${socketHost}:${socketPort}`, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000,
    forceNew: true
  });

  // Connection event handlers
  socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO server:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected from Socket.IO server:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔥 Socket.IO connection error:', error.message);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('🔄 Reconnected to Socket.IO server after', attemptNumber, 'attempts');
  });

  socket.on('reconnect_error', (error) => {
    console.error('🔥 Socket.IO reconnection error:', error.message);
  });

  socket.on('reconnect_failed', () => {
    console.error('💀 Socket.IO reconnection failed - max attempts reached');
  });

  // Listen for server initialization message
  socket.on('serverInitialization', (data) => {
    console.log('📡 Server initialization message:', data);
  });

  // Provide socket instance to the app
  nuxtApp.provide("socketio", socket);
  
  // Cleanup on app unmount
  nuxtApp.hook('app:beforeMount', () => {
    // Socket cleanup will be handled automatically on page navigation
  });
});
