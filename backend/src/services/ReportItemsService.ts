import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAReportItem, ReportItemType } from '../models/DRAReportItem.js';
import { DRAReport } from '../models/DRAReport.js';

/**
 * TICKET RPT-001: Report Item Types — Database Schema & API
 *
 * Service layer for creating, reading, updating, and deleting report items
 * with type-specific validation and resolution.
 */

const VALID_ITEM_TYPES: ReportItemType[] = [
    'dashboard',
    'widget',
    'insight',
    'kpi_card',
    'ai_insight',
    'data_table',
    'chart',
    'text_block',
    'comparison_table',
};

/** Fields required per item type in the `payload` column. */
const PAYLOAD_REQUIRED_FIELDS: Partial<Record<ReportItemType, string[]>> = {
    kpi_card: ['column_name', 'aggregation'],
    ai_insight: ['insight_category'],
    data_table: ['columns'],
    chart: ['chart_id'],
    text_block: ['markdown_content'],
    comparison_table: ['dimension_column', 'metrics'],
};

/** Item types that require a data_model_id. */
const REQUIRES_DATA_MODEL: ReportItemType[] = ['kpi_card', 'ai_insight', 'data_table', 'comparison_table'];

export interface ICreateReportItemDTO {
    item_type: ReportItemType;
    ref_id?: number | null;
    widget_id?: string | null;
    display_order?: number;
    title_override?: string | null;
    payload?: Record<string, any> | null;
    data_model_id?: number | null;
}

export interface IUpdateReportItemDTO {
    item_type?: ReportItemType;
    ref_id?: number | null;
    widget_id?: string | null;
    display_order?: number;
    title_override?: string | null;
    payload?: Record<string, any> | null;
    data_model_id?: number | null;
}

export class ReportItemsService {
    private static instance: ReportItemsService;
    private constructor() {}

