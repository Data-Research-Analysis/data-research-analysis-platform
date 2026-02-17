import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { UtilityService } from "../services/UtilityService.js";
import { TokenProcessor } from "../processors/TokenProcessor.js";

export class SocketIODriver {
    
    public static instance: SocketIODriver;
    private httpServer: HTTPServer | null = null;
    private io: Server | null = null;

    constructor() {
        console.log('SocketIODriver initialized');
    }

    public static getInstance(): SocketIODriver {
        if(!SocketIODriver.instance) {
            SocketIODriver.instance = new SocketIODriver();
        }
        return SocketIODriver.instance;
    }

    /**
     * Authenticate socket connection using JWT token
     */
    private async authenticateSocket(socket: Socket): Promise<number | null> {
        try {
            // Debug: Log all possible token locations
            console.log('[Socket.IO] Auth debug for socket', socket.id);
            console.log('[Socket.IO] - handshake.auth:', socket.handshake.auth);
            console.log('[Socket.IO] - handshake.query:', socket.handshake.query);
            console.log('[Socket.IO] - handshake.headers.authorization:', socket.handshake.headers?.authorization);
            
            // Try to get token from auth handshake
            const token = socket.handshake.auth?.token || 
                         socket.handshake.query?.token ||
                         socket.handshake.headers?.authorization?.replace('Bearer ', '');
            
            if (!token) {
                console.log('[Socket.IO] No authentication token provided for socket:', socket.id);
                return null;
            }

            console.log('[Socket.IO] Token found, validating...');
            console.log('[Socket.IO] Token (first 20 chars):', typeof token === 'string' ? token.substring(0, 20) : typeof token);
            
            // Validate token and get details
            const tokenProcessor = TokenProcessor.getInstance();
            const tokenDetails = await tokenProcessor.getTokenDetails(token);
            
            console.log('[Socket.IO] Token validation result:', tokenDetails ? `user_id: ${tokenDetails.user_id}` : 'null');
            
            if (tokenDetails && tokenDetails.user_id) {
                console.log(`[Socket.IO] Socket ${socket.id} authenticated as user ${tokenDetails.user_id}`);
                return tokenDetails.user_id;
            }
            
            return null;
        } catch (error) {
            console.error('[Socket.IO] Authentication error:', error);
            return null;
        }
    }

    async initialize(httpServer: HTTPServer) {
        console.log('Initializing SocketIODriver with existing HTTP server');
        this.httpServer = httpServer;
        
        // Create Socket.IO server instance with the shared HTTP server
        this.io = new Server(this.httpServer, {
            cors: {
                origin: [
                    `${UtilityService.getInstance().getConstants('SOCKETIO_CLIENT_URL')}`,
                    `${UtilityService.getInstance().getConstants('SOCKETIO_CLIENT_URL')}:${UtilityService.getInstance().getConstants('SOCKETIO_CLIENT_PORT')}`,
                    "http://localhost:3000",
                    "http://localhost:3001",
                    "https://dataresearchanalysis.com",
                    "https://www.dataresearchanalysis.com",
                    "https://api.dataresearchanalysis.com"
                ],
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling'], // Ensure both transports are enabled
            allowEIO3: true, // Support older clients if needed
            path: '/socket.io/' // Explicit path
        });

        this.io.on("connection", async (socket) => {
            console.log('[Socket.IO] Socket connected:', socket.id);
            
            // Authenticate user
            const userId = await this.authenticateSocket(socket);
            
            if (userId) {
                // Join user-specific room
                const roomName = `user-${userId}`;
                socket.join(roomName);
                console.log(`[Socket.IO] User ${userId} joined room: ${roomName}`);
                
                // Store userId in socket data for later reference
                (socket as any).userId = userId;
                
                // Send welcome message to connected client
                socket.emit('serverInitialization', {
                    message: 'Connected to Data Research Analysis server',
                    socketId: socket.id,
                    userId: userId,
                    room: roomName,
                    timestamp: new Date().toISOString()
                });
            } else {
                console.log('[Socket.IO] Anonymous connection (no authentication):', socket.id);
                
                // Send welcome message even for anonymous users
                socket.emit('serverInitialization', {
                    message: 'Connected to Data Research Analysis server (unauthenticated)',
                    socketId: socket.id,
                    timestamp: new Date().toISOString()
                });
            }

            // Handle disconnection
            socket.on("disconnect", () => {
                const userId = (socket as any).userId;
                if (userId) {
                    console.log(`[Socket.IO] User ${userId} disconnected (socket: ${socket.id})`);
                } else {
                    console.log('[Socket.IO] Socket disconnected:', socket.id);
                }
            });
        });
            
        console.log('SocketIODriver initialized successfully');
    }

    async close() {
        console.log('Closing SocketIODriver');
        this.io.close();
        console.log('SocketIODriver closed');
    }

    public async emitEvent(event: string, data: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!this.io) {
                reject(new Error('Socket.IO server not initialized'));
                return;
            }
            this.io.emit(event, data);
            return resolve();
        });
    }

    public async receiveEvent(event: string, callback: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!this.io) {
                reject(new Error('Socket.IO server not initialized'));
                return;
            }
            this.io.on(event, callback);
            return resolve();
        });
    }

    /**
     * Emit an event to a specific user
     * Users are identified by their userId which should be used as the room name
     * 
     * @param userId - The user ID to emit to
     * @param event - The event name
     * @param data - The data to send
     */
    public async emitToUser(userId: number, event: string, data: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (!this.io) {
                reject(new Error('Socket.IO server not initialized'));
                return;
            }
            const roomName = `user-${userId}`;
            console.log(`[Socket.IO] Emitting '${event}' to room ${roomName}:`, data);
            // Emit to a room named after the userId
            this.io.to(roomName).emit(event, data);
            return resolve();
        });
    }

    
}