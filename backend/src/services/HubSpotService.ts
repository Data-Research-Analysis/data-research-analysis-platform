import { EntityManager } from 'typeorm';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { HubSpotOAuthService } from './HubSpotOAuthService.js';
import { TableMetadataService } from './TableMetadataService.js';
import { IAPIConnectionDetails } from '../types/IAPIConnectionDetails.js';

const SCHEMA = 'dra_hubspot';
const PAGE_LIMIT = 100;

/**
 * HubSpot CRM Service
 * Handles API calls and syncs data to the dra_hubspot PostgreSQL schema.
 *
 * Tables written (physical names follow ds{id}_{hash} convention):
 *  - contacts               — CRM contacts with UTM / lifecycle stage data
 *  - deals                  — pipeline deals with stage, amount, close date
 *  - pipeline_snapshot_daily — daily aggregate of open pipeline value + closed-won
 */
export class HubSpotService {
    private static instance: HubSpotService;

    private static readonly API_BASE = 'https://api.hubapi.com';

    private constructor() {
        console.log('🟠 HubSpot Service initialized');
    }

    public static getInstance(): HubSpotService {
        if (!HubSpotService.instance) {
            HubSpotService.instance = new HubSpotService();
        }
        return HubSpotService.instance;
    }

    // -------------------------------------------------------------------------
    // DB helpers
    // -------------------------------------------------------------------------

    private async getEntityManager(): Promise<EntityManager> {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('PostgreSQL driver unavailable');
        const dataSource = await driver.getConcreteDriver();
        return dataSource.manager;
    }

    // -------------------------------------------------------------------------
    // API request helper
    // -------------------------------------------------------------------------