    public static getInstance(): ReportItemsService {
        if (!ReportItemsService.instance) {
            ReportItemsService.instance = new ReportItemsService();
        }
        return ReportItemsService.instance;
    }

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('Database not available');
        const concreteDriver = await driver.getConcreteDriver();
        if (!concreteDriver) throw new Error('Database driver not available');
        const manager = concreteDriver.manager;
        if (!manager) throw new Error('Database manager not available');
        return manager;
    }

    // ─── Validation ─────────────────────────────────────────────────────────

    /**
     * Validates a report item before create/update.
     * Returns an array of error messages (empty = valid).
     */
    public validate(item: ICreateReportItemDTO | IUpdateReportItemDTO, isCreate: boolean = false): string[] {
        const errors: string[] = [];

        // Validate item_type
        if ('item_type' in item && item.item_type !== undefined) {
            if (!VALID_ITEM_TYPES.includes(item.item_type)) {
                errors.push(`Invalid item_type '${item.item_type}'. Valid types: ${VALID_ITEM_TYPES.join(', ')}`);
            }
        } else if (isCreate) {
            errors.push('item_type is required');
        }

        const itemType = (item as ICreateReportItemDTO).item_type;

        // Type-specific payload validation
        if (itemType && PAYLOAD_REQUIRED_FIELDS[itemType]) {
            const required = PAYLOAD_REQUIRED_FIELDS[itemType]!;
            const payload = item.payload || {};
            for (const field of required) {
                if (payload[field] === undefined || payload[field] === null) {
                    errors.push(`Payload for '${itemType}' must include '${field}'`);
                }
            }
        }

        // data_model_id required for certain types
        if (itemType && REQUIRES_DATA_MODEL.includes(itemType)) {
            const dmId = 'data_model_id' in item ? item.data_model_id : undefined;
            // data_model_id can be in payload or top-level column
            const dmIdInPayload = item.payload?.data_model_id;
            if ((dmId === undefined || dmId === null) && (dmIdInPayload === undefined || dmIdInPayload === null)) {
                errors.push(`Item type '${itemType}' requires a data_model_id`);
            }
        }

        // Dashboard type must have ref_id
        if (itemType === 'dashboard') {
            const refId = 'ref_id' in item ? item.ref_id : undefined;
            if (refId === undefined || refId === null) {
                errors.push('Dashboard items must include a ref_id');
            }
        }

        return errors;
    }

    // ─── CRUD ───────────────────────────────────────────────────────────────

    /**
     * Create a new report item within a report.
     */
    public async createItem(reportId: number, dto: ICreateReportItemDTO): Promise<DRAReportItem> {
        const errors = this.validate(dto, true);
        if (errors.length) {
            const err: any = new Error(`Validation failed: ${errors.join('; ')}`);
            err.status = 400;
            throw err;
        }

        const manager = await this.getManager();

        // Verify report exists
        const report = await manager.findOne(DRAReport, { where: { id: reportId } });
        if (!report) {
            const err: any = new Error('Report not found');
            err.status = 404;
            throw err;
        }

        // If no display_order specified, append at end
        let displayOrder = dto.display_order;
        if (displayOrder === undefined || displayOrder === null) {
            const maxResult = await manager.query(
                `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM dra_report_items WHERE report_id = $1`,
                [reportId],
            );
            displayOrder = maxResult[0]?.next_order ?? 0;
        }

        // If data_model_id is provided in payload but not top-level, promote it
        const dataModelId = dto.data_model_id ?? dto.payload?.data_model_id ?? null;

        const item = manager.create(DRAReportItem, {
            report_id: reportId,
            item_type: dto.item_type,
            ref_id: dto.ref_id ?? null,
            widget_id: dto.widget_id ?? null,
            display_order: displayOrder,
            title_override: dto.title_override ?? null,
            payload: dto.payload ?? {},
            data_model_id: dataModelId,
        });

        const saved = await manager.save(item);

        // Touch report updated_at
        await manager.update(DRAReport, { id: reportId }, { updated_at: new Date() });

        return saved;
    }

    /**
     * Get a single report item by ID (scoped to a report).
     */
    public async getItem(reportId: number, itemId: number): Promise<DRAReportItem | null> {
        const manager = await this.getManager();
        return manager.findOne(DRAReportItem, {
            where: { id: itemId, report_id: reportId },
        });
    }

    /**
     * Get all items for a report, resolved with display data.
     */
    public async getItemsForReport(reportId: number): Promise<any[]> {
        const manager = await this.getManager();
        return manager.query(
            `SELECT
                ri.id, ri.item_type, ri.ref_id, ri.widget_id, ri.display_order,
                ri.title_override, ri.payload, ri.data_model_id,
                -- Resolve display title based on type
                CASE ri.item_type
                    WHEN 'dashboard' THEN COALESCE(ri.title_override, d.name)
                    WHEN 'text_block' THEN COALESCE(ri.title_override, 'Text Block')
                    WHEN 'kpi_card' THEN COALESCE(
                        ri.title_override,
                        ri.payload->>'column_name',
                        'KPI Card'
                    )
                    WHEN 'ai_insight' THEN COALESCE(
                        ri.title_override,
                        ri.payload->>'insight_category',
                        'AI Insight'
                    )
                    WHEN 'data_table' THEN COALESCE(ri.title_override, 'Data Table')
                    WHEN 'chart' THEN COALESCE(
                        ri.title_override,
                        ri.payload->>'chart_type',
                        'Chart'
                    )
                    WHEN 'comparison_table' THEN COALESCE(ri.title_override, 'Comparison Table')
                    WHEN 'widget' THEN COALESCE(ri.title_override, ri.widget_id, 'Widget')
                    WHEN 'insight' THEN COALESCE(ri.title_override, 'Insight')
                    ELSE COALESCE(ri.title_override, 'Item')
                END AS resolved_title,
                -- Dashboard-specific fields
                dem_latest.key AS dashboard_share_key,
                dm.name AS data_model_name
             FROM dra_report_items ri
             LEFT JOIN dra_dashboards d ON d.id = ri.ref_id AND ri.item_type = 'dashboard'
             LEFT JOIN LATERAL (
                 SELECT key
                 FROM dra_dashboards_exported_metadata
                 WHERE dashboard_id = ri.ref_id
                   AND expiry_at > NOW()
                 ORDER BY expiry_at DESC
                 LIMIT 1
             ) dem_latest ON ri.item_type = 'dashboard'
             LEFT JOIN dra_data_models dm ON dm.id = ri.data_model_id
             WHERE ri.report_id = $1
             ORDER BY ri.display_order ASC`,
            [reportId],
        );
    }

    /**
     * Update a single report item.
     */
    public async updateItem(reportId: number, itemId: number, dto: IUpdateReportItemDTO): Promise<DRAReportItem> {
        // Validate if item_type is being changed
        if (dto.item_type) {
            const errors = this.validate(dto as ICreateReportItemDTO, false);
            if (errors.length) {
                const err: any = new Error(`Validation failed: ${errors.join('; ')}`);
                err.status = 400;
                throw err;
            }
        }

        const manager = await this.getManager();
        const existing = await manager.findOne(DRAReportItem, {
            where: { id: itemId, report_id: reportId },
        });

        if (!existing) {
            const err: any = new Error('Report item not found');
            err.status = 404;
            throw err;
        }

        // Merge updates
        if (dto.item_type !== undefined) existing.item_type = dto.item_type;
        if (dto.ref_id !== undefined) existing.ref_id = dto.ref_id;
        if (dto.widget_id !== undefined) existing.widget_id = dto.widget_id;
        if (dto.display_order !== undefined) existing.display_order = dto.display_order;
        if (dto.title_override !== undefined) existing.title_override = dto.title_override;
        if (dto.payload !== undefined) existing.payload = dto.payload;
        if (dto.data_model_id !== undefined) {
            existing.data_model_id = dto.data_model_id;
        } else if (dto.payload?.data_model_id !== undefined) {
            existing.data_model_id = dto.payload.data_model_id;
        }

        const saved = await manager.save(existing);

        // Touch report updated_at
        await manager.update(DRAReport, { id: reportId }, { updated_at: new Date() });

        return saved;
    }

    /**
     * Delete a single report item and re-order remaining items.
     */
    public async deleteItem(reportId: number, itemId: number): Promise<boolean> {
        const manager = await this.getManager();
        const existing = await manager.findOne(DRAReportItem, {
            where: { id: itemId, report_id: reportId },
        });

        if (!existing) {
            const err: any = new Error('Report item not found');
            err.status = 404;
            throw err;
        }

        await manager.remove(existing);

        // Compact display_order after deletion
        await manager.query(
            `UPDATE dra_report_items
             SET display_order = sub.new_order
             FROM (
                 SELECT id, ROW_NUMBER() OVER (ORDER BY display_order) - 1 AS new_order
                 FROM dra_report_items
                 WHERE report_id = $1
             ) sub
             WHERE dra_report_items.id = sub.id AND dra_report_items.report_id = $1`,
            [reportId],
        );

        // Touch report updated_at
        await manager.update(DRAReport, { id: reportId }, { updated_at: new Date() });

        return true;
    }

    /**
     * Reorder items within a report (batch update display_order).
     */
    public async reorderItems(
        reportId: number,
        orderedItemIds: number[],
    ): Promise<boolean> {
        const manager = await this.getManager();

        // Verify all items belong to this report
        const items = await manager.find(DRAReportItem, {
            where: { report_id: reportId },
        });
        const existingIds = new Set(items.map((i) => i.id));
        for (const id of orderedItemIds) {
            if (!existingIds.has(id)) {
                const err: any = new Error(`Item ${id} does not belong to report ${reportId}`);
                err.status = 400;
                throw err;
            }
        }

        // Update display_order in a transaction
        for (let i = 0; i < orderedItemIds.length; i++) {
            await manager.update(DRAReportItem, { id: orderedItemIds[i] }, { display_order: i });
        }

        // Touch report updated_at
        await manager.update(DRAReport, { id: reportId }, { updated_at: new Date() });

        return true;
    }
}