import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('dra_user')
export class DRAUser {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    email!: string
    @Column({ type: 'timestamp', nullable: true })
    created_at!: Date
}