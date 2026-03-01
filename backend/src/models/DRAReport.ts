import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAProject } from './DRAProject.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';
import { DRAReportItem } from './DRAReportItem.js';
import { DRAReportShareKey } from './DRAReportShareKey.js';

@Entity('dra_reports')
export class DRAReport {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name!: string;

    @Column({ type: 'text', nullable: true })
    description!: string | null;

    @Column({ type: 'varchar', length: 20, default: 'draft' })
    status!: 'draft' | 'published';

    @Column({ type: 'timestamp', default: () => 'NOW()' })
    created_at!: Date;

    @Column({ type: 'timestamp', default: () => 'NOW()' })
    updated_at!: Date;

    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
    project!: Relation<DRAProject>;

    @Column({ type: 'int', name: 'project_id' })
    project_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'created_by', referencedColumnName: 'id' })
    creator!: Relation<DRAUsersPlatform>;

    @Column({ type: 'int', name: 'created_by' })
    created_by!: number;

    @OneToMany(() => DRAReportItem, (item) => item.report, { cascade: ['insert', 'update', 'remove'] })
    items!: Relation<DRAReportItem>[];

    @OneToMany(() => DRAReportShareKey, (key) => key.report, { cascade: ['insert', 'update', 'remove'] })
    share_keys!: Relation<DRAReportShareKey>[];
}
