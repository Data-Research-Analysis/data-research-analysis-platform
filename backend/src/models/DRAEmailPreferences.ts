import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

@Entity('dra_email_preferences')
export class DRAEmailPreferences {
    @PrimaryGeneratedColumn()
    id!: number;
    
    @Column({ type: 'integer', unique: true })
    user_id!: number;
    
    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: DRAUsersPlatform;
    
    @Column({ type: 'boolean', default: true })
    subscription_updates!: boolean;
    
    @Column({ type: 'boolean', default: true })
    expiration_warnings!: boolean;
    
    @Column({ type: 'boolean', default: true })
    renewal_reminders!: boolean;
    
    @Column({ type: 'boolean', default: false })
    promotional_emails!: boolean;
    
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;
    
    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updated_at!: Date;
}
