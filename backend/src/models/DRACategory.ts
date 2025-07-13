import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAArticleCategory } from './DRAArticleCategory.js';
@Entity('dra_categories')
export class DRACategory {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column({ type: 'varchar', length: 512 })
  title!: string;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.categories)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: Relation<DRAUsersPlatform>
  
  @OneToMany(() => DRAArticleCategory, (dataArticleCategory) => dataArticleCategory.category)
  dra_articles_categories!: Relation<DRAArticleCategory>[]
}