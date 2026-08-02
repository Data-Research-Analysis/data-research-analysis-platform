import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from 'typeorm';
import { DRABlogDigestSend } from './DRABlogDigestSend.js';
import { DRAArticle } from './DRAArticle.js';

@Entity('dra_blog_digest_articles')
export class DRABlogDigestArticle {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'digest_id', type: 'integer' })
    digest_id!: number;

    @Column({ name: 'article_id', type: 'integer' })
    article_id!: number;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;

    @ManyToOne(() => DRABlogDigestSend, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'digest_id' })
    digest!: Relation<DRABlogDigestSend>;

    @ManyToOne(() => DRAArticle, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'article_id' })
    article!: Relation<DRAArticle>;
}
