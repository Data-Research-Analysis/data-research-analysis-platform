import { Column, Entity, JoinTable, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform';
import { DRADataSource } from './DRADataSource';
@Entity('dra_data_models')
export class DRADataModel {
    @PrimaryGeneratedColumn()
    id: number
    @Column({ type: 'varchar', length: 255 })
    schema: string
    @Column({ type: 'varchar', length: 255 })
    name: string
    @Column({ type: 'text' })
    sql_query: string
    @Column({ type: 'jsonb' })
    query: JSON
    
    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_sources)
    @JoinTable()
    users_platform: DRAUsersPlatform
    @ManyToOne(() => DRADataSource, (dataSource) => dataSource.data_models)
    @JoinTable()
    data_source: DRADataSource
}
