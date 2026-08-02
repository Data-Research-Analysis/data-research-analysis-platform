import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dra_blog_digest_sends')
export class DRABlogDigestSend {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', default: 0 })
    sent_count!: number;

    @CreateDateColumn({ type: 'timestamptz' })
    sent_at!: Date;
}
