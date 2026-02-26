import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces the original 5 oversized marketing dashboard templates (which exceeded the
 * 5-chart-per-dashboard limit) with 8 focused templates that each contain ≤ 5 charts.
 *
 * Original templates removed (6–8 charts each):
 *   Paid Media Overview, Google Ads Performance, LinkedIn B2B Pipeline,
 *   Lead Generation Funnel, Campaign Budget Pacing
 *
 * New templates (≤ 5 charts each):
 *   1. Paid Media Overview           (5) — 4 KPIs + channel mix donut
 *   2. Paid Media Campaigns          (3) — weekly trend + top campaigns bar + channel comparison table
 *   3. Google Ads Performance        (5) — 4 KPIs + spend by campaign bar
 *   4. Google Ads Analysis           (2) — campaign table + daily spend/conv line
 *   5. LinkedIn B2B Pipeline         (5) — 3 KPIs + campaign table + audience bar
 *   6. Lead Generation Funnel        (5) — 3 KPIs + funnel widget + channel breakdown table
 *   7. Campaign Budget Pacing        (5) — 4 KPIs + budget gauge
 *   8. Budget Spend Trends           (2) — actual vs ideal pace line + attribution bar
 */
export class UpdateDashboardTemplatesToRespectChartLimit1772700000000 implements MigrationInterface {
    name = 'UpdateDashboardTemplatesToRespectChartLimit1772700000000';

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

