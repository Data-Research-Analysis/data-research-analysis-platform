import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
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
  @Column({ type: 'text', nullable: true })
  content_markdown?: string;
  @Column({ type: 'enum', enum: [EPublishStatus.PUBLISHED, EPublishStatus.DRAFT] })
  publish_status!: EPublishStatus;
  @Column({ type: 'varchar', length: 255 })
  slug!: string;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.articles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform>
  
  @OneToMany(() => DRAArticleCategory, (dataArticleCategory) => dataArticleCategory.article)
  dra_articles_categories!: Relation<DRAArticleCategory>[]

}