import { getAppDataSource } from '../datasources/PostgresDS.js';

/**
 * Resolve the owning organization id for a project (or data model).
 *
 * Credit metering needs the org at every action boundary; callers frequently
 * only hold a project_id / data_model_id. These helpers keep the resolution
 * in one place and swallow DB errors so metering never breaks the action.
 */
export async function resolveProjectOrganizationId(projectId: number): Promise<number | null> {
    if (!projectId || !Number.isFinite(projectId)) return null;
    try {
        const dataSource = await getAppDataSource();
        const rows = await dataSource.query(
            `SELECT organization_id FROM dra_projects WHERE id = $1`,
            [projectId],
        );
        return rows?.[0]?.organization_id ? Number(rows[0].organization_id) : null;
    } catch (err) {
        console.warn('[orgResolver] Failed to resolve project org:', (err as Error)?.message);
        return null;
    }
}

export async function resolveDataModelOrganizationId(dataModelId: number): Promise<number | null> {
    if (!dataModelId || !Number.isFinite(dataModelId)) return null;
    try {
        const dataSource = await getAppDataSource();
        const rows = await dataSource.query(
            `SELECT organization_id FROM dra_data_models WHERE id = $1`,
            [dataModelId],
        );
        return rows?.[0]?.organization_id ? Number(rows[0].organization_id) : null;
    } catch (err) {
        console.warn('[orgResolver] Failed to resolve data model org:', (err as Error)?.message);
        return null;
    }
}
