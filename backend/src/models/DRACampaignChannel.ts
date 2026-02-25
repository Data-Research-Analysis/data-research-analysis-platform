import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';
import { DRACampaign } from './DRACampaign.js';

@Entity('dra_campaign_channels')
export class DRACampaignChannel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'campaign_id' })
    campaign_id!: number;

    @Column({ type: 'varchar', length: 50 })
    channel_type!: string;

    @Column({ type: 'int', nullable: true, name: 'data_source_id' })
    data_source_id!: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    channel_name!: string | null;

    @Column({ type: 'boolean', default: false })
    is_offline!: boolean;

    @CreateDateColumn()
    created_at!: Date;

    @ManyToOne(() => DRACampaign, (c) => c.channels, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'campaign_id' })
    campaign!: Relation<DRACampaign>;
}
