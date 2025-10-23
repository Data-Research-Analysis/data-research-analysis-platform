import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('dra_private_beta_users')
export class DRAPrivateBetaUsers {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    first_name!: string
    @Column({ type: 'varchar', length: 255 })
    last_name!: string
    @Column({ type: 'varchar', length: 255 })
    phone_number!: string
    @Column({ type: 'varchar', length: 320 })
    business_email!: string
    @Column({ type: 'varchar', length: 255 })
    company_name!: string
    @Column({ type: 'varchar', length: 255 })
    country!: string
    @Column({ type: 'boolean', default: false })
    agree_to_receive_updates!: boolean
    @Column({ type: 'timestamp with time zone', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date
}