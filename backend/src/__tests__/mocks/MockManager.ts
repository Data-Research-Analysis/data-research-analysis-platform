/**
 * Mock utilities for AI Data Modeler tests
 * Provides reusable mocks for database, Redis, and Gemini services
 */

import { jest } from '@jest/globals';

/**
 * Mock Redis Client
 */
export class MockRedisClient {
    private store: Map<string, any> = new Map();
    private ttls: Map<string, number> = new Map();

    async get(key: string): Promise<string | null> {
        return this.store.get(key) || null;
    }

    async set(key: string, value: string, options?: any): Promise<string> {
        this.store.set(key, value);
        if (options?.EX) {
            this.ttls.set(key, Date.now() + options.EX * 1000);
        }
        return 'OK';
    }

    async del(key: string | string[]): Promise<number> {
        const keys = Array.isArray(key) ? key : [key];
        let count = 0;
        keys.forEach(k => {
            if (this.store.delete(k)) {
                this.ttls.delete(k);
                count++;
            }
        });
        return count;
    }

    async lPush(key: string, ...values: string[]): Promise<number> {
        const existing = this.store.get(key) || [];
        const list = Array.isArray(existing) ? existing : [];
        list.unshift(...values);
        this.store.set(key, list);
        return list.length;
    }

    async lRange(key: string, start: number, end: number): Promise<string[]> {
        const list = this.store.get(key) || [];
        if (!Array.isArray(list)) return [];
        if (end === -1) end = list.length - 1;
        return list.slice(start, end + 1);
    }

    async exists(key: string): Promise<number> {
        return this.store.has(key) ? 1 : 0;
    }

    async ttl(key: string): Promise<number> {
        const expiry = this.ttls.get(key);
        if (!expiry) return -1;
        const remaining = Math.floor((expiry - Date.now()) / 1000);
        return remaining > 0 ? remaining : -2;
    }

    async expire(key: string, seconds: number): Promise<number> {
        if (!this.store.has(key)) return 0;
        this.ttls.set(key, Date.now() + seconds * 1000);
        return 1;
    }

    // Test helpers
    clear(): void {
        this.store.clear();
        this.ttls.clear();
    }

    getStore(): Map<string, any> {
        return this.store;
    }
}

/**
 * Mock Google GenAI Client
 */
export class MockGenAI {
    private responses: Map<string, string> = new Map();
    private defaultResponse = 'Mock AI response';

    models = {
        generateContent: async ({ contents }: any) => {
            const lastMessage = contents[contents.length - 1];
            const userText = lastMessage?.parts?.[0]?.text || '';
            
            // Check for predefined response
            const response = this.responses.get(userText) || this.defaultResponse;
            
            return {
                text: response
            };
        },

        generateContentStream: async function* ({ contents }: any) {
            const lastMessage = contents[contents.length - 1];
            const userText = lastMessage?.parts?.[0]?.text || '';
            
            const response = this.responses.get(userText) || this.defaultResponse;
            const chunks = response.split(' ');
            
            for (const chunk of chunks) {
                yield { text: chunk + ' ' };
            }
        }.bind(this)
    };

    // Test helpers
    setResponse(input: string, output: string): void {
        this.responses.set(input, output);
    }

    setDefaultResponse(response: string): void {
        this.defaultResponse = response;
    }

    clear(): void {
        this.responses.clear();
        this.defaultResponse = 'Mock AI response';
    }
}

/**
 * Mock TypeORM Manager
 */
export class MockEntityManager {
    private entities: Map<string, any[]> = new Map();

    create(entityClass: any, data: any): any {
        return { ...data, id: Math.floor(Math.random() * 10000) };
    }

    async save(entityClass: any, entity: any | any[]): Promise<any> {
        const entities = Array.isArray(entity) ? entity : [entity];
        const className = entityClass.name || 'Unknown';
        
        if (!this.entities.has(className)) {
            this.entities.set(className, []);
        }
        
        const stored = this.entities.get(className)!;
        entities.forEach(e => {
            if (!e.id) e.id = Math.floor(Math.random() * 10000);
            stored.push(e);
        });
        
        return Array.isArray(entity) ? entities : entities[0];
    }

    async findOne(entityClass: any, options: any): Promise<any | null> {
        const className = entityClass.name || 'Unknown';
        const stored = this.entities.get(className) || [];
        
        // Simple where clause matching
        const where = options.where || {};
        const found = stored.find((item: any) => {
            return Object.keys(where).every(key => {
                const value = where[key];
                if (typeof value === 'object' && value.id !== undefined) {
                    return item[key]?.id === value.id;
                }
                return item[key] === value;
            });
        });
        
        return found || null;
    }

