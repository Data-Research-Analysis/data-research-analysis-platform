import { Column, Entity, JoinTable, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataModel } from './DRADataModel';
import { DRAProject } from './DRAProject';
import { EDataSourceType } from '../types/EDataSourceType';
import { Json } from 'sequelize/types/utils';
import { IDBConnectionDetails } from '../types/IDBConnectionDetails';
@Entity('dra_data_sources')
export class DRADataSource {
    @PrimaryGeneratedColumn()
    id: number
    @Column({ type: 'varchar', length: 255 })
    name: string
    @Column({ type: 'enum', enum: [EDataSourceType.POSTGRESQL, EDataSourceType.MYSQL, EDataSourceType.MARIADB, EDataSourceType.MONGODB, EDataSourceType.CSV, EDataSourceType.EXCEL] })
    data_type: EDataSourceType;
    @Column({ type: 'jsonb' })
    connection_details: IDBConnectionDetails
    @Column({ type: 'timestamp', nullable: true })
    created_at: Date

    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_sources)
    @JoinTable()
    users_platform: DRAUsersPlatform
    @OneToMany(() => DRADataModel, (dataModel) => dataModel.data_source, { cascade: ["remove", "update"] })
    @JoinTable()
    data_models: DRADataModel[]
    @ManyToOne(() => DRAProject, (project) => project.data_sources)
    @JoinTable()
    project: DRAProject
    
}