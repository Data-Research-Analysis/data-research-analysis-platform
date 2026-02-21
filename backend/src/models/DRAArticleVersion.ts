import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAArticle } from './DRAArticle.js';

@Entity('dra_article_versions')
export class DRAArticleVersion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  version_number!: number;

  @Column({ type: 'varchar', length: 512 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  content_markdown?: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  change_summary?: string;

  @Column({ type: 'integer' })
  article_id!: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;

  @ManyToOne(() => DRAArticle, (article) => article.dra_article_versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id' })
  article!: Relation<DRAArticle>;

  @ManyToOne(() => DRAUsersPlatform, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform?: Relation<DRAUsersPlatform>;
}