    async find(entityClass: any, options?: any): Promise<any[]> {
        const className = entityClass.name || 'Unknown';
        const stored = this.entities.get(className) || [];
        
        if (!options?.where) return stored;
        
        const where = options.where;
        return stored.filter((item: any) => {
            return Object.keys(where).every(key => {
                const value = where[key];
                if (typeof value === 'object' && value.id !== undefined) {
                    return item[key]?.id === value.id;
                }
                return item[key] === value;
            });
        });
    }

    // Test helpers
    clear(): void {
        this.entities.clear();
    }

    getEntities(className: string): any[] {
        return this.entities.get(className) || [];
    }

    addEntity(className: string, entity: any): void {
        if (!this.entities.has(className)) {
            this.entities.set(className, []);
        }
        this.entities.get(className)!.push(entity);
    }
}

/**
 * Test data generators
 */
export const TestDataFactory = {
    createSchemaContext: (tableCount: number = 3) => {
        const tables = [];
        for (let i = 0; i < tableCount; i++) {
            tables.push({
                schema: 'public',
                tableName: `table_${i}`,
                columns: [
                    { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null },
                    { column_name: 'name', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 },
                    { column_name: 'created_at', data_type: 'timestamp', is_nullable: 'YES', column_default: null, character_maximum_length: null }
                ],
                primaryKeys: ['id'],
                foreignKeys: []
            });
        }
        return { tables, relationships: [] };
    },

    createGoogleAnalyticsSchema: () => {
        return {
            tables: [
                {
                    schema: 'dra_google_analytics',
                    tableName: 'sessions_42',
                    columns: [
                        { column_name: 'session_id', data_type: 'varchar', is_nullable: 'NO', column_default: null, character_maximum_length: 255 },
                        { column_name: 'device_category', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 },
                        { column_name: 'session_count', data_type: 'integer', is_nullable: 'YES', column_default: null, character_maximum_length: null }
                    ],
                    primaryKeys: ['session_id'],
                    foreignKeys: []
                }
            ],
            relationships: []
        };
    },

    createCrossSourceSchema: () => {
        return {
            tables: [
                {
                    schema: 'public',
                    tableName: 'users',
                    columns: [
                        { column_name: 'id', data_type: 'integer', is_nullable: 'NO', column_default: null, character_maximum_length: null },
                        { column_name: 'email', data_type: 'varchar', is_nullable: 'YES', column_default: null, character_maximum_length: 255 }
                    ],
                    primaryKeys: ['id'],
                    foreignKeys: []
                },
                {
                    schema: 'dra_google_analytics',
                    tableName: 'events_15',
                    columns: [
                        { column_name: 'event_id', data_type: 'varchar', is_nullable: 'NO', column_default: null, character_maximum_length: 255 },
                        { column_name: 'user_id', data_type: 'integer', is_nullable: 'YES', column_default: null, character_maximum_length: null }
                    ],
                    primaryKeys: ['event_id'],
                    foreignKeys: []
                }
            ],
            relationships: []
        };
    },

    createDataModel: () => {
        return {
            tables: [
                {
                    table_name: 'users',
                    columns: [
                        { column_name: 'id', alias_name: 'user_id' },
                        { column_name: 'email', alias_name: '' }
                    ],
                    query_options: {
                        where: [],
                        group_by: null,
                        order_by: []
                    }
                }
            ],
            relationships: [],
            indexes: []
        };
    },

    createAIGuideResponse: (message: string) => {
        return JSON.stringify({
            action: 'GUIDE',
            message: message
        });
    },

    createAIBuildModelResponse: (guidance: string) => {
        return JSON.stringify({
            action: 'BUILD_DATA_MODEL',
            guidance: guidance,
            model: TestDataFactory.createDataModel()
        });
    },

    createAINoneResponse: () => {
        return JSON.stringify({
            action: 'NONE',
            message: 'I can only help with data modeling questions.'
        });
    }
};

/**
 * Create mock request object
 */
export function createMockRequest(body: any = {}, params: any = {}): any {
    return {
        body: {
            tokenDetails: {
                user_id: 1
            },
            ...body
        },
        params
    };
}

/**
 * Create mock response object with Jest spies
 */
export function createMockResponse(): any {
    const res: any = {
        statusCode: 200,
        data: null
    };

    res.status = jest.fn((code: number) => {
        res.statusCode = code;
        return res;
    });

    res.json = jest.fn((data: any) => {
        res.data = data;
        return res;
    });

    return res;
}
