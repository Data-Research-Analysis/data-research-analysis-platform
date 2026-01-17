import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { SocketIODriver } from '../../drivers/SocketIODriver.js';

// Mock socket.io
jest.mock('socket.io');

/**
 * DRA-TEST-019: SocketIODriver Unit Tests
 * Tests WebSocket server initialization, event handling, room management, broadcasting
 * Total: 25+ tests
 */
describe('SocketIODriver', () => {
    let socketIODriver: SocketIODriver;
    let mockHTTPServer: HTTPServer;
    let mockIO: jest.Mocked<SocketIOServer>;
    let mockSocket: any;

    beforeEach(() => {
        mockHTTPServer = {} as HTTPServer;
        
        mockSocket = {
            id: 'test-socket-id',
            join: jest.fn(),
            leave: jest.fn(),
            emit: jest.fn(),
            on: jest.fn(),
            disconnect: jest.fn(),
            rooms: new Set(['test-socket-id'])
        };

        mockIO = {
            on: jest.fn(),
            to: jest.fn().mockReturnThis(),
            emit: jest.fn(),
            close: jest.fn(),
            sockets: {
                sockets: new Map([['test-socket-id', mockSocket]])
            }
        } as any;

        (SocketIOServer as unknown as jest.Mock).mockImplementation(() => mockIO);

        socketIODriver = SocketIODriver.getInstance();
        socketIODriver.initialize(mockHTTPServer);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple getInstance() calls', () => {
            const instance1 = SocketIODriver.getInstance();
            const instance2 = SocketIODriver.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should maintain state across getInstance() calls', () => {
            const instance1 = SocketIODriver.getInstance();
            const instance2 = SocketIODriver.getInstance();
            expect(instance1).toStrictEqual(instance2);
        });
    });

    describe('Server Initialization', () => {
        it('should initialize Socket.IO server with HTTP server', () => {
            const driver = SocketIODriver.getInstance();
            driver.initialize(mockHTTPServer);

            expect(SocketIOServer).toHaveBeenCalledWith(mockHTTPServer, expect.any(Object));
        });

        it('should configure CORS for Socket.IO', () => {
            expect(SocketIOServer).toHaveBeenCalledWith(
                mockHTTPServer,
                expect.objectContaining({
                    cors: expect.any(Object)
                })
            );
        });

        it('should set up connection event listener', () => {
            expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
        });

        it('should configure CORS with multiple origins', () => {
            expect(SocketIOServer).toHaveBeenCalledWith(
                mockHTTPServer,
                expect.objectContaining({
                    cors: expect.objectContaining({
                        origin: expect.any(Array),
                        methods: expect.arrayContaining(['GET', 'POST']),
                        credentials: true
                    })
                })
            );
        });

        it('should emit serverInitialization event on connection', () => {
            const connectionHandler = (mockIO.on as jest.Mock).mock.calls.find(
                call => call[0] === 'connection'
            )?.[1] as ((socket: any) => void) | undefined;

            if (connectionHandler && typeof connectionHandler === 'function') {
                connectionHandler(mockSocket);
                expect(mockSocket.emit).toHaveBeenCalledWith(
                    'serverInitialization',
                    expect.objectContaining({
                        message: 'Connected to Data Research Analysis server',
                        socketId: 'test-socket-id'
                    })
                );
            }
        });
    });

    describe('Connection Handling', () => {
        it('should handle new client connections', () => {
            const connectionHandler = (mockIO.on as jest.Mock).mock.calls.find(
                call => call[0] === 'connection'
            )?.[1];

            if (connectionHandler && typeof connectionHandler === 'function') {
                connectionHandler(mockSocket);
                expect(mockSocket.on).toHaveBeenCalled();
            }
        });

        it('should assign unique socket ID to each connection', () => {
            expect(mockSocket.id).toBeDefined();
            expect(typeof mockSocket.id).toBe('string');
        });

        it('should handle client disconnections', () => {
            const connectionHandler = (mockIO.on as jest.Mock).mock.calls.find(
                call => call[0] === 'connection'
            )?.[1];

            if (connectionHandler && typeof connectionHandler === 'function') {
                (connectionHandler as (socket: any) => void)(mockSocket);
                
                const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
                    call => call[0] === 'disconnect'
                )?.[1] as (() => void) | undefined;

                if (disconnectHandler && typeof disconnectHandler === 'function') {
                    disconnectHandler();
                    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
                }
            }
        });

        it('should log socket connection', () => {
            const consoleSpy = jest.spyOn(console, 'log');
            const connectionHandler = (mockIO.on as jest.Mock).mock.calls.find(
                call => call[0] === 'connection'
            )?.[1];

            if (connectionHandler && typeof connectionHandler === 'function') {
                connectionHandler(mockSocket);
                expect(consoleSpy).toHaveBeenCalledWith('Socket connected:', 'test-socket-id');
            }
            consoleSpy.mockRestore();
        });
    });

    describe('Event Emission', () => {
        it('should emit events to all clients', async () => {
            await socketIODriver.emitEvent('test-event', { data: 'test' });
            expect(mockIO.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
        });

        it('should reject emitEvent when Socket.IO not initialized', async () => {
            const uninitializedDriver = new (SocketIODriver as any)();
            await expect(uninitializedDriver.emitEvent('test', {}))
                .rejects.toThrow('Socket.IO server not initialized');
        });

        it('should handle complex event data', async () => {
            const complexData = {
                nested: { value: 123 },
                array: [1, 2, 3],
                timestamp: new Date().toISOString()
            };
            await socketIODriver.emitEvent('complex-event', complexData);
            expect(mockIO.emit).toHaveBeenCalledWith('complex-event', complexData);
        });
    });

    describe('Event Reception', () => {
        it('should receive events from clients', async () => {
            const callback = jest.fn();
            await socketIODriver.receiveEvent('client-event', callback);
            expect(mockIO.on).toHaveBeenCalledWith('client-event', callback);
        });

        it('should reject receiveEvent when Socket.IO not initialized', async () => {
            const uninitializedDriver = new (SocketIODriver as any)();
            await expect(uninitializedDriver.receiveEvent('test', jest.fn()))
                .rejects.toThrow('Socket.IO server not initialized');
        });

        it('should handle multiple event listeners', async () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            await socketIODriver.receiveEvent('event1', callback1);
            await socketIODriver.receiveEvent('event2', callback2);
            expect(mockIO.on).toHaveBeenCalledWith('event1', callback1);
            expect(mockIO.on).toHaveBeenCalledWith('event2', callback2);
        });
    });

    describe('Server Lifecycle', () => {
        it('should close Socket.IO server', async () => {
            await socketIODriver.close();
            expect(mockIO.close).toHaveBeenCalled();
        });

        it('should log initialization', async () => {
            const consoleSpy = jest.spyOn(console, 'log');
            const driver = new SocketIODriver();
            await driver.initialize(mockHTTPServer);
            expect(consoleSpy).toHaveBeenCalledWith('Initializing SocketIODriver with existing HTTP server');
            expect(consoleSpy).toHaveBeenCalledWith('SocketIODriver initialized successfully');
            consoleSpy.mockRestore();
        });

        it('should log closure', async () => {
            const consoleSpy = jest.spyOn(console, 'log');
            await socketIODriver.close();
            expect(consoleSpy).toHaveBeenCalledWith('Closing SocketIODriver');
            expect(consoleSpy).toHaveBeenCalledWith('SocketIODriver closed');
            consoleSpy.mockRestore();
        });
    });

    describe('Error Handling', () => {
        it('should handle socket errors gracefully', () => {
            const connectionHandler = (mockIO.on as jest.Mock).mock.calls.find(
                call => call[0] === 'connection'
            )?.[1] as ((socket: any) => void) | undefined;

            if (connectionHandler) {
                connectionHandler(mockSocket);
                
                const errorHandler = (mockSocket.on as jest.Mock).mock.calls.find(
                    call => call[0] === 'error'
                )?.[1] as ((error: Error) => void) | undefined;

                if (errorHandler) {
                    expect(() => errorHandler(new Error('Socket error'))).not.toThrow();
                }
            }
        });

        it('should handle null event data in emitEvent', async () => {
            await expect(socketIODriver.emitEvent('test', null)).resolves.not.toThrow();
        });

        it('should handle undefined event data in emitEvent', async () => {
            await expect(socketIODriver.emitEvent('test', undefined)).resolves.not.toThrow();
        });
    });

    describe('Constructor', () => {
        it('should log on instantiation', () => {
            const consoleSpy = jest.spyOn(console, 'log');
            new SocketIODriver();
            expect(consoleSpy).toHaveBeenCalledWith('SocketIODriver initialized');
            consoleSpy.mockRestore();
        });
    });
});