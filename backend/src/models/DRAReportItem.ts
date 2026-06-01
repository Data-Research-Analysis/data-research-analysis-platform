import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Relation } from 'typeorm';
import { DRAReport } from './DRAReport.js';

/**
 * All supported report item types.
 *  - dashboard (legacy) — references a dashboard via ref_id
 *  - widget / insight (legacy) — existing types preserved for backward compatibility
 *  - kpi_card — aggregated metric card with optional comparison period
 *  - ai_insight — AI-generated insight display
 *  - data_table — sortable/filterable data table
 *  - chart — reference to a chart component
 *  - text_block — user-authored markdown content
 *  - comparison_table — dimension-grouped metric comparison
 */
export type ReportItemType =
    | 'dashboard'
    | 'widget'
    | 'insight'
    | 'kpi_card'
    | 'ai_insight'
    | 'data_table'
    | 'chart'
    | 'text_block'
    | 'comparison_table';

@Entity('dra_report_items')
export class DRAReportItem {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 30 })
    item_type!: ReportItemType;

    @Column({ type: 'int', nullable: true })
    ref_id!: number | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    widget_id!: string | null;

    @Column({ type: 'int', default: 0 })
    display_order!: number;

    @Column({ type: 'varchar', length: 255, nullable: true })
    title_override!: string | null;

    /**
     * Type-specific configuration/data stored as JSON.
     *
     * Payload shapes per item_type:
     *  - kpi_card:        { column_name: string, aggregation: 'sum'|'avg'|'count'|'min'|'max', comparison_period?: string }
     *  - ai_insight:      { data_model_id: number, insight_category: string, insight_text?: string, severity?: 'info'|'warning'|'critical' }
     *  - data_table:      { columns: string[], sort_config?: { column: string, direction: 'asc'|'desc' }, filter_config?: Record<string, any> }
     *  - chart:           { dashboard_id?: number, chart_id: string, chart_type?: string }
     *  - text_block:      { markdown_content: string }
     *  - comparison_table:{ dimension_column: string, metrics: string[], sort_by?: string, sort_direction?: 'asc'|'desc' }
     *  - dashboard:       (legacy — no payload, uses ref_id)
     *  - widget/insight:  (legacy — no payload, uses ref_id/widget_id)
     */
    @Column({ type: 'jsonb', nullable: true, default: () => "'{}'::jsonb" })
    payload!: Record<string, any> | null;

    /**
     * Optional reference to a data model (used by kpi_card, ai_insight, data_table, comparison_table).
     */
    @Column({ type: 'int', nullable: true })
    data_model_id!: number | null;

    @ManyToOne(() => DRAReport, (report) => report.items, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'report_id', referencedColumnName: 'id' })
    report!: Relation<DRAReport>;

    @Column({ type: 'int', name: 'report_id' })
    report_id!: number;
}
