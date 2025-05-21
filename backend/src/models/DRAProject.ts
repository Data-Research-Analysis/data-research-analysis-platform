import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataSource } from './DRADataSource';
@Entity('dra_projects')
export class DRAProject {
    @PrimaryGeneratedColumn()
    id: number
    @Column({ type: 'varchar', length: 255 })
    name: string
    @Column({ type: 'timestamp', nullable: true })
    created_at: Date

    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.projects)
    @JoinTable()
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform: DRAUsersPlatform
    @OneToMany(() => DRADataSource, (dataSource) => dataSource.project, { cascade: ["remove", "update"] })
    @JoinTable()
    data_sources: DRADataSource[]
}