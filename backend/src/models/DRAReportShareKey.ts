import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAReport } from './DRAReport.js';
import { DRAUsersPlatform } from './DRAUsersPlatform.js';

@Entity('dra_report_share_keys')
export class DRAReportShareKey {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 1024, unique: true })
    key!: string;

    @Column({ type: 'timestamp' })
    created_at!: Date;

    @Column({ type: 'timestamp' })
    expiry_at!: Date;

    @ManyToOne(() => DRAReport, (report) => report.share_keys, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'report_id', referencedColumnName: 'id' })
    report!: Relation<DRAReport>;

    @Column({ type: 'int', name: 'report_id' })
    report_id!: number;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'created_by', referencedColumnName: 'id' })
    creator!: Relation<DRAUsersPlatform>;

    @Column({ type: 'int', name: 'created_by' })
    created_by!: number;
}
