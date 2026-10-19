import { getAppDataSource } from '../datasources/PostgresDS.js';
import { DRAPlanOutcome } from '../models/DRAPlanOutcome.js';
import { DRAPlanBenchmark } from '../models/DRAPlanBenchmark.js';
import { PlanBenchmarkMetric, PlanBenchmarkSource, IPlanBenchmark } from '../types/IPaidMediaPlan.js';

const BENCHMARK_METRICS: PlanBenchmarkMetric[] = ['cpc', 'cpm', 'ctr', 'cvr', 'cpl', 'roas', 'cpa'];
const MIN_SAMPLE = Number(process.env.PLAN_BENCHMARK_MIN_SAMPLE ?? 30);

const PLAN_PLATFORM_TO_CHANNEL: Record<string, string> = {
    google_search: 'google_ads',
    google_display: 'google_ads',
    meta_ads: 'meta_ads',
    linkedin_ads: 'linkedin_ads',
    tiktok_ads: 'tiktok_ads',
};

export function normalizePlatform(platform: string): string {
    return PLAN_PLATFORM_TO_CHANNEL[platform] ?? platform;
}

function benchmarkDTO(row: DRAPlanBenchmark): IPlanBenchmark {
    return {
        id: row.id,
        industry: row.industry,
        market: row.market,
        platform: row.platform,
        metric: row.metric,
        value: Number(row.value),
        sampleSize: row.sample_size,
        source: row.source,
        confidence: Number(row.confidence),
        updatedAt: row.updated_at.toISOString(),
    };
}

interface IAggregateBucket {
    industry: string;
    market: string;
    platform: string;
    rows: number;
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
}

export class PlanBenchmarkService {
    private static instance: PlanBenchmarkService;

    private constructor() {}

    public static getInstance(): PlanBenchmarkService {
        if (!PlanBenchmarkService.instance) {
            PlanBenchmarkService.instance = new PlanBenchmarkService();
        }
        return PlanBenchmarkService.instance;
    }

    public async recompute(): Promise<number> {
        const dataSource = await getAppDataSource();
        const benchmarkRepository = dataSource.getRepository(DRAPlanBenchmark);

        const outcomes = await dataSource.getRepository(DRAPlanOutcome).find();
        const buckets = new Map<string, IAggregateBucket>();

        for (const outcome of outcomes) {
            const platform = outcome.channel_type ?? 'unknown';
            const market = outcome.market ?? '*';
            const industry = 'generic';
            const key = `${industry}|${market}|${platform}`;
            const bucket = buckets.get(key) ?? {
                industry,
                market,
                platform,
                rows: 0,
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                revenue: 0,
            };
            bucket.rows += 1;
            bucket.spend += Number(outcome.spend) || 0;
            bucket.impressions += Number(outcome.impressions) || 0;
            bucket.clicks += Number(outcome.clicks) || 0;
            bucket.conversions += Number(outcome.conversions) || 0;
            bucket.revenue += Number(outcome.revenue) || 0;
            buckets.set(key, bucket);
        }

        let written = 0;
        for (const bucket of buckets.values()) {
            const confidence = Math.min(1, bucket.rows / MIN_SAMPLE);
            const values: Record<PlanBenchmarkMetric, number | null> = {
                cpc: bucket.clicks > 0 ? bucket.spend / bucket.clicks : null,
                cpm: bucket.impressions > 0 ? (bucket.spend / bucket.impressions) * 1000 : null,
                ctr: bucket.impressions > 0 ? bucket.clicks / bucket.impressions : null,
                cvr: bucket.clicks > 0 ? bucket.conversions / bucket.clicks : null,
                cpl: bucket.conversions > 0 ? bucket.spend / bucket.conversions : null,
                cpa: bucket.conversions > 0 ? bucket.spend / bucket.conversions : null,
                roas: bucket.spend > 0 ? bucket.revenue / bucket.spend : null,
            };

            for (const metric of BENCHMARK_METRICS) {
                const value = values[metric];
                if (value === null) continue;
                const existing = await benchmarkRepository.findOne({
                    where: {
                        industry: bucket.industry,
                        market: bucket.market,
                        platform: bucket.platform,
                        metric,
                        source: 'learned' as PlanBenchmarkSource,
                    },
                });
                const row = existing ?? benchmarkRepository.create({
                    industry: bucket.industry,
                    market: bucket.market,
                    platform: bucket.platform,
                    metric,
                    source: 'learned',
                });
                row.value = Math.round(value * 10000) / 10000;
                row.sample_size = bucket.rows;
                row.confidence = Math.round(confidence * 10000) / 10000;
                await benchmarkRepository.save(row);
                written += 1;
            }
        }
        return written;
    }

    public async list(params: { industry?: string; market?: string; platform?: string; source?: string } = {}): Promise<IPlanBenchmark[]> {
        const dataSource = await getAppDataSource();
        const query = dataSource.getRepository(DRAPlanBenchmark).createQueryBuilder('benchmark');
        if (params.industry) query.andWhere('benchmark.industry IN (:...industries)', { industries: [params.industry, 'generic'] });
        if (params.market) query.andWhere('benchmark.market = :market', { market: params.market });
        if (params.platform) query.andWhere('benchmark.platform = :platform', { platform: params.platform });
        if (params.source) query.andWhere('benchmark.source = :source', { source: params.source });
        const rows = await query.orderBy('benchmark.updated_at', 'DESC').take(500).getMany();
        return rows.map(benchmarkDTO);
    }

    public async getForPlan(plan: any): Promise<IPlanBenchmark[]> {
        const industry = plan?.state?.core_facts?.industry ?? 'generic';
        const markets = Array.isArray(plan?.markets) && plan.markets.length > 0 ? plan.markets : ['*'];
        const planPlatforms = Array.isArray(plan?.platforms) && plan.platforms.length > 0 ? plan.platforms : null;
        const platforms = planPlatforms ? planPlatforms.map(normalizePlatform) : null;

        const dataSource = await getAppDataSource();
        const query = dataSource.getRepository(DRAPlanBenchmark)
            .createQueryBuilder('benchmark')
            .where('benchmark.industry IN (:...industries)', { industries: [industry, 'generic'] })
            .andWhere('benchmark.market IN (:...markets)', { markets });
        if (platforms) {
            query.andWhere('benchmark.platform IN (:...platforms)', { platforms });
        }
        const rows = await query.orderBy('benchmark.confidence', 'DESC').take(200).getMany();
        return rows.map(benchmarkDTO);
    }
}
