import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRAArticleCategory } from './DRAArticleCategory';
import { EPublishStatus } from '../types/EPublishStatus';
@Entity('dra_articles')
export class DRAArticle {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'varchar', length: 512 })
  title: string;
  @Column({ type: 'text' })
  content: string;
  @Column({ type: 'enum', enum: [EPublishStatus.PUBLISHED, EPublishStatus.DRAFT] })
  publish_status: EPublishStatus;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.articles)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: DRAUsersPlatform
  
  @OneToMany(() => DRAArticleCategory, (dataArticleCategory) => dataArticleCategory.article)
  dra_articles_categories!: DRAArticleCategory[]

}