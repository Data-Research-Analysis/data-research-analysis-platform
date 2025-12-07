import { getRedisClient, RedisTTL } from '../config/redis.config.js';
import { v4 as uuidv4 } from 'uuid';

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

export interface AISessionMetadata {
    conversationId: string;
    dataSourceId: number;
    userId: number;
    startedAt: string;
    lastActivityAt: string;
    status: 'draft' | 'saved' | 'archived';
}

export interface ModelDraft {
    tables: any;
    relationships: any[];
    indexes: any[];
    lastModified: string;
    version: number;
}

export interface SchemaContext {
    tables: any[];
    relationships: any[];
}

export class RedisAISessionService {
    private redis = getRedisClient();

    // Key generators
    private getConversationKey(dataSourceId: number, userId: number): string {
        return `conversation:${dataSourceId}:${userId}`;
    }

    private getMessagesKey(dataSourceId: number, userId: number): string {
        return `messages:${dataSourceId}:${userId}`;
    }

    private getModelDraftKey(dataSourceId: number, userId: number): string {
        return `model-draft:${dataSourceId}:${userId}`;
    }

    private getSchemaContextKey(dataSourceId: number, userId: number): string {
        return `schema-context:${dataSourceId}:${userId}`;
    }

    // Session Management
    async createSession(
        dataSourceId: number,
        userId: number,
        schemaContext: SchemaContext
    ): Promise<AISessionMetadata> {
        const conversationKey = this.getConversationKey(dataSourceId, userId);
        const schemaKey = this.getSchemaContextKey(dataSourceId, userId);

        const metadata: AISessionMetadata = {
            conversationId: `temp-${uuidv4()}`,
            dataSourceId,
            userId,
            startedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            status: 'draft',
        };

        // Save conversation metadata
        await this.redis.hmset(conversationKey, metadata as any);
        await this.redis.expire(conversationKey, RedisTTL.AI_SESSION);

        // Save schema context
        await this.redis.set(schemaKey, JSON.stringify(schemaContext));
        await this.redis.expire(schemaKey, RedisTTL.AI_SCHEMA_CONTEXT);

        return metadata;
    }

    async getSession(dataSourceId: number, userId: number): Promise<AISessionMetadata | null> {
        const conversationKey = this.getConversationKey(dataSourceId, userId);
        const data = await this.redis.hgetall(conversationKey);

        if (!data || Object.keys(data).length === 0) {
            return null;
        }

        return {
            conversationId: data.conversationId,
            dataSourceId: parseInt(data.dataSourceId, 10),
            userId: parseInt(data.userId, 10),
            startedAt: data.startedAt,
            lastActivityAt: data.lastActivityAt,
            status: data.status as 'draft' | 'saved' | 'archived',
        };
    }

    async updateSessionActivity(dataSourceId: number, userId: number): Promise<void> {
        const conversationKey = this.getConversationKey(dataSourceId, userId);
        await this.redis.hset(conversationKey, 'lastActivityAt', new Date().toISOString());
        await this.redis.expire(conversationKey, RedisTTL.AI_SESSION);
    }

    async clearSession(dataSourceId: number, userId: number): Promise<void> {
        const conversationKey = this.getConversationKey(dataSourceId, userId);
        await this.redis.del(conversationKey);
    }

    // Message Management
    async addMessage(
        dataSourceId: number,
        userId: number,
        role: 'user' | 'assistant' | 'system',
        content: string
    ): Promise<AIMessage> {
        const messagesKey = this.getMessagesKey(dataSourceId, userId);

        const message: AIMessage = {
            role,
            content,
            timestamp: new Date().toISOString(),
        };

        await this.redis.rpush(messagesKey, JSON.stringify(message));
        await this.redis.expire(messagesKey, RedisTTL.AI_MESSAGES);

        // Update session activity
        await this.updateSessionActivity(dataSourceId, userId);

        return message;
    }

    async getMessages(dataSourceId: number, userId: number): Promise<AIMessage[]> {
        const messagesKey = this.getMessagesKey(dataSourceId, userId);
        const messages = await this.redis.lrange(messagesKey, 0, -1);

        return messages.map((msg) => JSON.parse(msg));
    }

    async clearMessages(dataSourceId: number, userId: number): Promise<void> {
        const messagesKey = this.getMessagesKey(dataSourceId, userId);
        await this.redis.del(messagesKey);
    }

