import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAArticleCategory } from './DRAArticleCategory.js';
import { EPublishStatus } from '../types/EPublishStatus.js';
@Entity('dra_articles')
export class DRAArticle {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column({ type: 'varchar', length: 512 })
  title!: string;
  @Column({ type: 'text' })
  content!: string;
  @Column({ type: 'enum', enum: [EPublishStatus.PUBLISHED, EPublishStatus.DRAFT] })
  publish_status!: EPublishStatus;
  @Column({ type: 'varchar', length: 255 })
  slug!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.articles)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: DRAUsersPlatform
  
  @OneToMany(() => DRAArticleCategory, (dataArticleCategory) => dataArticleCategory.article)
  dra_articles_categories!: DRAArticleCategory[]

}