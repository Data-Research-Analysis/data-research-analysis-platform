import { MigrationInterface, QueryRunner } from 'typeorm';

const ORG_NAME = 'Platform Templates';
const WORKSPACE_NAME = 'Templates';
const WORKSPACE_SLUG = 'templates';

const TEMPLATE_NAMES = [
    'Website Analytics',
    'Acquisition & Attribution',
    'Paid → Site',
];

/**
 * Seed GA4 dashboard templates AFTER the Phase 2 organization/workspace
 * enforcement migration (1774110000000), which makes dra_dashboards
 * organization_id/workspace_id NOT NULL and deletes orphaned templates.
 *
 * Templates are global but must belong to a real organization/workspace, so we
 * create (idempotently) a "Platform Templates" organization + "Templates"
 * workspace and attach them there.
 */
export class SeedGA4DashboardTemplates1782000000000 implements MigrationInterface {
    name = 'SeedGA4DashboardTemplates1782000000000';

    private kpi(id: number, title: string, top: string, left: string): object {
        return {
            chart_id: id,
            chart_type: 'kpi_scorecard',
            columns: [],
            data: [],
            dimensions: { width: '310px', height: '150px', widthDraggable: '310px', heightDraggable: '150px' },
            location: { top, left },
            x_axis_label: title,
            y_axis_label: '',
            stack_keys: [],
            line_data: [],
            text_editor: { content: '' },
            config: { drag_enabled: false, resize_enabled: false, add_columns_enabled: false },
        };
    }

    private chart(id: number, type: string, xLabel: string, yLabel: string, left: string, width: string): object {
        return {
            chart_id: id,
            chart_type: type,
            columns: [],
            data: [],
            dimensions: { width, height: '380px', widthDraggable: width, heightDraggable: '380px' },
            location: { top: '170px', left },
            x_axis_label: xLabel,
            y_axis_label: yLabel,
            stack_keys: [],
            line_data: [],
            text_editor: { content: '' },
            config: { drag_enabled: false, resize_enabled: false, add_columns_enabled: false },
        };
    }

    private async ensureSystemOrgWorkspace(queryRunner: QueryRunner): Promise<{ orgId: number; workspaceId: number }> {
        await queryRunner.query(
            `INSERT INTO dra_organizations (name, is_active, created_at, updated_at)
             SELECT $1::varchar, true, NOW(), NOW()
             WHERE NOT EXISTS (SELECT 1 FROM dra_organizations WHERE name = $1::varchar)`,
            [ORG_NAME],
        );
        const orgRows = await queryRunner.query(
            `SELECT id FROM dra_organizations WHERE name = $1 ORDER BY id LIMIT 1`,
            [ORG_NAME],
        );
        const orgId = orgRows[0].id;

        await queryRunner.query(
            `INSERT INTO dra_workspaces (organization_id, name, slug, description, is_active, created_at, updated_at)
             SELECT $1::int, $2::varchar, $3::varchar, 'Platform dashboard templates', true, NOW(), NOW()
             WHERE NOT EXISTS (SELECT 1 FROM dra_workspaces WHERE organization_id = $1::int AND slug = $3::varchar)`,
            [orgId, WORKSPACE_NAME, WORKSPACE_SLUG],
        );
        const wsRows = await queryRunner.query(
            `SELECT id FROM dra_workspaces WHERE organization_id = $1 AND slug = $2 ORDER BY id LIMIT 1`,
            [orgId, WORKSPACE_SLUG],
        );

        return { orgId, workspaceId: wsRows[0].id };
    }

    private async seedIfMissing(
        queryRunner: QueryRunner,
        orgId: number,
        workspaceId: number,
        name: string,
        charts: object[],
        meta: Record<string, any>,
    ): Promise<void> {
        const existing = await queryRunner.query(
            `SELECT id FROM dra_dashboards WHERE is_template = true AND name = $1 LIMIT 1`,
            [name],
        );
        if (existing.length > 0) {
            console.log(`ℹ️  Template "${name}" already exists, skipping`);
            return;
        }

        await queryRunner.query(
            `INSERT INTO dra_dashboards
                (name, data, is_template, source_template_id, users_platform_id, project_id, organization_id, workspace_id)
             VALUES ($1, $2::jsonb, true, null, null, null, $3, $4)`,
            [name, JSON.stringify({ charts, template_meta: meta }), orgId, workspaceId],
        );
        console.log(`✅ Seeded "${name}" dashboard template`);
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasOrgColumn = await queryRunner.query(
            `SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'dra_dashboards' AND column_name = 'organization_id'`,
        );
        if (!hasOrgColumn.length) {
            console.log('ℹ️  Skipping GA4 template seed: organization columns not present yet');
            return;
        }

        const { orgId, workspaceId } = await this.ensureSystemOrgWorkspace(queryRunner);

        await this.seedIfMissing(
            queryRunner, orgId, workspaceId,
            'Website Analytics',
            [
                this.kpi(1, 'Sessions', '0px', '0px'),
                this.kpi(2, 'Users', '0px', '330px'),
                this.kpi(3, 'New Users', '0px', '660px'),
                this.chart(4, 'donut', 'Channel group', 'Sessions', '0px', '520px'),
                this.chart(5, 'horizontal_bar', 'Page', 'Page views', '540px', '620px'),
            ],
            {
                description: 'GA4 website traffic — sessions, users, new users, channel mix and top pages. Aggregate reporting; no ad spend.',
                data_binding: 'IntelligenceReportProcessor.getIntelligenceHubSummary().webTraffic',
                widget_count: 5,
                icon: 'globe',
            },
        );

        await this.seedIfMissing(
            queryRunner, orgId, workspaceId,
            'Acquisition & Attribution',
            [
                this.kpi(1, 'Users', '0px', '0px'),
                this.kpi(2, 'Sessions', '0px', '330px'),
                this.kpi(3, 'Conversions', '0px', '660px'),
                this.chart(4, 'donut', 'Channel', 'Sessions', '0px', '520px'),
                this.chart(5, 'horizontal_bar', 'Campaign', 'Sessions', '540px', '620px'),
            ],
            {
                description: 'GA4 acquisition and multi-touch attribution — where users come from, channel mix and top campaigns.',
                data_binding: 'GoogleAnalyticsBigQueryProcessor.getAcquisition + GA4SessionAttributionService',
                widget_count: 5,
                icon: 'bullseye',
            },
        );

        await this.seedIfMissing(
            queryRunner, orgId, workspaceId,
            'Paid → Site',
            [
                this.kpi(1, 'Spend', '0px', '0px'),
                this.kpi(2, 'Sessions', '0px', '330px'),
                this.kpi(3, 'Conversions', '0px', '660px'),
                this.chart(4, 'bar', 'Campaign', 'CPA', '0px', '520px'),
                this.chart(5, 'bar', 'Campaign', 'ROAS', '540px', '620px'),
            ],
            {
                description: 'Blended ads + GA4 funnel — spend, sessions, conversions, CPA and ROAS by campaign.',
                data_binding: 'GA4AttributionService.getCampaignRoi',
                widget_count: 5,
                icon: 'chart-line',
            },
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DELETE FROM dra_dashboards WHERE is_template = true AND name = ANY($1)`,
            [TEMPLATE_NAMES],
        );
    }
}
