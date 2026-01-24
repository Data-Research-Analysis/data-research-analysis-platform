import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { UtilityService } from "../services/UtilityService.js";
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
                    "http://localhost:3001"
                ],
                methods: ["GET", "POST"],
                credentials: true
            }
        });

        this.io.on("connection", (socket) => {
            console.log('Socket connected:', socket.id);
            
            // Send welcome message to connected client
            socket.emit('serverInitialization', {
                message: 'Connected to Data Research Analysis server',
                socketId: socket.id,
                timestamp: new Date().toISOString()
            });

            // Handle disconnection
            socket.on("disconnect", () => {
                console.log('Socket disconnected:', socket.id);
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
            // Emit to a room named after the userId
            this.io.to(`user-${userId}`).emit(event, data);
            return resolve();
        });
    }

    
}