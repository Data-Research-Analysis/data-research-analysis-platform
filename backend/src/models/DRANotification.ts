import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    type Relation
} from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { NotificationType } from '../types/NotificationTypes.js';

/**
 * Notification Entity
 * 
 * Stores user notifications for various platform events including:
 * - Project invitations and membership changes
 * - Subscription updates and expirations
 * - Backup completion status (admin only)
 * 
 * Notifications support:
 * - Real-time delivery via Socket.IO
 * - Read/unread status tracking
 * - Click-to-navigate links
 * - Automatic expiration
 * - Rich metadata in JSON format
 */
@Entity('dra_notifications')
export class DRANotification {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({
        type: 'enum',
        enum: NotificationType,
        name: 'type'
    })
    type!: NotificationType;

    @Column({ type: 'varchar', length: 255 })
    title!: string;

    @Column({ type: 'text' })
    message!: string;

    @Column({ type: 'varchar', length: 512, nullable: true })
    link!: string | null;

    @Column({ type: 'jsonb', default: {} })
    metadata!: Record<string, any>;

    @Column({ type: 'boolean', default: false, name: 'is_read' })
    isRead!: boolean;

    @Column({ type: 'timestamp', nullable: true, name: 'read_at' })
    readAt!: Date | null;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
    createdAt!: Date;

    @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
    expiresAt!: Date | null;
}
