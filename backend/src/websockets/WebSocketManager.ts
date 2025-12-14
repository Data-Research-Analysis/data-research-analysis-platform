/**
 * WebSocket Manager for Real-time Sync Updates
 * Broadcasts sync events to connected WebSocket clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import { SyncEventEmitter, SyncEventType } from '../events/SyncEventEmitter.js';
import { parse } from 'url';

interface WSClient {
    ws: WebSocket;
    userId?: number;
    dataSourceIds: Set<number>;
    isAlive: boolean;
}

export class WebSocketManager {
    private static instance: WebSocketManager;
    private wss: WebSocketServer | null = null;
    private clients: Map<WebSocket, WSClient> = new Map();
    private syncEventEmitter: SyncEventEmitter;
    private heartbeatInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.syncEventEmitter = SyncEventEmitter.getInstance();
    }

    public static getInstance(): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }
        return WebSocketManager.instance;
    }

    /**
     * Initialize WebSocket server
     */
    public initialize(server: HTTPServer): void {
        if (this.wss) {
            console.log('⚠️  WebSocket server already initialized');
            return;
        }

        this.wss = new WebSocketServer({ 
            server,
            path: '/ws/sync-status'
        });

        console.log('🔌 WebSocket server initialized on path /ws/sync-status');

        this.setupEventHandlers();
        this.startHeartbeat();
    }

    /**
     * Setup WebSocket event handlers
     */
    private setupEventHandlers(): void {
        if (!this.wss) return;

        this.wss.on('connection', (ws: WebSocket, request) => {
            console.log('✅ New WebSocket connection established');

            const client: WSClient = {
                ws,
                dataSourceIds: new Set(),
                isAlive: true,
            };

            this.clients.set(ws, client);

            // Setup pong handler for heartbeat
            ws.on('pong', () => {
                const client = this.clients.get(ws);
                if (client) {
                    client.isAlive = true;
                }
            });

            ws.on('message', (message: string) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('❌ Failed to parse WebSocket message:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });

            ws.on('close', () => {
                console.log('❌ WebSocket connection closed');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.clients.delete(ws);
            });

            // Send welcome message
            this.send(ws, {
                type: 'connected',
                message: 'Connected to sync status WebSocket',
                timestamp: new Date().toISOString(),
            });
        });

        // Subscribe to sync events
        this.subscribeToSyncEvents();
    }

    /**
     * Handle messages from clients
     */
    private handleClientMessage(ws: WebSocket, data: any): void {
        const client = this.clients.get(ws);
        if (!client) return;

        switch (data.type) {
            case 'subscribe':
                if (Array.isArray(data.dataSourceIds)) {
                    data.dataSourceIds.forEach((id: number) => {
                        client.dataSourceIds.add(id);
                    });
                    console.log(`📡 Client subscribed to data sources: ${Array.from(client.dataSourceIds).join(', ')}`);
                    this.send(ws, {
                        type: 'subscribed',
                        dataSourceIds: Array.from(client.dataSourceIds),
                    });
                }
                break;

            case 'unsubscribe':
                if (Array.isArray(data.dataSourceIds)) {
                    data.dataSourceIds.forEach((id: number) => {
                        client.dataSourceIds.delete(id);
                    });
                    console.log(`📡 Client unsubscribed from data sources: ${data.dataSourceIds.join(', ')}`);
                    this.send(ws, {
                        type: 'unsubscribed',
                        dataSourceIds: data.dataSourceIds,
                    });
                }
                break;

            case 'ping':
                this.send(ws, { type: 'pong', timestamp: new Date().toISOString() });
                break;

            default:
                console.warn(`⚠️  Unknown message type: ${data.type}`);
        }
    }

    /**
     * Subscribe to sync events and broadcast to clients
     */
    private subscribeToSyncEvents(): void {
        const eventTypes = Object.values(SyncEventType);

        eventTypes.forEach(eventType => {
            this.syncEventEmitter.on(eventType, (data: any) => {
                this.broadcastToSubscribers(eventType, data);
            });
        });

        console.log('📡 Subscribed to sync events for WebSocket broadcasting');
    }

    /**
     * Broadcast event to subscribed clients
     */
    private broadcastToSubscribers(eventType: SyncEventType, data: any): void {
        const dataSourceId = data.dataSourceId;
        if (!dataSourceId) return;

        let sentCount = 0;

        this.clients.forEach((client) => {
            if (client.dataSourceIds.has(dataSourceId)) {
                this.send(client.ws, {
                    type: 'sync-event',
                    eventType,
                    data,
                    timestamp: new Date().toISOString(),
                });
                sentCount++;
            }
        });

        if (sentCount > 0) {
            console.log(`📡 Broadcast ${eventType} to ${sentCount} client(s) for data source ${dataSourceId}`);
        }
    }

    /**
     * Send message to specific client
     */
    private send(ws: WebSocket, data: any): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * Send error message to client
     */
    private sendError(ws: WebSocket, message: string): void {
        this.send(ws, {
            type: 'error',
            message,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Broadcast message to all connected clients
     */
    public broadcast(data: any): void {
        this.clients.forEach((client) => {
            this.send(client.ws, data);
        });
    }

    /**
     * Start heartbeat to detect dead connections
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            this.clients.forEach((client, ws) => {
                if (!client.isAlive) {
                    console.log('💀 Terminating dead WebSocket connection');
                    ws.terminate();
                    this.clients.delete(ws);
                    return;
                }

                client.isAlive = false;
                ws.ping();
            });
        }, 30000); // 30 seconds
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Get connection statistics
     */
    public getStats(): {
        totalConnections: number;
        activeSubscriptions: Record<number, number>;
    } {
        const activeSubscriptions: Record<number, number> = {};

        this.clients.forEach((client) => {
            client.dataSourceIds.forEach((dataSourceId) => {
                activeSubscriptions[dataSourceId] = (activeSubscriptions[dataSourceId] || 0) + 1;
            });
        });

        return {
            totalConnections: this.clients.size,
            activeSubscriptions,
        };
    }

    /**
     * Close all connections and shutdown
     */
    public shutdown(): void {
        console.log('🛑 Shutting down WebSocket server...');

        this.stopHeartbeat();

        this.clients.forEach((client, ws) => {
            ws.close(1000, 'Server shutting down');
        });

        this.clients.clear();

        if (this.wss) {
            this.wss.close(() => {
                console.log('✅ WebSocket server closed');
            });
            this.wss = null;
        }
    }
}
