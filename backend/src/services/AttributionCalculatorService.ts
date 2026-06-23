import { AppDataSource } from '../datasources/PostgresDS.js';
import {
    AttributionModel,
    IAttributionCalculationRequest,
    IAttributionCalculationResult,
    IAttributionEvent,
    IAttributionWeights
} from '../interfaces/IAttribution.js';

/**
 * Attribution Calculator Service
 * Phase 2: Marketing Attribution Engine
 * 
 * Implements five attribution models:
 * - First-Touch: 100% credit to first interaction
 * - Last-Touch: 100% credit to last interaction before conversion
 * - Linear: Equal credit across all touchpoints
 * - Time-Decay: More credit to recent interactions (7-day half-life)
 * - U-Shaped (Position-Based): 40% first, 40% last, 20% middle
 */
export class AttributionCalculatorService {
    private static instance: AttributionCalculatorService;

    // Time-decay half-life in hours (7 days)
    private readonly TIME_DECAY_HALF_LIFE_HOURS = 168;

    /** For use by FunnelController — accesses private weight calculators */
    private constructor() {}

    public static getInstance(): AttributionCalculatorService {
        if (!AttributionCalculatorService.instance) {
            AttributionCalculatorService.instance = new AttributionCalculatorService();
        }
        return AttributionCalculatorService.instance;
    }

    /**
     * Calculate attribution weights for a list of touchpoints using the given model.
     * This is a convenience wrapper that makes weight calculation accessible
     * for ad-platform-based attribution (where touchpoints are campaign×date rows).
     */
    public calculateWeightsPublic(
        model: AttributionModel,
        touchpoints: Array<{ eventTimestamp: Date; channelId?: number; eventValue?: number }>,
        conversionEvent: { eventTimestamp: Date },
    ): number[] {
        return this.calculateWeights(model, touchpoints as IAttributionEvent[], conversionEvent as IAttributionEvent);
    }

    /**
     * Calculate attribution for a conversion event
     */
    public async calculateAttribution(
        request: IAttributionCalculationRequest
    ): Promise<IAttributionCalculationResult> {
        const { conversionEventId, model, touchpoints } = request;

        if (touchpoints.length === 0) {
            console.warn(`[AttributionCalculator] No touchpoints for conversion ${conversionEventId}`);
            return {
                conversionEventId,
                model,
                touchpoints: [],
                totalAttributedValue: 0
            };
        }

        // Sort touchpoints by timestamp
        const sortedTouchpoints = [...touchpoints].sort(
            (a, b) => a.eventTimestamp.getTime() - b.eventTimestamp.getTime()
        );

        // Get conversion event
        const conversionEvent = touchpoints.find(tp => tp.id === conversionEventId);
        if (!conversionEvent) {
            throw new Error(`Conversion event ${conversionEventId} not found in touchpoints`);
        }

        const conversionValue = conversionEvent.eventValue || 0;

        // Calculate weights based on model
        const weights = this.calculateWeights(model, sortedTouchpoints, conversionEvent);

        // Build result
        const result: IAttributionCalculationResult = {
            conversionEventId,
            model,
            touchpoints: sortedTouchpoints.map((tp, index) => {
                const weight = weights[index];
                return {
                    touchpointEventId: tp.id,
                    channelId: tp.channelId!,
                    weight,
                    attributedValue: weight * conversionValue,
                    position: index + 1,
                    timeToConversionHours: this.calculateHoursBetween(
                        tp.eventTimestamp,
                        conversionEvent.eventTimestamp
                    )
                };
            }),
            totalAttributedValue: conversionValue
        };

        return result;
    }

    /**
     * Save attribution touchpoints to database
     */
    public async saveAttributionTouchpoints(
        result: IAttributionCalculationResult,
        projectId: number,
        userIdentifier: string
    ): Promise<void> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            // Calculate all attribution models at once
            const allModels: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped', 'data_driven'];
            const modelWeights: Record<AttributionModel, number[]> = {} as any;

