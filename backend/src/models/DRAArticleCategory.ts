import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAArticle } from './DRAArticle.js';
import { DRACategory } from './DRACategory.js';
@Entity('dra_articles_categories')
export class DRAArticleCategory {
  
  @PrimaryColumn({ type: 'bigint' })
  article_id!: number;

  @PrimaryColumn({ type: 'bigint' })
  category_id!: number;
  
  @ManyToOne(() => DRAArticle, (article) => article.dra_articles_categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'article_id'})
  article!: Relation<DRAArticle>
  
  @ManyToOne(() => DRACategory, (category) => category.dra_articles_categories)
  @JoinColumn({ name: 'category_id'})
  category!: Relation<DRACategory>
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.articles_categories)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform>
}