import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { EPublishStatus } from '../types/EPublishStatus.js';

@Entity('dra_sitemap_entries')
export class DRASitemapEntry {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 2048 })
  url!: string;

  @Column({ type: 'enum', enum: [EPublishStatus.PUBLISHED, EPublishStatus.DRAFT] })
  publish_status!: EPublishStatus;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at!: Date;

  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform>
}
