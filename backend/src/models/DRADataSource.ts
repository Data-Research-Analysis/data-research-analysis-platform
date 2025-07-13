import { Column, Entity, JoinColumn, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataModel } from './DRADataModel.js';
import { DRAProject } from './DRAProject.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails.js';
@Entity('dra_data_sources')
export class DRADataSource {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    name!: string
    @Column({ type: 'enum', enum: [EDataSourceType.POSTGRESQL, EDataSourceType.MYSQL, EDataSourceType.MARIADB, EDataSourceType.MONGODB, EDataSourceType.CSV, EDataSourceType.EXCEL] })
    data_type!: EDataSourceType;
    @Column({ type: 'jsonb' })
    connection_details!: IDBConnectionDetails
    @Column({ type: 'timestamp', nullable: true })
    created_at!: Date

    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_sources)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: Relation<DRAUsersPlatform>
    
    @OneToMany(() => DRADataModel, (dataModel) => dataModel.data_source, { cascade: ["remove", "update"] })
    data_models!: Relation<DRADataModel>[]
    
    @ManyToOne(() => DRAProject, (project) => project.data_sources)
    @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
    project!: Relation<DRAProject>
    
}