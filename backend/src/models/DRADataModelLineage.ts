import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation, CreateDateColumn } from 'typeorm';
import { DRADataModel } from './DRADataModel.js';

@Entity('dra_data_model_lineage')
export class DRADataModelLineage {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    child_data_model_id!: number;

    @Column({ type: 'int' })
    parent_data_model_id!: number;

    @Column({ type: 'text' })
    parent_data_model_name!: string;

    @Column({ type: 'timestamp', nullable: true })
    parent_last_refreshed_at?: Date;

    @CreateDateColumn()
    created_at!: Date;

    @ManyToOne(() => DRADataModel, model => model.child_lineages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'child_data_model_id' })
    child_data_model!: Relation<DRADataModel>;

    @ManyToOne(() => DRADataModel, model => model.parent_lineages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'parent_data_model_id' })
    parent_data_model!: Relation<DRADataModel>;
}
