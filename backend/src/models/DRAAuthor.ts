import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    Relation,
    UpdateDateColumn,
} from 'typeorm';
import { DRAArticle } from './DRAArticle.js';

@Entity('dra_authors')
export class DRAAuthor {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'varchar', length: 1000, nullable: true })
    picture?: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    linkedin_url?: string | null;

    @Column({ type: 'varchar', length: 500, nullable: true })
    website_url?: string | null;

    @Column({ type: 'varchar', length: 512, nullable: true })
    bio?: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at!: Date;

    @OneToMany(() => DRAArticle, (article) => article.author)
    articles!: Relation<DRAArticle>[];
}
