import { randomUUID } from 'crypto';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRAReport } from '../models/DRAReport.js';
import { DRAReportItem } from '../models/DRAReportItem.js';
import { DRAReportShareKey } from '../models/DRAReportShareKey.js';

export interface IReportItemDTO {
    item_type: 'dashboard' | 'widget' | 'insight';
    ref_id?: number | null;
    widget_id?: string | null;
    display_order: number;
    title_override?: string | null;
}

export class ReportProcessor {
    private static instance: ReportProcessor;
    private constructor() {}

    public static getInstance(): ReportProcessor {
        if (!ReportProcessor.instance) {
            ReportProcessor.instance = new ReportProcessor();
        }
        return ReportProcessor.instance;
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

    /** List all reports for a project, including share key info and item count. */
    public async getReports(projectId: number): Promise<any[]> {
        const manager = await this.getManager();
        const rows = await manager.query(
            `SELECT
                r.id, r.project_id, r.created_by, r.name, r.description,
                r.status, r.created_at, r.updated_at,
                CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
                (SELECT COUNT(*) FROM dra_report_items ri WHERE ri.report_id = r.id)::int AS items_count,
                sk.key AS share_key,
                sk.expiry_at AS share_expires_at
             FROM dra_reports r
             LEFT JOIN dra_users_platform u ON u.id = r.created_by
             LEFT JOIN dra_report_share_keys sk ON sk.report_id = r.id
             WHERE r.project_id = $1
             ORDER BY r.updated_at DESC`,
            [projectId],
        );
        return rows;
    }

    /** Get a single report with its ordered items. */
    public async getReport(reportId: number): Promise<any | null> {
        const manager = await this.getManager();
        const rows = await manager.query(
            `SELECT
                r.id, r.project_id, r.created_by, r.name, r.description,
                r.status, r.created_at, r.updated_at,
                CONCAT(u.first_name, ' ', u.last_name) AS created_by_name,
                sk.key AS share_key,
                sk.expiry_at AS share_expires_at
             FROM dra_reports r
             LEFT JOIN dra_users_platform u ON u.id = r.created_by
             LEFT JOIN dra_report_share_keys sk ON sk.report_id = r.id
             WHERE r.id = $1`,
            [reportId],
        );
        if (!rows.length) return null;
        const report = rows[0];

        report.items = await manager.query(
            `SELECT ri.id, ri.item_type, ri.ref_id, ri.widget_id, ri.display_order, ri.title_override,
                    COALESCE(ri.title_override, d.name) AS resolved_title,
                    dem_latest.key AS dashboard_share_key
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
             WHERE ri.report_id = $1
             ORDER BY ri.display_order ASC`,
            [reportId],
        );
        return report;
    }

    /** Resolve a public share key to the report + its items (no auth). */
    public async getReportByKey(key: string): Promise<any | null> {
        const manager = await this.getManager();
        const keys = await manager.query(
            `SELECT report_id, expiry_at FROM dra_report_share_keys WHERE key = $1`,
            [key],
        );
        if (!keys.length) return null;
        const { report_id, expiry_at } = keys[0];
        if (new Date(expiry_at) < new Date()) return null; // expired
        return this.getReport(report_id);
    }

    /** Create a new draft report. */
    public async createReport(
        projectId: number,
        userId: number,
        name: string,
        description?: string | null,
    ): Promise<DRAReport> {
        const manager = await this.getManager();
        const report = manager.create(DRAReport, {
            project_id: projectId,
            created_by: userId,
            name: name.trim(),
            description: description?.trim() || null,
            status: 'draft',
            created_at: new Date(),
            updated_at: new Date(),
        });
        return manager.save(report);
    }

    /** Update report metadata (name, description, status). */
    public async updateReport(
        reportId: number,
        fields: Partial<{ name: string; description: string | null; status: 'draft' | 'published' }>,
    ): Promise<boolean> {
        const manager = await this.getManager();
        const update: Record<string, any> = { updated_at: new Date() };
        if (fields.name !== undefined) update.name = fields.name.trim();
        if (fields.description !== undefined) update.description = fields.description?.trim() || null;
        if (fields.status !== undefined) update.status = fields.status;
        await manager.update(DRAReport, { id: reportId }, update);
        return true;
    }

    /** Publish a report (sets status to 'published'). */
    public async publishReport(reportId: number): Promise<boolean> {
        return this.updateReport(reportId, { status: 'published' });
    }

    /** Delete a report (cascades to items and share keys). */
    public async deleteReport(reportId: number): Promise<boolean> {
        const manager = await this.getManager();
        await manager.delete(DRAReport, { id: reportId });
        return true;
    }

    /** Replace the item list for a report. */
    public async updateItems(reportId: number, items: IReportItemDTO[]): Promise<boolean> {
        const manager = await this.getManager();
        // Delete existing items
        await manager.delete(DRAReportItem, { report_id: reportId });
        // Insert new ordered items
        if (items.length) {
            const entities = items.map((item, idx) =>
                manager.create(DRAReportItem, {
                    report_id: reportId,
                    item_type: item.item_type,
                    ref_id: item.ref_id ?? null,
                    widget_id: item.widget_id ?? null,
                    display_order: item.display_order ?? idx,
                    title_override: item.title_override ?? null,
                }),
            );
            await manager.save(entities);
        }
        // Touch updated_at on the report
        await manager.update(DRAReport, { id: reportId }, { updated_at: new Date() });
        return true;
    }

    /** Generate (or replace) a public share key for the report. */
    public async generateShareKey(
        reportId: number,
        userId: number,
        expiryHours: number,
    ): Promise<{ key: string; expiresAt: Date }> {
        const manager = await this.getManager();
        // Revoke any existing key for this report (one key per report)
        await manager.delete(DRAReportShareKey, { report_id: reportId });

        const key = randomUUID();
        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
        const shareKey = manager.create(DRAReportShareKey, {
            report_id: reportId,
            created_by: userId,
            key,
            created_at: new Date(),
            expiry_at: expiresAt,
        });
        await manager.save(shareKey);
        return { key, expiresAt };
    }

    /** Remove the share key for a report. */
    public async revokeShareKey(reportId: number): Promise<boolean> {
        const manager = await this.getManager();
        await manager.delete(DRAReportShareKey, { report_id: reportId });
        return true;
    }

    /** Verify that a report belongs to the given project (for ownership checks). */
    public async reportBelongsToProject(reportId: number, projectId: number): Promise<boolean> {
        const manager = await this.getManager();
        const rows = await manager.query(
            `SELECT id FROM dra_reports WHERE id = $1 AND project_id = $2`,
            [reportId, projectId],
        );
        return rows.length > 0;
    }
}
