import { io } from "socket.io-client";
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();  
  const socketHost = config.public.SOCKETIO_SERVER_URL || 'http://localhost';
  const socketPort = config.public.SOCKETIO_SERVER_PORT || 3002;
  const socket = io(`${socketHost}:${socketPort}`);
  nuxtApp.provide("socketio", socket);
});
