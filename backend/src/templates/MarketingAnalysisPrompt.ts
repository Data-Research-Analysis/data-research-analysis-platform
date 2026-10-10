/**
 * Marketing Analysis Prompt — MKT-006
 *
 * Builds the one-shot prompt context for the ready-made AI performance
 * marketing analysis report. The model is asked to behave like an
 * experienced performance marketer and senior data analyst and to return a
 * strictly-typed JSON report (no conversational interface).
 */

export interface MarketingAnalysisPromptChannel {
    channel: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    changePercent: number | null;
}

export interface MarketingAnalysisPromptCampaign {
    campaignId: string;
    campaignName: string;
    channel: string;
    spend: number;
    conversions: number;
    cpl: number;
    roas: number;
    status: string;
}

export interface MarketingAnalysisPromptAdSet {
    campaign: string;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    ctr: number;
    cpc: number;
    cpa: number;
    roas: number;
    cpl: number;
    status: string;
}

export interface MarketingAnalysisPromptTarget {
    entity: string;
    level: string;
    channel: string | null;
    targetRoas: number | null;
    targetCpa: number | null;
    targetCpl: number | null;
    targetConversions: number | null;
    actualRoas: number | null;
    actualCpa: number | null;
    actualCpl: number | null;
    actualConversions: number | null;
    spend: number | null;
}

export interface MarketingAnalysisPromptAlert {
    severity: string;
    message: string;
    suggestedAction: string;
}

export interface MarketingAnalysisPromptDimensionRow {
    label: string;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
    cpl: number;
}

export interface MarketingAnalysisPromptDemographics {
    age: MarketingAnalysisPromptDimensionRow[];
    gender: MarketingAnalysisPromptDimensionRow[];
    device: MarketingAnalysisPromptDimensionRow[];
    platform: MarketingAnalysisPromptDimensionRow[];
}

export interface MarketingAnalysisPromptContext {
    projectId: number;
    startDate: string;
    endDate: string;
    /** Present only when the analysis is scoped to a single campaign. */
    campaignName: string | null;
    campaignChannel: string | null;
    /** Present only when the analysis is scoped to a single ad group / ad set. */
    adSetName: string | null;
    totalSpend: number;
    totalConversions: number;
    overallRoas: number | null;
    overallCpl: number | null;
    spendChangePercent: number | null;
    channels: MarketingAnalysisPromptChannel[];
    weeklyTrend: Array<{ week: string; spend: number }>;
    topCampaigns: MarketingAnalysisPromptCampaign[];
    adSets: MarketingAnalysisPromptAdSet[];
    targets: MarketingAnalysisPromptTarget[];
    alerts: MarketingAnalysisPromptAlert[];
    demographics: MarketingAnalysisPromptDemographics;
}

export function getMarketingAnalysisSystemInstruction(): string {
    return `You are an experienced performance marketer and senior data analyst with deep
expertise in paid media (Google Ads, Meta Ads, LinkedIn Ads, Google Ad Manager),
attribution, funnel optimization and budget allocation.

Your job is to produce a READY-MADE performance marketing analysis report that a CMO
can hand directly to their marketing team. There is NO conversation — the report must
stand on its own.

Rules:
- Always return valid JSON matching the schema described in the user prompt.
- Be specific and quantitative: reference real numbers from the data provided.
- Never invent metrics that are not present in the data.
- Prioritise actionable spend recommendations (which channel/campaign/ad set should get
  more budget, which should be cut or paused, and why).
- Distinguish correlation from causation and flag uncertainty.
- Keep the tone confident but honest; flag data quality or coverage limitations.
- Use plain markdown in content strings (headings avoided — use bold bullets instead).
- Return ONLY the JSON object. No markdown fences, no preamble, no trailing text.`;
}

