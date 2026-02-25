import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
    UpdateDateColumn,
} from 'typeorm';
import { DRACampaignChannel } from './DRACampaignChannel.js';

@Entity('dra_campaign_offline_data')
export class DRACampaignOfflineData {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'campaign_channel_id' })
    campaign_channel_id!: number;

    @Column({ type: 'date' })
    entry_date!: string;

    @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
    actual_spend!: number;

    @Column({ type: 'bigint', nullable: true, default: 0 })
    impressions_estimated!: number | null;

    @Column({ type: 'int', nullable: true, default: 0 })
    leads_generated!: number | null;

    @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
    pipeline_value!: number | null;

    @Column({ type: 'text', nullable: true })
    notes!: string | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    @ManyToOne(() => DRACampaignChannel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campaign_channel_id' })
    channel!: Relation<DRACampaignChannel>;
}
