import { Repository, DataSource, LessThan, IsNull, MoreThan } from 'typeorm';
import { DRANotification } from '../models/DRANotification.js';
import { DRAUsersPlatform } from '../models/DRAUsersPlatform.js';
import {
    ICreateNotificationData,
    INotificationData,
    NotificationType
} from '../types/NotificationTypes.js';
import { SocketIODriver } from '../drivers/SocketIODriver.js';
import { ISocketEvent } from '../types/ISocketEvent.js';

/**
 * Custom error for notification not found
 */
export class NotificationNotFoundError extends Error {
    constructor(message: string = 'Notification not found') {
        super(message);
        this.name = 'NotificationNotFoundError';
    }
}

/**
 * Custom error for unauthorized notification access
 */
export class UnauthorizedNotificationAccessError extends Error {
    constructor(message: string = 'Unauthorized access to notification') {
        super(message);
        this.name = 'UnauthorizedNotificationAccessError';
    }
}

/**
 * NotificationProcessor - Singleton class for managing notifications
 * 
 * Handles all CRUD operations for user notifications including:
 * - Creating notifications
 * - Fetching user notifications with pagination
 * - Marking notifications as read/unread
 * - Deleting notifications
 * - Getting unread counts
 * - Cleaning up expired notifications
 */
export class NotificationProcessor {
    private static instance: NotificationProcessor;
    private notificationRepository!: Repository<DRANotification>;
    private userRepository!: Repository<DRAUsersPlatform>;
    private dataSource!: DataSource;
    private socketIO!: SocketIODriver;

    /**
     * Private constructor to enforce singleton pattern
     */
    private constructor() { }

    /**
     * Get singleton instance of NotificationProcessor
     */
    public static getInstance(): NotificationProcessor {
        if (!NotificationProcessor.instance) {
            NotificationProcessor.instance = new NotificationProcessor();
        }
        return NotificationProcessor.instance;
    }

    /**
     * Initialize the processor with database connection
     * Must be called before using any methods
     */
    public initialize(dataSource: DataSource): void {
        this.dataSource = dataSource;
        this.notificationRepository = dataSource.getRepository(DRANotification);
        this.userRepository = dataSource.getRepository(DRAUsersPlatform);
        this.socketIO = SocketIODriver.getInstance();
        console.log('NotificationProcessor initialized with Socket.IO support');
    }

    /**
     * Create a new notification
     * 
     * @param data - Notification data
     * @returns Created notification with ID
     * @throws Error if user doesn't exist
     */
    public async createNotification(data: ICreateNotificationData): Promise<INotificationData> {
        // Verify user exists
        const userExists = await this.userRepository.findOne({
            where: { id: data.userId }
        });

        if (!userExists) {
            throw new Error(`User with ID ${data.userId} not found`);
        }

        // Create notification
        const notification = this.notificationRepository.create({
            user: { id: data.userId },
            type: data.type,
            title: data.title,
            message: data.message,
            link: data.link || null,
            metadata: data.metadata || {},
            expiresAt: data.expiresAt || null,
            isRead: false,
            readAt: null
        });

        const savedNotification = await this.notificationRepository.save(notification);
        const notificationData = this.mapToNotificationData(savedNotification);

        // Emit real-time Socket.IO event to user
        try {
            await this.socketIO.emitToUser(
                data.userId,
                ISocketEvent.NOTIFICATION_NEW,
                { notification: notificationData }
            );
        } catch (error) {
            console.error('Failed to emit notification event via Socket.IO:', error);
            // Don't fail the whole operation if Socket.IO emission fails
        }

        return notificationData;
    }

    /**
     * Get notifications for a user with pagination
     * 
     * @param userId - User ID
     * @param page - Page number (1-indexed)
     * @param limit - Items per page
     * @returns Paginated notifications and total count
     */
    public async getUserNotifications(
        userId: number,
        page: number = 1,
        limit: number = 20
    ): Promise<{ notifications: INotificationData[]; total: number }> {
        const skip = (page - 1) * limit;

        // Build query to exclude expired notifications
        const queryBuilder = this.notificationRepository
            .createQueryBuilder('notification')
            .where('notification.user = :userId', { userId })
            .andWhere('(notification.expires_at IS NULL OR notification.expires_at > :now)', {
                now: new Date()
            })
            .orderBy('notification.created_at', 'DESC')
            .skip(skip)
            .take(limit);

        const [notifications, total] = await queryBuilder.getManyAndCount();

        return {
            notifications: notifications.map(n => this.mapToNotificationData(n)),
            total
        };
    }