    private chart(
        id: number,
        type: string,
        xLabel: string,
        yLabel: string,
        top: string,
        left: string,
        width: string,
        height: string,
    ): object {
        return {
            chart_id: id,
            chart_type: type,
            columns: [],
            data: [],
            dimensions: { width, height, widthDraggable: width, heightDraggable: height },
            location: { top, left },
            x_axis_label: xLabel,
            y_axis_label: yLabel,
            stack_keys: [],
            line_data: [],
            text_editor: { content: '' },
            config: { drag_enabled: false, resize_enabled: false, add_columns_enabled: false },
        };
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Remove the original oversized templates inserted by 1772600000000
        await queryRunner.query(`
            DELETE FROM dra_dashboards
            WHERE is_template = true
              AND name IN (
                'Paid Media Overview',
                'Google Ads Performance',
                'LinkedIn B2B Pipeline',
                'Lead Generation Funnel',
                'Campaign Budget Pacing'
              )
        `);

        // -------------------------------------------------------------------
        // 1. Paid Media Overview  (5 charts)
        //    4 KPIs + channel mix donut
        // -------------------------------------------------------------------
        const t1 = {
            charts: [
                this.kpi(1, 'Total Spend',              '0px',  '0px'),
                this.kpi(2, 'Total Leads / Conversions','0px',  '330px'),
                this.kpi(3, 'Blended CPL',              '0px',  '660px'),
                this.kpi(4, 'Average ROAS',              '0px',  '990px'),
                this.chart(5, 'donut', 'Channel', 'Spend', '170px', '0px', '500px', '380px'),
            ],
            template_meta: {
                description: 'CMO-level paid media KPIs — total spend, leads, CPL, ROAS and channel mix.',
                data_binding: 'MarketingReportProcessor.getMarketingHubSummary()',
                widget_count: 5,
                icon: 'chart-pie',
            },
        };

        // -------------------------------------------------------------------
        // 2. Paid Media Campaigns  (3 charts)
        //    Weekly spend trend + top campaigns bar + channel comparison table
        // -------------------------------------------------------------------
        const t2 = {
            charts: [
                this.chart(1, 'multiline',                'Week',     'Spend by Channel', '0px',   '0px',   '660px', '360px'),
                this.chart(2, 'horizontal_bar',           'Campaign', 'Spend',            '0px',   '680px', '530px', '360px'),
                this.chart(3, 'channel_comparison_table', 'Channel',  'All KPIs',         '380px', '0px',   '1100px','360px'),
            ],
            template_meta: {
                description: 'Weekly spend trends by channel, top 10 campaigns by spend and cross-channel KPI comparison.',
                data_binding: 'MarketingReportProcessor.getMarketingHubSummary()',
                widget_count: 3,
                icon: 'chart-line',
            },
        };

        // -------------------------------------------------------------------
        // 3. Google Ads Performance  (5 charts)
        //    4 KPIs + spend by campaign bar
        // -------------------------------------------------------------------
        const t3 = {
            charts: [
                this.kpi(1, 'Google Ads Spend',       '0px',  '0px'),
                this.kpi(2, 'Google Ads Clicks',      '0px',  '330px'),
                this.kpi(3, 'Avg CPC',                '0px',  '660px'),
                this.kpi(4, 'Google Ads Conversions', '0px',  '990px'),
                this.chart(5, 'vertical_bar', 'Campaign', 'Spend', '170px', '0px', '800px', '380px'),
            ],
            template_meta: {
                description: 'Google Ads headline KPIs — spend, clicks, average CPC, conversions — plus spend by campaign.',
                data_binding: 'dra_google_ads.campaign_performance',
                widget_count: 5,
                icon: 'magnifying-glass-chart',
            },
        };

        // -------------------------------------------------------------------
        // 4. Google Ads Analysis  (2 charts)
        //    Campaign breakdown table + daily spend & conversions line
        // -------------------------------------------------------------------
        const t4 = {
            charts: [
                this.chart(1, 'table',     'Campaign Breakdown', '',                    '0px',   '0px',   '700px', '380px'),
                this.chart(2, 'multiline', 'Date',               'Spend & Conversions', '400px', '0px',   '1100px','380px'),
            ],
            template_meta: {
                description: 'Detailed Google Ads campaign table and daily spend vs conversion trend.',
                data_binding: 'dra_google_ads.campaign_performance',
                widget_count: 2,
                icon: 'magnifying-glass-chart',
            },
        };

        // -------------------------------------------------------------------
        // 5. LinkedIn B2B Pipeline  (5 charts)
        //    3 KPIs + campaign table + audience bar
        // -------------------------------------------------------------------
        const t5 = {
            charts: [
                this.kpi(1, 'LinkedIn Spend', '0px',  '0px'),
                this.kpi(2, 'LinkedIn Leads', '0px',  '330px'),
                this.kpi(3, 'LinkedIn CPL',   '0px',  '660px'),
                this.chart(4, 'table',        'Campaign Breakdown', '',       '170px', '0px',   '700px', '380px'),
                this.chart(5, 'vertical_bar', 'Audience Segment',  'Leads',  '570px', '0px',   '700px', '360px'),
            ],
            template_meta: {
                description: 'LinkedIn B2B paid performance — spend, leads, CPL, campaign breakdown and audience segment analysis.',
                data_binding: 'dra_linkedin_ads',
                widget_count: 5,
                icon: 'linkedin',
            },
        };

        // -------------------------------------------------------------------
        // 6. Lead Generation Funnel  (5 charts)
        //    3 KPIs + funnel widget + channel breakdown table
        // -------------------------------------------------------------------
        const t6 = {
            charts: [
                this.kpi(1, 'Cost per MQL',           '0px',  '0px'),
                this.kpi(2, 'Lead to MQL Rate',        '0px',  '330px'),
                this.kpi(3, 'MQL to SQL Rate',         '0px',  '660px'),
                this.chart(4, 'funnel_steps', 'Funnel Stage',   'Volume', '170px', '0px',   '540px', '400px'),
                this.chart(5, 'table',        'Funnel by Channel', '',    '170px', '560px', '530px', '400px'),
            ],
            template_meta: {
                description: 'Full-funnel demand gen metrics — MQL/SQL conversion rates, funnel volume stages and channel breakdown.',
                data_binding: '/attribution/analyze-funnel',
                widget_count: 5,
                icon: 'filter',
            },
        };

        // -------------------------------------------------------------------
        // 7. Campaign Budget Pacing  (5 charts)
        //    4 KPIs + budget gauge
        // -------------------------------------------------------------------
        const t7 = {
            charts: [
                this.kpi(1, 'Days Remaining',        '0px',  '0px'),
                this.kpi(2, 'Daily Avg Spend',        '0px',  '330px'),
                this.kpi(3, 'Projected Total Spend',  '0px',  '660px'),
                this.kpi(4, 'Budget Remaining',       '0px',  '990px'),
                this.chart(5, 'budget_gauge', 'Spend vs Budget', '', '170px', '0px', '400px', '380px'),
            ],
            template_meta: {
                description: 'Campaign budget pacing KPIs — days remaining, daily spend rate, projected total and a live budget gauge.',
                data_binding: 'Campaign entity + MarketingReportProcessor.getDigitalSpendForCampaign()',
                widget_count: 5,
                icon: 'gauge',
            },
        };

        // -------------------------------------------------------------------
        // 8. Budget Spend Trends  (2 charts)
        //    Actual vs ideal pace line + attribution stacked bar
        // -------------------------------------------------------------------
        const t8 = {
            charts: [
                this.chart(1, 'multiline',    'Date',    'Actual vs Ideal Pace', '0px',   '0px',   '800px', '380px'),
                this.chart(2, 'stacked_bar',  'Channel', 'Attribution',          '400px', '0px',   '800px', '360px'),
            ],
            template_meta: {
                description: 'Daily spend actual vs ideal pacing line and channel-level attribution breakdown.',
                data_binding: 'Campaign entity + /attribution/compare-models',
                widget_count: 2,
                icon: 'chart-line',
            },
        };

        const templates = [
            { name: 'Paid Media Overview',     data: t1 },
            { name: 'Paid Media Campaigns',    data: t2 },
            { name: 'Google Ads Performance',  data: t3 },
            { name: 'Google Ads Analysis',     data: t4 },
            { name: 'LinkedIn B2B Pipeline',   data: t5 },
            { name: 'Lead Generation Funnel',  data: t6 },
            { name: 'Campaign Budget Pacing',  data: t7 },
            { name: 'Budget Spend Trends',     data: t8 },
        ];

        for (const tpl of templates) {
            await queryRunner.query(
                `INSERT INTO dra_dashboards (name, data, is_template, source_template_id, users_platform_id, project_id)
                 VALUES ($1, $2::jsonb, true, null, null, null)`,
                [tpl.name, JSON.stringify(tpl.data)],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove the 8 replacement templates
        await queryRunner.query(`
            DELETE FROM dra_dashboards
            WHERE is_template = true
              AND name IN (
                'Paid Media Overview',
                'Paid Media Campaigns',
                'Google Ads Performance',
                'Google Ads Analysis',
                'LinkedIn B2B Pipeline',
                'Lead Generation Funnel',
                'Campaign Budget Pacing',
                'Budget Spend Trends'
              )
        `);

        // Restore the original 5 oversized templates (mirrors 1772600000000 seed data)
        const originals = [
            { name: 'Paid Media Overview',    wc: 8, icon: 'chart-pie' },
            { name: 'Google Ads Performance', wc: 7, icon: 'magnifying-glass-chart' },
            { name: 'LinkedIn B2B Pipeline',  wc: 6, icon: 'linkedin' },
            { name: 'Lead Generation Funnel', wc: 6, icon: 'filter' },
            { name: 'Campaign Budget Pacing', wc: 6, icon: 'gauge' },
        ];
        for (const tpl of originals) {
            const data = { charts: [], template_meta: { description: '', widget_count: tpl.wc, icon: tpl.icon } };
            await queryRunner.query(
                `INSERT INTO dra_dashboards (name, data, is_template, source_template_id, users_platform_id, project_id)
                 VALUES ($1, $2::jsonb, true, null, null, null)`,
                [tpl.name, JSON.stringify(data)],
            );
        }
    }
}
