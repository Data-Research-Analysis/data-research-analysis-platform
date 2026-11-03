#!/usr/bin/env tsx
/**
 * Credit price calibration (implementation plan Phase 0).
 *
 * Computes real cost-per-action distributions from ai_call_logs so the
 * action -> credit table can be set from data instead of guesses.
 *
 * For every feature_key it reports the cost distribution PER ACTION
 * (an action = one user-facing deliverable: a plan build, an analysis,
 * a chat conversation, ...; calls without action_id count as their own
 * action). Only successful calls are included — failed/fallback runs
 * must never be priced.
 *
 * Usage (from backend/):
 *   npm run calibrate:credits                          # last 90 days
 *   npm run calibrate:credits -- --days=30
 *   npm run calibrate:credits -- --since=2026-10-01
 *   npm run calibrate:credits -- --feature=plan_build
 *   npm run calibrate:credits -- --bands               # token-banded P90 for banded actions
 *
 * DB connection honours the usual POSTGRESQL_* env vars and can be
 * pointed at any host via CALIBRATION_DB_HOST / CALIBRATION_DB_PORT
 * (e.g. localhost:5436 when running from the host against the Docker
 * postgres).
 */

import { DataSource } from 'typeorm';
import { DRAAICallLog } from '../src/models/DRAAICallLog.js';
import dotenv from 'dotenv';
dotenv.config();

interface ActionRow {
    feature_key: string;
    action_key: string;
    action_cost: number;
    calls: number;
    action_tokens: number;
    max_call_tokens: number;
    max_call_cost: number;
    org_count: number;
}

interface FeatureStats {
    feature_key: string;
    actions: number;
    calls: number;
    total_cost_usd: number;
    mean_action_cost: number;
    p50_action_cost: number;
    p90_action_cost: number;
    p95_action_cost: number;
    max_action_cost: number;
    avg_call_cost: number;
    max_call_cost: number;
    bands?: { band: number; actions: number; p90_action_cost: number; mean_action_cost: number }[];
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function fmt(v: number): string {
    return v.toFixed(4);
}

function args(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const a of process.argv.slice(2)) {
        const m = a.match(/^--([^=]+)(?:=(.*))?$/);
        if (m) out[m[1]] = m[2] ?? 'true';
    }
    return out;
}