            // Get original touchpoint events for recalculation
            const eventIds = result.touchpoints.map(tp => tp.touchpointEventId);
            const events = await queryRunner.query(
                `SELECT * FROM "dra_attribution_events"
                 WHERE id = ANY($1)
                 ORDER BY event_timestamp ASC`,
                [eventIds]
            );

            const conversionEvent = events.find((e: any) => e.id === result.conversionEventId);

            // Calculate weights for all models
            for (const model of allModels) {
                modelWeights[model] = this.calculateWeights(model, events, conversionEvent);
            }

            // Insert touchpoints with weights for all models
            for (let i = 0; i < result.touchpoints.length; i++) {
                const tp = result.touchpoints[i];

                await queryRunner.query(
                    `INSERT INTO "dra_attribution_touchpoints"
                     (project_id, user_identifier, conversion_event_id, touchpoint_event_id,
                      channel_id, touchpoint_position, time_to_conversion_hours,
                      attribution_weight_first_touch, attribution_weight_last_touch,
                      attribution_weight_linear, attribution_weight_time_decay, attribution_weight_u_shaped)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                    [
                        projectId,
                        userIdentifier,
                        result.conversionEventId,
                        tp.touchpointEventId,
                        tp.channelId,
                        tp.position,
                        tp.timeToConversionHours,
                        modelWeights['first_touch'][i],
                        modelWeights['last_touch'][i],
                        modelWeights['linear'][i],
                        modelWeights['time_decay'][i],
                        modelWeights['u_shaped'][i]
                    ]
                );
            }

            await queryRunner.commitTransaction();
            console.log(
                `[AttributionCalculator] Saved ${result.touchpoints.length} touchpoints for conversion ${result.conversionEventId}`
            );

        } catch (error) {
            await queryRunner.rollbackTransaction();
            console.error('[AttributionCalculator] Error saving touchpoints:', error);
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Calculate weights based on attribution model
     */
    private calculateWeights(
        model: AttributionModel,
        touchpoints: IAttributionEvent[],
        conversionEvent: IAttributionEvent
    ): number[] {
        const count = touchpoints.length;

        switch (model) {
            case 'first_touch':
                return this.calculateFirstTouchWeights(count);

            case 'last_touch':
                return this.calculateLastTouchWeights(count);

            case 'linear':
                return this.calculateLinearWeights(count);

            case 'time_decay':
                return this.calculateTimeDecayWeights(touchpoints, conversionEvent);

            case 'u_shaped':
                return this.calculateUShapedWeights(count);

            case 'data_driven':
                return this.calculateDataDrivenWeights(touchpoints, conversionEvent);

            default:
                console.warn(`[AttributionCalculator] Unknown model: ${model}, using linear`);
                return this.calculateLinearWeights(count);
        }
    }

    /**
     * First-Touch: 100% to first touchpoint
     */
    private calculateFirstTouchWeights(count: number): number[] {
        const weights = new Array(count).fill(0);
        weights[0] = 1.0;
        return weights;
    }

    /**
     * Last-Touch: 100% to last touchpoint
     */
    private calculateLastTouchWeights(count: number): number[] {
        const weights = new Array(count).fill(0);
        weights[count - 1] = 1.0;
        return weights;
    }

    /**
     * Linear: Equal credit to all touchpoints
     */
    private calculateLinearWeights(count: number): number[] {
        const equalWeight = 1.0 / count;
        return new Array(count).fill(equalWeight);
    }

    /**
     * Time-Decay: Exponential decay with 7-day half-life
     * Recent touchpoints get more credit
     */
    private calculateTimeDecayWeights(
        touchpoints: IAttributionEvent[],
        conversionEvent: IAttributionEvent
    ): number[] {
        const weights: number[] = [];
        let totalWeight = 0;

        // Calculate exponential weights
        for (const touchpoint of touchpoints) {
            const hoursSinceTouch = this.calculateHoursBetween(
                touchpoint.eventTimestamp,
                conversionEvent.eventTimestamp
            );

            // Exponential decay: weight = 2^(-hours / half_life)
            const weight = Math.pow(2, -hoursSinceTouch / this.TIME_DECAY_HALF_LIFE_HOURS);
            weights.push(weight);
            totalWeight += weight;
        }

        // Normalize to sum to 1.0
        return weights.map(w => w / totalWeight);
    }

    /**
     * U-Shaped (Position-Based): 40% first, 40% last, 20% distributed to middle
     */
    private calculateUShapedWeights(count: number): number[] {
        if (count === 1) {
            return [1.0];
        }

        if (count === 2) {
            return [0.5, 0.5];
        }

        const weights = new Array(count).fill(0);
        const middleCount = count - 2;
        const middleWeight = 0.2 / middleCount;

        weights[0] = 0.4; // First touch
        weights[count - 1] = 0.4; // Last touch

        // Distribute 20% among middle touchpoints
        for (let i = 1; i < count - 1; i++) {
            weights[i] = middleWeight;
        }

        return weights;
    }

    /**
     * Data-Driven: Shapley Value attribution
     * Calculates each channel's marginal contribution across all possible
     * channel subsets (coalitions). For 6+ channels uses Monte Carlo approximation.
     */
    private calculateDataDrivenWeights(
        touchpoints: IAttributionEvent[],
        conversionEvent: IAttributionEvent,
    ): number[] {
        const count = touchpoints.length;
        if (count === 0) return [];
        if (count === 1) return [1.0];

        // Group touchpoints by channel for Shapley calculation
        const channelGroups = new Map<number, number[]>();
        touchpoints.forEach((tp, idx) => {
            const chId = tp.channelId ?? 0;
            if (!channelGroups.has(chId)) channelGroups.set(chId, []);
            channelGroups.get(chId)!.push(idx);
        });

        const channelIds = Array.from(channelGroups.keys());
        const n = channelIds.length;

        if (n === 0) return new Array(count).fill(1 / count);
        if (n === 1) {
            // Single channel gets full credit, distribute evenly among its touchpoints
            const allIdx = channelGroups.get(channelIds[0])!;
            const w = 1 / allIdx.length;
            return touchpoints.map((_, idx) => allIdx.includes(idx) ? w : 0);
        }

        // Shapley value: φ_i = Σ_S⊆N\{i} (|S|!(n-|S|-1)!) / n! * (v(S∪{i}) - v(S))
        // where v(S) = conversion_value_weight of coalition S
        // We use event count as the value function for simplicity
        const shapleyValues = new Map<number, number>();
        const factCache = [1];
        for (let i = 1; i <= n; i++) factCache[i] = factCache[i - 1] * i;

        // Precompute value of each coalition (sum of event values for channels in the set)
        const coalitionValues = new Map<string, number>();
        function getCoalitionValue(chSet: Set<number>): number {
            const key = Array.from(chSet).sort().join(',');
            if (coalitionValues.has(key)) return coalitionValues.get(key)!;
            let value = 0;
            for (const [chId, indices] of channelGroups) {
                if (chSet.has(chId)) {
                    for (const idx of indices) {
                        value += touchpoints[idx].eventValue ?? 1;
                    }
                }
            }
            coalitionValues.set(key, value);
            return value;
        }

        // Monte Carlo approximation for n > 6 channels
        if (n > 6) {
            const MONTE_CARLO_SAMPLES = 5000;
            const marginalContributions = new Map<number, number[]>();
            for (const chId of channelIds) marginalContributions.set(chId, []);

            for (let sample = 0; sample < MONTE_CARLO_SAMPLES; sample++) {
                const perm = [...channelIds].sort(() => Math.random() - 0.5);
                let prevSet = new Set<number>();
                let prevValue = 0;

                for (const chId of perm) {
                    const newSet = new Set(prevSet);
                    newSet.add(chId);
                    const newValue = getCoalitionValue(newSet);
                    marginalContributions.get(chId)!.push(newValue - prevValue);
                    prevSet = newSet;
                    prevValue = newValue;
                }
            }

            for (const chId of channelIds) {
                const contribs = marginalContributions.get(chId)!;
                shapleyValues.set(chId, contribs.reduce((a, b) => a + b, 0) / contribs.length);
            }
        } else {
            // Exact Shapley for small number of channels
            const allChSet = new Set(channelIds);

            for (const chId of channelIds) {
                const others = channelIds.filter(id => id !== chId);
                let shapley = 0;

                // Iterate over all subsets of other channels
                const totalSubsets = 1 << others.length;
                for (let mask = 0; mask < totalSubsets; mask++) {
                    const coalition = new Set<number>();
                    for (let j = 0; j < others.length; j++) {
                        if (mask & (1 << j)) coalition.add(others[j]);
                    }

                    const s = coalition.size;
                    const weight = (factCache[s] * factCache[n - s - 1]) / factCache[n];

                    const withoutValue = getCoalitionValue(coalition);
                    const withCh = new Set(coalition);
                    withCh.add(chId);
                    const withValue = getCoalitionValue(withCh);

                    shapley += weight * (withValue - withoutValue);
                }

                shapleyValues.set(chId, shapley);
            }
        }

        // Normalize to sum to 1.0
        const totalShapley = Array.from(shapleyValues.values()).reduce((a, b) => a + b, 0);
        if (totalShapley > 0) {
            for (const chId of channelIds) {
                shapleyValues.set(chId, shapleyValues.get(chId)! / totalShapley);
            }
        }

        // Distribute each channel's Shapley value evenly among its touchpoints
        return touchpoints.map((tp, idx) => {
            const chId = tp.channelId ?? 0;
            const group = channelGroups.get(chId);
            if (!group) return 0;
            const chValue = shapleyValues.get(chId) ?? 0;
            return chValue / group.length;
        });
    }

    /**
     * Calculate hours between two dates
     */
    private calculateHoursBetween(startDate: Date, endDate: Date): number {
        const diffMs = endDate.getTime() - startDate.getTime();
        return diffMs / (1000 * 60 * 60);
    }

    /**
     * Get attribution summary by channel for a project
     */
    public async getChannelAttribution(
        projectId: number,
        model: AttributionModel,
        startDate: Date,
        endDate: Date
    ): Promise<Array<{ channelId: number; channelName: string; conversions: number; revenue: number }>> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const weightColumn = this.getWeightColumnName(model);

            const result = await queryRunner.query(
                `SELECT 
                    t.channel_id,
                    c.name as channel_name,
                    COUNT(DISTINCT t.conversion_event_id) as conversions,
                    COALESCE(SUM(e.event_value * t.${weightColumn}), 0) as revenue
                 FROM "dra_attribution_touchpoints" t
                 INNER JOIN "dra_attribution_channels" c ON c.id = t.channel_id
                 INNER JOIN "dra_attribution_events" e ON e.id = t.conversion_event_id
                 WHERE t.project_id = $1
                   AND e.event_timestamp BETWEEN $2 AND $3
                   AND e.event_type = 'conversion'
                 GROUP BY t.channel_id, c.name
                 ORDER BY revenue DESC`,
                [projectId, startDate, endDate]
            );

            return result.map((row: any) => ({
                channelId: row.channel_id,
                channelName: row.channel_name,
                conversions: parseInt(row.conversions),
                revenue: parseFloat(row.revenue)
            }));

        } catch (error) {
            console.error('[AttributionCalculator] Error getting channel attribution:', error);
            return [];
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get weight column name for SQL queries
     */
    private getWeightColumnName(model: AttributionModel): string {
        const columnMap: Record<AttributionModel, string> = {
            'first_touch': 'attribution_weight_first_touch',
            'last_touch': 'attribution_weight_last_touch',
            'linear': 'attribution_weight_linear',
            'time_decay': 'attribution_weight_time_decay',
            'u_shaped': 'attribution_weight_u_shaped',
            'data_driven': 'attribution_weight_data_driven'
        };
        return columnMap[model];
    }
}
