import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';
import { DRADashboard } from './DRADashboard.js';
import { DRAProjectMember } from './DRAProjectMember.js';
@Entity('dra_projects')
export class DRAProject {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    name!: string
    @Column({ type: 'text', nullable: true })
    description!: string
    @Column({ type: 'timestamp', nullable: true })
    created_at!: Date

    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.projects, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: Relation<DRAUsersPlatform>
    
    @OneToMany(() => DRADataSource, (dataSource) => dataSource.project, { cascade: ["remove", "update"] })
    data_sources!: Relation<DRADataSource>[]

    @OneToMany(() => DRADashboard, (visualization) => visualization.project, { cascade: ["remove", "update"] })
    dashboards!: Relation<DRADashboard>[]

    @OneToMany(() => DRAProjectMember, (member) => member.project, { cascade: ["remove", "update"] })
    members!: Relation<DRAProjectMember>[]

}