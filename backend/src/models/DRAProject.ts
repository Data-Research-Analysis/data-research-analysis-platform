import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataSource } from './DRADataSource';
import { DRADashboard } from './DRADashboard';
@Entity('dra_projects')
export class DRAProject {
    @PrimaryGeneratedColumn()
    id: number
    @Column({ type: 'varchar', length: 255 })
    name: string
    @Column({ type: 'timestamp', nullable: true })
    created_at: Date

    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.projects)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: DRAUsersPlatform
    
    @OneToMany(() => DRADataSource, (dataSource) => dataSource.project, { cascade: ["remove", "update"] })
    data_sources!: DRADataSource[]

    @OneToMany(() => DRADashboard, (visualization) => visualization.project, { cascade: ["remove", "update"] })
    dashboards!: DRADashboard[]

}