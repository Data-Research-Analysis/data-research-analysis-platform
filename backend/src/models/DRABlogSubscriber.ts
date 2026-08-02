import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('dra_blog_subscribers')
export class DRABlogSubscriber {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    name!: string | null;

    @CreateDateColumn({ type: 'timestamptz' })
    created_at!: Date;
}
