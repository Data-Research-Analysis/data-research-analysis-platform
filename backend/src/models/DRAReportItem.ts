import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAReport } from './DRAReport.js';

@Entity('dra_report_items')
export class DRAReportItem {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 20 })
    item_type!: 'dashboard' | 'widget' | 'insight';

    @Column({ type: 'int', nullable: true })
    ref_id!: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    widget_id!: string | null;

    @Column({ type: 'int', default: 0 })
    display_order!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    title_override!: string | null;

    @ManyToOne(() => DRAReport, (report) => report.items, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'report_id', referencedColumnName: 'id' })
    report!: Relation<DRAReport>;

    @Column({ type: 'int', name: 'report_id' })
    report_id!: number;
}