async function main(): Promise<void> {
    const a = args();
    const days = a.days ? parseInt(a.days, 10) : 90;
    const featureFilter = a.feature || null;
    const wantBands = a.bands === 'true';

    const end = new Date();
    const start = a.since ? new Date(a.since) : new Date(end.getTime() - days * 86_400_000);

    const host = process.env.CALIBRATION_DB_HOST || process.env.POSTGRESQL_HOST || 'localhost';
    const port = parseInt(process.env.CALIBRATION_DB_PORT || process.env.POSTGRESQL_PORT || '5432', 10);
    const dataSource = new DataSource({
        type: 'postgres',
        host,
        port,
        username: process.env.POSTGRESQL_USERNAME || 'postgres',
        password: process.env.POSTGRESQL_PASSWORD || '',
        database: process.env.POSTGRESQL_DB_NAME || 'postgres_dra_db',
        synchronize: false,
        logging: false,
        entities: [DRAAICallLog],
    });

    try {
        await dataSource.initialize();
        const manager = dataSource.manager;

        const actionRows: ActionRow[] = await manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('log.feature_key', 'feature_key')
            .addSelect('COALESCE(log.action_id, CONCAT(\'call:\', log.id))', 'action_key')
            .addSelect('SUM(log.cost_usd)', 'action_cost')
            .addSelect('COUNT(*)', 'calls')
            .addSelect('SUM(log.total_tokens)', 'action_tokens')
            .addSelect('MAX(log.total_tokens)', 'max_call_tokens')
            .addSelect('MAX(log.cost_usd)', 'max_call_cost')
            .addSelect('COUNT(DISTINCT log.org_id)', 'org_count')
            .where('log.status = :status', { status: 'success' })
            .andWhere('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .groupBy('log.feature_key')
            .addGroupBy('action_key')
            .orderBy('log.feature_key')
            .addOrderBy('action_cost', 'DESC')
            .getRawMany<ActionRow>();

        for (const r of actionRows) {
            r.action_cost = Number(r.action_cost);
            r.calls = parseInt(String(r.calls), 10);
            r.action_tokens = parseInt(String(r.action_tokens), 10);
            r.max_call_tokens = parseInt(String(r.max_call_tokens), 10);
            r.max_call_cost = Number(r.max_call_cost);
            r.org_count = parseInt(String(r.org_count), 10);
        }

        const windowStats = await manager
            .createQueryBuilder(DRAAICallLog, 'log')
            .select('COUNT(*)', 'calls')
            .addSelect('COALESCE(SUM(log.cost_usd), 0)', 'cost')
            .addSelect('COUNT(DISTINCT log.org_id)', 'orgs')
            .addSelect('COUNT(DISTINCT log.feature_key)', 'features')
            .addSelect('MIN(log.created_at)', 'first_log')
            .addSelect('MAX(log.created_at)', 'last_log')
            .where('log.status = :status', { status: 'success' })
            .andWhere('log.created_at >= :start', { start })
            .andWhere('log.created_at < :end', { end })
            .getRawOne();

        if (!actionRows.length) {
            console.log(`No successful AI calls in window ${start.toISOString().slice(0, 10)} .. ${end.toISOString().slice(0, 10)}`);
            return;
        }

        const byFeature = new Map<string, ActionRow[]>();
        for (const r of actionRows) {
            const list = byFeature.get(r.feature_key) ?? [];
            list.push(r);
            byFeature.set(r.feature_key, list);
        }

        const stats: FeatureStats[] = [];
        for (const [feature, rows] of byFeature) {
            const costs = rows.map((r) => r.action_cost).sort((x, y) => x - y);
            const callCosts = rows.map((r) => r.action_cost / Math.max(1, r.calls)).sort((x, y) => x - y);
            const s: FeatureStats = {
                feature_key: feature,
                actions: rows.length,
                calls: rows.reduce((s2, r) => s2 + r.calls, 0),
                total_cost_usd: costs.reduce((s2, c) => s2 + c, 0),
                mean_action_cost: costs.reduce((s2, c) => s2 + c, 0) / costs.length,
                p50_action_cost: percentile(costs, 50),
                p90_action_cost: percentile(costs, 90),
                p95_action_cost: percentile(costs, 95),
                max_action_cost: costs[costs.length - 1] ?? 0,
                avg_call_cost: callCosts.reduce((s2, c) => s2 + c, 0) / callCosts.length,
                max_call_cost: Math.max(...rows.map((r) => r.max_call_cost), 0),
            };
            if (wantBands && rows.length >= 3) {
                const sorted = [...rows].sort((x, y) => x.action_tokens - y.action_tokens);
                const n = sorted.length;
                const bands: { band: number; actions: number; p90_action_cost: number; mean_action_cost: number }[] = [];
                for (let b = 0; b < 3; b++) {
                    const lo = Math.floor((b * n) / 3);
                    const hi = Math.max(lo + 1, Math.floor(((b + 1) * n) / 3));
                    const slice = sorted.slice(lo, hi).map((r) => r.action_cost).sort((x, y) => x - y);
                    bands.push({
                        band: b + 1,
                        actions: slice.length,
                        p90_action_cost: percentile(slice, 90),
                        mean_action_cost: slice.reduce((s2, c) => s2 + c, 0) / Math.max(1, slice.length),
                    });
                }
                s.bands = bands;
            }
            stats.push(s);
        }

        stats.sort((x, y) => y.total_cost_usd - x.total_cost_usd);

        console.log('\n=== Credit price calibration (Phase 0) ===');
        console.log(
            `Window: ${start.toISOString().slice(0, 10)} .. ${end.toISOString().slice(0, 10)}` +
                ` (${Math.round((end.getTime() - start.getTime()) / 86_400_000)} days)`
        );
        console.log(
            `Coverage: ${windowStats?.calls ?? 0} successful calls, $${fmt(Number(windowStats?.cost ?? 0))} total,` +
                ` ${windowStats?.orgs ?? 0} orgs, ${windowStats?.features ?? 0} features`
        );
        if (featureFilter) console.log(`Feature filter: ${featureFilter}`);

        console.log('\nPer-action cost distribution (cost per user-facing deliverable):');
        console.log(
            '| feature_key | actions | calls | total $ | mean $ | P50 $ | P90 $ | P95 $ | max $ | avg call $ | max call $ |'
        );
        console.log('|---|---|---|---|---|---|---|---|---|---|---|');
        for (const s of stats) {
            if (featureFilter && s.feature_key !== featureFilter) continue;
            console.log(
                `| ${s.feature_key} | ${s.actions} | ${s.calls} | ${fmt(s.total_cost_usd)} | ${fmt(s.mean_action_cost)} |` +
                    ` ${fmt(s.p50_action_cost)} | ${fmt(s.p90_action_cost)} | ${fmt(s.p95_action_cost)} | ${fmt(s.max_action_cost)} |` +
                    ` ${fmt(s.avg_call_cost)} | ${fmt(s.max_call_cost)} |`
            );
        }

        if (wantBands) {
            console.log('\nToken-banded P90 (proxy for row/event size bands — 3 equal-size bands by action tokens):');
            console.log('| feature_key | band | actions | mean $ | P90 $ |');
            console.log('|---|---|---|---|---|');
            for (const s of stats) {
                if (featureFilter && s.feature_key !== featureFilter) continue;
                if (!s.bands) continue;
                for (const b of s.bands) {
                    console.log(`| ${s.feature_key} | ${b.band} | ${b.actions} | ${fmt(b.mean_action_cost)} | ${fmt(b.p90_action_cost)} |`);
                }
            }
        }

        console.log('\nTop actions by cost (largest single deliverables, useful for band design):');
        console.log('| feature_key | action_key | calls | tokens | cost $ |');
        console.log('|---|---|---|---|---|');
        for (const r of [...actionRows].sort((x, y) => y.action_cost - x.action_cost).slice(0, 20)) {
            if (featureFilter && r.feature_key !== featureFilter) continue;
            console.log(`| ${r.feature_key} | ${r.action_key} | ${r.calls} | ${r.action_tokens} | ${fmt(r.action_cost)} |`);
        }

        const out = {
            generated_at: new Date().toISOString(),
            window: { start: start.toISOString(), end: end.toISOString(), days },
            coverage: {
                calls: parseInt(windowStats?.calls ?? '0', 10),
                cost_usd: Number(windowStats?.cost ?? 0),
                orgs: parseInt(windowStats?.orgs ?? '0', 10),
                features: parseInt(windowStats?.features ?? '0', 10),
            },
            features: stats,
        };
        const fs = await import('node:fs');
        const outPath = new URL('../../documentation/credit-pricing-calibration.json', import.meta.url);
        fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
        console.log(`\nSnapshot written to ${outPath.pathname}`);
    } finally {
        await dataSource.destroy();
    }
}

main().catch((err) => {
    console.error('Calibration failed:', err);
    process.exit(1);
});
