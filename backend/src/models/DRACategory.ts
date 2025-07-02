import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRAArticleCategory } from './DRAArticleCategory';
@Entity('dra_categories')
export class DRACategory {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ type: 'varchar', length: 512 })
  title: string;
  
  @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.categories)
  @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
  users_platform!: DRAUsersPlatform
  
  @OneToMany(() => DRAArticleCategory, (dataArticleCategory) => dataArticleCategory.category)
  dra_articles_categories!: DRAArticleCategory[]
}