    /**
     * Mark a notification as read
     * 
     * @param notificationId - Notification ID
     * @param userId - User ID (for authorization)
     * @throws NotificationNotFoundError if notification doesn't exist
     * @throws UnauthorizedNotificationAccessError if notification doesn't belong to user
     */
    public async markAsRead(notificationId: number, userId: number): Promise<void> {
        const notification = await this.notificationRepository.findOne({
            where: { id: notificationId },
            relations: ['user']
        });

        if (!notification) {
            throw new NotificationNotFoundError(`Notification with ID ${notificationId} not found`);
        }

        if (notification.user.id !== userId) {
            throw new UnauthorizedNotificationAccessError(
                `User ${userId} is not authorized to access notification ${notificationId}`
            );
        }

        notification.isRead = true;
        notification.readAt = new Date();

        await this.notificationRepository.save(notification);

        // Emit real-time Socket.IO event
        try {
            await this.socketIO.emitToUser(
                userId,
                ISocketEvent.NOTIFICATION_READ,
                { notificationId, readAt: notification.readAt }
            );
        } catch (error) {
            console.error('Failed to emit notification read event:', error);
        }
    }

    /**
     * Mark all notifications as read for a user
     * 
     * @param userId - User ID
     */
    public async markAllAsRead(userId: number): Promise<void> {
        await this.notificationRepository
            .createQueryBuilder()
            .update(DRANotification)
            .set({
                isRead: true,
                readAt: new Date()
            })
            .where('user = :userId', { userId })
            .andWhere('is_read = :isRead', { isRead: false })
            .execute();

        // Emit real-time Socket.IO event
        try {
            await this.socketIO.emitToUser(
                userId,
                ISocketEvent.NOTIFICATION_MARK_ALL_READ,
                { timestamp: new Date() }
            );
        } catch (error) {
            console.error('Failed to emit mark all read event:', error);
        }
    }

    /**
     * Delete a notification
     * 
     * @param notificationId - Notification ID
     * @param userId - User ID (for authorization)
     * @throws NotificationNotFoundError if notification doesn't exist
     * @throws UnauthorizedNotificationAccessError if notification doesn't belong to user
     */
    public async deleteNotification(notificationId: number, userId: number): Promise<void> {
        const notification = await this.notificationRepository.findOne({
            where: { id: notificationId },
            relations: ['user']
        });

        if (!notification) {
            throw new NotificationNotFoundError(`Notification with ID ${notificationId} not found`);
        }

        if (notification.user.id !== userId) {
            throw new UnauthorizedNotificationAccessError(
                `User ${userId} is not authorized to delete notification ${notificationId}`
            );
        }

        await this.notificationRepository.remove(notification);

        // Emit real-time Socket.IO event
        try {
            await this.socketIO.emitToUser(
                userId,
                ISocketEvent.NOTIFICATION_DELETED,
                { notificationId }
            );
        } catch (error) {
            console.error('Failed to emit notification deleted event:', error);
        }
    }

    /**
     * Get unread notification count for a user
     * 
     * @param userId - User ID
     * @returns Count of unread notifications (excluding expired)
     */
    public async getUnreadCount(userId: number): Promise<number> {
        return await this.notificationRepository
            .createQueryBuilder('notification')
            .where('notification.user = :userId', { userId })
            .andWhere('notification.is_read = :isRead', { isRead: false })
            .andWhere('(notification.expires_at IS NULL OR notification.expires_at > :now)', {
                now: new Date()
            })
            .getCount();
    }

    /**
     * Cleanup expired notifications
     * Should be called by a cron job
     * 
     * @returns Number of notifications deleted
     */
    public async cleanupExpiredNotifications(): Promise<number> {
        const result = await this.notificationRepository
            .createQueryBuilder()
            .delete()
            .from(DRANotification)
            .where('expires_at < :now', { now: new Date() })
            .execute();

        return result.affected || 0;
    }

    /**
     * Map DRANotification entity to INotificationData interface
     */
    private mapToNotificationData(notification: DRANotification): INotificationData {
        return {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            link: notification.link,
            metadata: notification.metadata,
            isRead: notification.isRead,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
            expiresAt: notification.expiresAt
        };
    }
}
