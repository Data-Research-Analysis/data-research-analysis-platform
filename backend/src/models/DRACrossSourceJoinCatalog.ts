import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { DRADataSource } from './DRADataSource.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

/**
 * Catalog of successful cross-source join relationships
 * Stores join definitions that can be suggested to users when building similar models
 */
@Entity('dra_cross_source_join_catalog')
export class DRACrossSourceJoinCatalog {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int', name: 'left_data_source_id', nullable: true })
    left_data_source_id!: number;

    @Column({ type: 'varchar', length: 255, name: 'left_table_name' })
    left_table_name!: string;

    @Column({ type: 'varchar', length: 255, name: 'left_column_name' })
    left_column_name!: string;

    @Column({ type: 'int', name: 'right_data_source_id', nullable: true })
    right_data_source_id!: number;

    @Column({ type: 'varchar', length: 255, name: 'right_table_name' })
    right_table_name!: string;

    @Column({ type: 'varchar', length: 255, name: 'right_column_name' })
    right_column_name!: string;

    @Column({ type: 'varchar', length: 20, name: 'join_type', default: 'INNER' })
    join_type!: string; // 'INNER', 'LEFT', 'RIGHT', 'FULL'

    @Column({ type: 'int', name: 'usage_count', default: 0 })
    usage_count!: number;

    @Column({ type: 'int', name: 'created_by_user_id', nullable: true })
    created_by_user_id!: number;

    @ManyToOne(() => DRADataSource, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'left_data_source_id' })
    left_data_source!: DRADataSource;

    @ManyToOne(() => DRADataSource, { onDelete: 'CASCADE', nullable: true })
    @JoinColumn({ name: 'right_data_source_id' })
    right_data_source!: DRADataSource;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'created_by_user_id' })
    created_by_user!: DRAUsersPlatform;

    @CreateDateColumn({ type: 'timestamp', name: 'created_at', default: () => 'NOW()' })
    created_at!: Date;
}