    private async request<T = any>(
        path: string,
        accessToken: string,
        params?: Record<string, string>
    ): Promise<T> {
        const url = new URL(`${HubSpotService.API_BASE}${path}`);
        if (params) {
            Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
        }

        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HubSpot API ${path} failed (${response.status}): ${body}`);
        }

        return response.json() as Promise<T>;
    }

    // -------------------------------------------------------------------------
    // Ensure schema and individual tables
    // -------------------------------------------------------------------------

    private async ensureSchema(manager: EntityManager): Promise<void> {
        await manager.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    }

    private async createContactsTable(manager: EntityManager, tableName: string): Promise<void> {
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${SCHEMA}."${tableName}" (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL,
                hubspot_id      VARCHAR(50) NOT NULL,
                email           VARCHAR(320),
                first_name      VARCHAR(255),
                last_name       VARCHAR(255),
                lifecycle_stage VARCHAR(100),
                lead_source     VARCHAR(255),
                utm_source      VARCHAR(255),
                utm_campaign    VARCHAR(255),
                utm_medium      VARCHAR(100),
                created_date    TIMESTAMP,
                UNIQUE(data_source_id, hubspot_id)
            )
        `);
    }

    private async createDealsTable(manager: EntityManager, tableName: string): Promise<void> {
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${SCHEMA}."${tableName}" (
                id              SERIAL PRIMARY KEY,
                data_source_id  INTEGER NOT NULL,
                hubspot_id      VARCHAR(50) NOT NULL,
                deal_name       VARCHAR(512),
                pipeline        VARCHAR(255),
                deal_stage      VARCHAR(255),
                amount          NUMERIC(15,2),
                close_date      DATE,
                create_date     TIMESTAMP,
                is_closed_won   BOOLEAN DEFAULT FALSE,
                UNIQUE(data_source_id, hubspot_id)
            )
        `);
    }

    private async createPipelineSnapshotTable(manager: EntityManager, tableName: string): Promise<void> {
        await manager.query(`
            CREATE TABLE IF NOT EXISTS ${SCHEMA}."${tableName}" (
                id                     SERIAL PRIMARY KEY,
                data_source_id         INTEGER NOT NULL,
                snapshot_date          DATE NOT NULL,
                total_open_deals       INTEGER DEFAULT 0,
                total_pipeline_value   NUMERIC(15,2) DEFAULT 0,
                deals_closed_won       INTEGER DEFAULT 0,
                revenue_closed_won     NUMERIC(15,2) DEFAULT 0,
                new_leads_created      INTEGER DEFAULT 0,
                UNIQUE(data_source_id, snapshot_date)
            )
        `);
    }

    // -------------------------------------------------------------------------
    // Sync contacts (paginated with `after` cursor)
    // -------------------------------------------------------------------------

    public async syncContacts(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        connectionDetails = await HubSpotOAuthService.getInstance().ensureValidToken(connectionDetails);
        const accessToken = connectionDetails.oauth_access_token;
        const manager = await this.getEntityManager();
        const tableMetadataService = TableMetadataService.getInstance();

        await this.ensureSchema(manager);

        const logicalName = 'contacts';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);

        await this.createContactsTable(manager, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: SCHEMA,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'hubspot',
        });

        const properties = [
            'email', 'firstname', 'lastname', 'lifecyclestage',
            'hs_lead_status', 'utm_source', 'utm_campaign', 'utm_medium',
            'hs_analytics_source', 'createdate',
        ].join(',');

        let after: string | undefined;
        let synced = 0;

        do {
            const params: Record<string, string> = {
                limit: String(PAGE_LIMIT),
                properties,
            };
            if (after) params.after = after;

            const data: any = await this.request('/crm/v3/objects/contacts', accessToken, params);
            const results: any[] = data.results ?? [];

            for (const contact of results) {
                const p = contact.properties ?? {};
                await manager.query(
                    `INSERT INTO ${SCHEMA}."${tableName}"
                        (data_source_id, hubspot_id, email, first_name, last_name,
                         lifecycle_stage, lead_source, utm_source, utm_campaign, utm_medium, created_date)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                     ON CONFLICT (data_source_id, hubspot_id) DO UPDATE SET
                        email = EXCLUDED.email,
                        first_name = EXCLUDED.first_name,
                        last_name = EXCLUDED.last_name,
                        lifecycle_stage = EXCLUDED.lifecycle_stage,
                        lead_source = EXCLUDED.lead_source,
                        utm_source = EXCLUDED.utm_source,
                        utm_campaign = EXCLUDED.utm_campaign,
                        utm_medium = EXCLUDED.utm_medium,
                        created_date = EXCLUDED.created_date`,
                    [
                        dataSourceId,
                        contact.id,
                        p.email ?? null,
                        p.firstname ?? null,
                        p.lastname ?? null,
                        p.lifecyclestage ?? null,
                        p.hs_analytics_source ?? null,
                        p.utm_source ?? null,
                        p.utm_campaign ?? null,
                        p.utm_medium ?? null,
                        p.createdate ? new Date(p.createdate) : null,
                    ]
                );
                synced++;
            }

            after = data.paging?.next?.after;
        } while (after);

        console.log(`[HubSpot] Synced ${synced} contacts for data source ${dataSourceId}`);
        return synced;
    }

    // -------------------------------------------------------------------------
    // Sync deals (paginated with `after` cursor)
    // -------------------------------------------------------------------------

    public async syncDeals(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<number> {
        connectionDetails = await HubSpotOAuthService.getInstance().ensureValidToken(connectionDetails);
        const accessToken = connectionDetails.oauth_access_token;
        const manager = await this.getEntityManager();
        const tableMetadataService = TableMetadataService.getInstance();

        await this.ensureSchema(manager);

        const logicalName = 'deals';
        const tableName = tableMetadataService.generatePhysicalTableName(dataSourceId, logicalName);

        await this.createDealsTable(manager, tableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: SCHEMA,
            physicalTableName: tableName,
            logicalTableName: logicalName,
            originalSheetName: logicalName,
            tableType: 'hubspot',
        });

        const properties = [
            'dealname', 'pipeline', 'dealstage', 'amount',
            'closedate', 'createdate', 'hs_is_closed_won',
        ].join(',');

        let after: string | undefined;
        let synced = 0;

        do {
            const params: Record<string, string> = {
                limit: String(PAGE_LIMIT),
                properties,
            };
            if (after) params.after = after;

            const data: any = await this.request('/crm/v3/objects/deals', accessToken, params);
            const results: any[] = data.results ?? [];

            for (const deal of results) {
                const p = deal.properties ?? {};
                const amount = p.amount ? parseFloat(p.amount) : null;
                const isClosedWon =
                    p.hs_is_closed_won === 'true' ||
                    (p.dealstage ?? '').toLowerCase().includes('closedwon');

                await manager.query(
                    `INSERT INTO ${SCHEMA}."${tableName}"
                        (data_source_id, hubspot_id, deal_name, pipeline, deal_stage,
                         amount, close_date, create_date, is_closed_won)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                     ON CONFLICT (data_source_id, hubspot_id) DO UPDATE SET
                        deal_name   = EXCLUDED.deal_name,
                        pipeline    = EXCLUDED.pipeline,
                        deal_stage  = EXCLUDED.deal_stage,
                        amount      = EXCLUDED.amount,
                        close_date  = EXCLUDED.close_date,
                        create_date = EXCLUDED.create_date,
                        is_closed_won = EXCLUDED.is_closed_won`,
                    [
                        dataSourceId,
                        deal.id,
                        p.dealname ?? null,
                        p.pipeline ?? null,
                        p.dealstage ?? null,
                        amount,
                        p.closedate ? new Date(p.closedate) : null,
                        p.createdate ? new Date(p.createdate) : null,
                        isClosedWon,
                    ]
                );
                synced++;
            }

            after = data.paging?.next?.after;
        } while (after);

        console.log(`[HubSpot] Synced ${synced} deals for data source ${dataSourceId}`);
        return synced;
    }

    // -------------------------------------------------------------------------
    // Build daily pipeline snapshot
    // -------------------------------------------------------------------------

    public async buildPipelineSnapshot(dataSourceId: number, usersPlatformId: number): Promise<void> {
        const manager = await this.getEntityManager();
        const tableMetadataService = TableMetadataService.getInstance();

        await this.ensureSchema(manager);

        const dealsTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, 'deals');
        const snapshotLogicalName = 'pipeline_snapshot_daily';
        const snapshotTableName = tableMetadataService.generatePhysicalTableName(dataSourceId, snapshotLogicalName);

        await this.createPipelineSnapshotTable(manager, snapshotTableName);
        await tableMetadataService.storeTableMetadata(manager, {
            dataSourceId,
            usersPlatformId,
            schemaName: SCHEMA,
            physicalTableName: snapshotTableName,
            logicalTableName: snapshotLogicalName,
            originalSheetName: snapshotLogicalName,
            tableType: 'hubspot',
        });

        const today = new Date().toISOString().split('T')[0];

        await manager.query(
            `INSERT INTO ${SCHEMA}."${snapshotTableName}"
                (data_source_id, snapshot_date, total_open_deals, total_pipeline_value,
                 deals_closed_won, revenue_closed_won)
             SELECT
                $1,
                $2::DATE,
                COUNT(*) FILTER (WHERE is_closed_won = FALSE),
                COALESCE(SUM(amount) FILTER (WHERE is_closed_won = FALSE), 0),
                COUNT(*) FILTER (WHERE is_closed_won = TRUE),
                COALESCE(SUM(amount) FILTER (WHERE is_closed_won = TRUE), 0)
             FROM ${SCHEMA}."${dealsTableName}"
             WHERE data_source_id = $1
             ON CONFLICT (data_source_id, snapshot_date) DO UPDATE SET
                total_open_deals    = EXCLUDED.total_open_deals,
                total_pipeline_value = EXCLUDED.total_pipeline_value,
                deals_closed_won    = EXCLUDED.deals_closed_won,
                revenue_closed_won  = EXCLUDED.revenue_closed_won`,
            [dataSourceId, today]
        );

        console.log(`[HubSpot] Pipeline snapshot built for data source ${dataSourceId} on ${today}`);
    }

    // -------------------------------------------------------------------------
    // Get current open pipeline value
    // -------------------------------------------------------------------------

    public async getCurrentPipelineValue(dataSourceId: number): Promise<number> {
        try {
            const manager = await this.getEntityManager();
            const tableName = TableMetadataService.getInstance().generatePhysicalTableName(dataSourceId, 'deals');
            const rows = await manager.query(
                `SELECT COALESCE(SUM(amount), 0) AS pipeline_value
                 FROM ${SCHEMA}."${tableName}"
                 WHERE data_source_id = $1 AND is_closed_won = FALSE AND amount IS NOT NULL`,
                [dataSourceId]
            );
            return Number(rows[0]?.pipeline_value ?? 0);
        } catch {
            return 0;
        }
    }

    // -------------------------------------------------------------------------
    // Full sync (contacts + deals + snapshot)
    // -------------------------------------------------------------------------

    public async syncAll(
        dataSourceId: number,
        usersPlatformId: number,
        connectionDetails: IAPIConnectionDetails
    ): Promise<{ contacts: number; deals: number }> {
        const contacts = await this.syncContacts(dataSourceId, usersPlatformId, connectionDetails);
        const deals = await this.syncDeals(dataSourceId, usersPlatformId, connectionDetails);
        await this.buildPipelineSnapshot(dataSourceId, usersPlatformId);
        return { contacts, deals };
    }
}
