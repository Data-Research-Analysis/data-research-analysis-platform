import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: 'dra:ai:',
    retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
};

// Create Redis client instance
let redisClient: Redis | null = null;

export const getRedisClient = (): Redis => {
    if (!redisClient) {
        redisClient = new Redis(redisConfig);

        redisClient.on('connect', () => {
            console.log('Redis client connected');
        });

        redisClient.on('error', (err) => {
            console.error('Redis client error:', err);
        });

        redisClient.on('ready', () => {
            console.log('Redis client ready');
        });
    }

    return redisClient;
};

export const closeRedisClient = async (): Promise<void> => {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        console.log('Redis client disconnected');
    }
};

// Redis key TTL configurations
export const RedisTTL = {
    AI_SESSION: 86400, // 24 hours for AI session data
    AI_MESSAGES: 86400, // 24 hours for message history
    AI_MODEL_DRAFT: 86400, // 24 hours for model drafts
    AI_SCHEMA_CONTEXT: 86400, // 24 hours for schema context
};