export function buildMarketingAnalysisPrompt(context: MarketingAnalysisPromptContext): string {
    const fmtMoney = (n: number | null | undefined): string =>
        n == null ? 'n/a' : `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    const fmtNum = (n: number | null | undefined, digits = 1): string =>
        n == null ? 'n/a' : Number(n).toLocaleString('en-US', { maximumFractionDigits: digits });
    const fmtPct = (n: number | null | undefined): string =>
        n == null ? 'n/a' : `${Number(n) >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`;

    const channelRows = context.channels
        .map(
            c => `| ${c.channel} | ${fmtMoney(c.spend)} | ${fmtNum(c.impressions, 0)} | ${fmtNum(c.clicks, 0)} | ${fmtNum(c.conversions, 0)} | ${fmtMoney(c.revenue)} | ${fmtNum(c.ctr)}% | ${fmtMoney(c.cpc)} | ${fmtMoney(c.cpa)} | ${fmtNum(c.roas)} | ${fmtPct(c.changePercent)} |`,
        )
        .join('\n');

    const campaignRows = context.topCampaigns
        .map(
            c => `| ${c.campaignName} | ${c.channel} | ${fmtMoney(c.spend)} | ${fmtNum(c.conversions, 0)} | ${fmtMoney(c.cpl)} | ${fmtNum(c.roas)} | ${c.status} |`,
        )
        .join('\n');

    const adSetRows = context.adSets
        .map(
            a => `| ${a.campaign} | ${a.name} | ${fmtMoney(a.spend)} | ${fmtNum(a.impressions, 0)} | ${fmtNum(a.clicks, 0)} | ${fmtNum(a.conversions, 0)} | ${fmtMoney(a.revenue)} | ${fmtNum(a.ctr)}% | ${fmtMoney(a.cpc)} | ${fmtMoney(a.cpa)} | ${fmtNum(a.roas)} | ${fmtMoney(a.cpl)} | ${a.status} |`,
        )
        .join('\n');

    const targetRows = context.targets
        .map(
            t => `| ${t.entity} | ${t.level} | ${t.channel ?? '—'} | ${fmtNum(t.targetRoas)} | ${fmtNum(t.actualRoas)} | ${fmtMoney(t.targetCpa)} | ${fmtMoney(t.actualCpa)} | ${fmtMoney(t.targetCpl)} | ${fmtMoney(t.actualCpl)} | ${fmtNum(t.targetConversions, 0)} | ${fmtNum(t.actualConversions, 0)} |`,
        )
        .join('\n');

    const alertRows = context.alerts
        .slice(0, 10)
        .map(a => `- [${a.severity.toUpperCase()}] ${a.message}${a.suggestedAction ? ` — Action: ${a.suggestedAction}` : ''}`)
        .join('\n');

    const dimRow = (rows: MarketingAnalysisPromptDimensionRow[]): string =>
        rows.map(r => `| ${r.label} | ${fmtMoney(r.spend)} | ${fmtNum(r.impressions, 0)} | ${fmtNum(r.clicks, 0)} | ${fmtNum(r.conversions, 0)} | ${fmtMoney(r.revenue)} | ${fmtNum(r.roas)} | ${fmtMoney(r.cpl)} |`).join('\n');

    const demoTables: string[] = [];
    const demoSections: Array<[string, MarketingAnalysisPromptDimensionRow[]]> = [
        ['Age', context.demographics.age],
        ['Gender', context.demographics.gender],
        ['Device', context.demographics.device],
        ['Platform / Placement', context.demographics.platform],
    ];
    for (const [name, rows] of demoSections) {
        demoTables.push(
            `**${name}**\n| ${name} | Spend | Impressions | Clicks | Conversions | Revenue | ROAS | CPL |\n|---|---|---|---|---|---|---|---|\n${rows.length ? dimRow(rows.slice(0, 12)) : '| — | — | — | — | — | — | — | — |'}`,
        );
    }

    const weeklyRows = context.weeklyTrend
        .map(w => `| ${w.week} | ${fmtMoney(w.spend)} |`)
        .join('\n');

    let scopeIntro: string;
    if (context.adSetName) {
        scopeIntro = `You are analyzing the ad group / ad set **${context.adSetName}** within the campaign **${
            context.campaignName ?? 'n/a'
        }**${context.campaignChannel ? ` (${context.campaignChannel})` : ''} for the period **${
            context.startDate
        } → ${context.endDate}**. This ad group/ad set typically tests a specific ad plan (audience, creative, or offer). Focus the report on THIS ad group/ad set only: its spend, efficiency (ROAS/CPA/CPL/CTR), and whether its ad plan is working or should be changed. Campaign-wide context (weekly spend trend, demographics, alerts) is provided only for comparison — never attribute campaign-level numbers to the ad set itself.`;
    } else if (context.campaignName) {
        scopeIntro = `You are analyzing the marketing performance data for the campaign **${context.campaignName}**${
            context.campaignChannel ? ` (${context.campaignChannel})` : ''
        } for the period **${context.startDate} → ${context.endDate}**. This campaign contains ${
            context.adSets.length
        } ad group(s)/ad set(s). Each ad group/ad set typically tests a different ad plan (audience, creative, or offer), so analyze EVERY ad group/ad set individually and recommend where to move budget between them.`;
    } else {
        scopeIntro = `You are analyzing the marketing performance data for project #${context.projectId}
for the period **${context.startDate} → ${context.endDate}**.`;
    }

    return `## Marketing Performance Analysis Request

${scopeIntro}

### Overall performance
- Total spend: ${fmtMoney(context.totalSpend)}
- Total conversions: ${fmtNum(context.totalConversions, 0)}
- Overall ROAS: ${fmtNum(context.overallRoas)}
- Overall CPL: ${fmtMoney(context.overallCpl)}
- Spend vs prior period: ${fmtPct(context.spendChangePercent)}

### Channel breakdown (current period with spend change vs prior period)
| Channel | Spend | Impressions | Clicks | Conversions | Revenue | CTR | CPC | CPA | ROAS | Spend Δ |
|---|---|---|---|---|---|---|---|---|---|---|
${channelRows || '| — | — | — | — | — | — | — | — | — | — | — |'}

### Weekly spend trend
| Week | Spend |
|---|---|
${weeklyRows || '| — | — |'}

### Top campaigns by spend
| Campaign | Channel | Spend | Conversions | CPL | ROAS | Status |
|---|---|---|---|---|---|---|
${campaignRows || '| — | — | — | — | — | — | — |'}

### Ad set / ad group performance (drill-down for this campaign)
| Campaign | Ad Set / Ad Group | Spend | Impr. | Clicks | Conv. | Revenue | CTR | CPC | CPA | ROAS | CPL | Performance |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
${adSetRows || '| — | — | — | — | — | — | — | — | — | — | — | — | — |'}

### Demographics, devices and placement (spend share for this campaign)
${demoTables.join('\n\n')}

### Target vs actual (user-defined campaign & ad set targets)
| Entity | Level | Channel | Target ROAS | Actual ROAS | Target CPA | Actual CPA | Target CPL | Actual CPL | Target Conv. | Actual Conv. |
|---|---|---|---|---|---|---|---|---|---|---|
${targetRows || '| — | — | — | — | — | — | — | — | — | — | — |'}

### Alerts and anomalies
${alertRows || 'No alerts detected in the period.'}

### Required output
Respond with ONLY valid JSON (no markdown fences, no commentary) matching this schema:

{
  "title": "string — short report title (name the campaign, or the ad group/ad set when the analysis is scoped to one)",
  "executive_summary": "string — 4-6 sentence executive summary for a CMO",
  "sections": [
    {
      "heading": "string",
      "content": "string — detailed markdown analysis prose (bold bullets ok, no h1-h6)",
      "recommendations": ["string"] | null
    }
  ],
  "spend_recommendations": [
    {
      "entity": "string — exact ad group / ad set name (or campaign for campaign-wide actions)",
      "entity_type": "ad_set | ad_group | campaign | channel",
      "action": "increase_budget | decrease_budget | maintain | pause",
      "current_spend": number | null,
      "suggested_allocation": "string — e.g. '+20%' or '$500 more/month' or 'cut to $0'",
      "rationale": "string — 1-3 sentences with numbers"
    }
  ],
  "risks_and_alerts": ["string"],
  "next_steps": ["string"]
}

### Analysis guidance
1. Compare actuals against the user's target metrics (ROAS/CPA/CPL/conversions) and call out
   entities that are above, on, or below target.
2. Recommend where to reallocate spend: high-ROAS / under-scaled ad sets should get more
   budget; low-ROAS or over-spending entities should be cut or paused.
3. Analyze demographics and devices: identify which age bands and genders drive the most
   spend/conversions, which devices (mobile/desktop/tablet) are most efficient, and which
   placements/platforms deliver the best ROAS. Recommend whether to shift targeting or
   bidding by age/gender/device/platform.
4. Highlight anomalies and pacing/budget risks.
5. Cover: budget allocation, efficiency, scaling opportunities, risk areas, and 3-5 clear
   next steps the marketing team can execute.
6. Aim for 4-6 sections. Make every recommendation specific and actionable.
7. When the analysis is campaign-scoped, treat EACH ad group / ad set as a separate experiment:
   give every ad group/ad set its own analysis section (or a dedicated subsection/bullet within
   the campaign sections) covering its spend, efficiency (ROAS/CPA/CPL/CTR), what is working or
   failing for that ad plan, and what to do with it (scale / maintain / cut / pause). Make the
   comparison between ad groups/ad sets explicit so the marketing team can see which ad plan
   is winning. Base the sections on the ad set / ad group performance table.
8. In spend_recommendations for a campaign analysis, prefer entity_type "ad_set" / "ad_group"
   and name the exact ad group / ad set. Use entity_type "campaign" only for campaign-wide actions.`;
}
