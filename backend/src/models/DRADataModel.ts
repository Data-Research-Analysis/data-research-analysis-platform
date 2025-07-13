import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRADataSource } from './DRADataSource.js';
@Entity('dra_data_models')
export class DRADataModel {
    @PrimaryGeneratedColumn()
    id!: number
    @Column({ type: 'varchar', length: 255 })
    schema!: string
    @Column({ type: 'varchar', length: 255 })
    name!: string
    @Column({ type: 'text' })
    sql_query!: string
    @Column({ type: 'jsonb' })
    query!: JSON
        
    @ManyToOne(() => DRAUsersPlatform, (usersPlatform) => usersPlatform.data_models)
    @JoinColumn({ name: 'users_platform_id', referencedColumnName: 'id' })
    users_platform!: Relation<DRAUsersPlatform>
    
    @ManyToOne(() => DRADataSource, (dataSource) => dataSource.data_models)
    @JoinColumn({ name: 'data_source_id', referencedColumnName: 'id' })
    data_source!: Relation<DRADataSource>
}