    // Model Draft Management
    async saveModelDraft(
        dataSourceId: number,
        userId: number,
        modelState: Partial<ModelDraft>
    ): Promise<ModelDraft> {
        const draftKey = this.getModelDraftKey(dataSourceId, userId);

        // Get existing draft to increment version
        const existingDraft = await this.getModelDraft(dataSourceId, userId);
        const version = existingDraft ? existingDraft.version + 1 : 1;

        const draft: ModelDraft = {
            tables: modelState.tables || {},
            relationships: modelState.relationships || [],
            indexes: modelState.indexes || [],
            lastModified: new Date().toISOString(),
            version,
        };

        await this.redis.hmset(draftKey, {
            tables: JSON.stringify(draft.tables),
            relationships: JSON.stringify(draft.relationships),
            indexes: JSON.stringify(draft.indexes),
            lastModified: draft.lastModified,
            version: draft.version.toString(),
        });
        await this.redis.expire(draftKey, RedisTTL.AI_MODEL_DRAFT);

        // Update session activity
        await this.updateSessionActivity(dataSourceId, userId);

        return draft;
    }

    async getModelDraft(dataSourceId: number, userId: number): Promise<ModelDraft | null> {
        const draftKey = this.getModelDraftKey(dataSourceId, userId);
        const data = await this.redis.hgetall(draftKey);

        if (!data || Object.keys(data).length === 0) {
            return null;
        }

        return {
            tables: JSON.parse(data.tables || '{}'),
            relationships: JSON.parse(data.relationships || '[]'),
            indexes: JSON.parse(data.indexes || '[]'),
            lastModified: data.lastModified,
            version: parseInt(data.version, 10),
        };
    }

    async clearModelDraft(dataSourceId: number, userId: number): Promise<void> {
        const draftKey = this.getModelDraftKey(dataSourceId, userId);
        await this.redis.del(draftKey);
    }

    // Schema Context
    async saveSchemaContext(
        dataSourceId: number,
        userId: number,
        schema: SchemaContext
    ): Promise<void> {
        const schemaKey = this.getSchemaContextKey(dataSourceId, userId);
        await this.redis.set(schemaKey, JSON.stringify(schema));
        await this.redis.expire(schemaKey, RedisTTL.AI_SCHEMA_CONTEXT);
    }

    async getSchemaContext(dataSourceId: number, userId: number): Promise<SchemaContext | null> {
        const schemaKey = this.getSchemaContextKey(dataSourceId, userId);
        const data = await this.redis.get(schemaKey);

        if (!data) {
            return null;
        }

        return JSON.parse(data);
    }

    // Bulk Operations
    async getFullSession(dataSourceId: number, userId: number) {
        const [metadata, messages, modelDraft, schemaContext] = await Promise.all([
            this.getSession(dataSourceId, userId),
            this.getMessages(dataSourceId, userId),
            this.getModelDraft(dataSourceId, userId),
            this.getSchemaContext(dataSourceId, userId),
        ]);

        return {
            metadata,
            messages,
            modelDraft,
            schemaContext,
        };
    }

    async clearAllSessionData(dataSourceId: number, userId: number): Promise<void> {
        const keys = [
            this.getConversationKey(dataSourceId, userId),
            this.getMessagesKey(dataSourceId, userId),
            this.getModelDraftKey(dataSourceId, userId),
            this.getSchemaContextKey(dataSourceId, userId),
        ];

        await Promise.all(keys.map((key) => this.redis.del(key)));
    }

    // Check if session exists
    async sessionExists(dataSourceId: number, userId: number): Promise<boolean> {
        const conversationKey = this.getConversationKey(dataSourceId, userId);
        const exists = await this.redis.exists(conversationKey);
        return exists === 1;
    }

    // Get session TTL (time remaining)
    async getSessionTTL(dataSourceId: number, userId: number): Promise<number> {
        const conversationKey = this.getConversationKey(dataSourceId, userId);
        return await this.redis.ttl(conversationKey);
    }

    // Extend session TTL
    async extendSession(dataSourceId: number, userId: number): Promise<void> {
        const keys = [
            this.getConversationKey(dataSourceId, userId),
            this.getMessagesKey(dataSourceId, userId),
            this.getModelDraftKey(dataSourceId, userId),
            this.getSchemaContextKey(dataSourceId, userId),
        ];

        await Promise.all([
            this.redis.expire(keys[0], RedisTTL.AI_SESSION),
            this.redis.expire(keys[1], RedisTTL.AI_MESSAGES),
            this.redis.expire(keys[2], RedisTTL.AI_MODEL_DRAFT),
            this.redis.expire(keys[3], RedisTTL.AI_SCHEMA_CONTEXT),
        ]);
    }
}
