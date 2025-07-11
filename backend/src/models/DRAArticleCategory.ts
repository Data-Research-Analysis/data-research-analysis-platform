import { Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAArticle } from './DRAArticle.js';
import { DRACategory } from './DRACategory.js';
@Entity('dra_articles_categories')
export class DRAArticleCategory {
  
  @PrimaryColumn()
  article_id!: number
  @PrimaryColumn()
  category_id!: number
  
  @ManyToOne(() => DRAArticle, (article) => article.dra_articles_categories, { cascade: ["remove", "update"] })
  @JoinColumn({ name: 'article_id'})
  article!: DRAArticle
  
  @ManyToOne(() => DRACategory, (category) => category.dra_articles_categories, { cascade: ["remove", "update"] })
  @JoinColumn({ name: 'category_id'})
  category!: DRACategory
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.articles_categories)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: DRAUsersPlatform
}