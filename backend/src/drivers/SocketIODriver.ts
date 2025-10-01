import { createServer } from "http";
import { Server } from "socket.io";
import { UtilityService } from "../services/UtilityService.js";
export class SocketIODriver {
    
    public static instance: SocketIODriver;
    private httpServer: any;
    private io: Server;

    constructor() {
        console.log('SocketIODriver');
        this.httpServer = createServer()
        this.io = new Server(this.httpServer, {
            cors: {
              origin: `${UtilityService.getInstance().getConstants('SOCKETIO_CLIENT_URL')}:${UtilityService.getInstance().getConstants('SOCKETIO_CLIENT_PORT')}`,
              methods: ["GET", "POST"]
            }
          });
    }

    public static getInstance(): SocketIODriver {
        if(!SocketIODriver.instance) {
            SocketIODriver.instance = new SocketIODriver();
        }
        return SocketIODriver.instance;
    }

    async initialize() {
        console.log('Initializing SocketIODriver');
        this.io.on("connection", (socket) => {
            console.log('socket has connected', socket.id);
            this.io.emit('serverInitialization', 'hello world from server');
        });
            
        this.httpServer.listen(UtilityService.getInstance().getConstants('SOCKETIO_SERVER_PORT'));   
        console.log('SocketIODriver initialized');
    }

    async close() {
        console.log('Closing SocketIODriver');
        this.io.close();
        console.log('SocketIODriver closed');
    }

    public async emitEvent(event: string, data: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.io.emit(event, data);
            return resolve();
        });
    }

    public async receiveEvent(event: string, callback: any): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            this.io.on(event, callback);
            return resolve();
        });
    }

    
}