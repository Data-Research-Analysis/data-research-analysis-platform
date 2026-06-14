/**
 * Pure statistical utility functions for data model analysis.
 * 
 * Provides:
 * - Pearson correlation coefficient computation
 * - Anomaly detection using Z-score method
 * - Linear regression (trend detection via least-squares)
 * 
 * All functions are stateless and have no external dependencies.
 */

/**
 * Result of a Pearson correlation between two columns.
 */
export interface CorrelationResult {
    column_a: string;
    column_b: string;
    correlation: number;      // -1 to 1
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    direction: 'positive' | 'negative' | 'none';
    sample_size: number;
}

/**
 * A single anomaly detected in a column.
 */
export interface AnomalyResult {
    column_name: string;
    row_index: number;
    value: number;
    z_score: number;
    mean: number;
    std_dev: number;
    severity: 'high' | 'medium';
}

/**
 * Result of trend analysis on a time-series column.
 */
export interface TrendResult {
    column_name: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    intercept: number;
    r_squared: number;
    data_points: number;
    momentum: 'accelerating' | 'decelerating' | 'steady';
}

// ── Pearson Correlation ────────────────────────────────────────────────

/**
 * Compute Pearson correlation coefficient between two arrays of numbers.
 * Only uses paired non-null values (both must be valid numbers).
 * 
 * @param x - First array of values
 * @param y - Second array of values (same length as x)
 * @returns Correlation coefficient (-1 to 1), or 0 if insufficient data
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 3 || n !== y.length) {
        return 0;
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
        sumXY += x[i] * y[i];
        sumX2 += x[i] * x[i];
        sumY2 += y[i] * y[i];
    }

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
        (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    if (denominator === 0) {
        return 0;
    }

    return Math.round((numerator / denominator) * 1e6) / 1e6;
}

/**
 * Classify correlation strength based on absolute value.
 */
function classifyCorrelationStrength(r: number): CorrelationResult['strength'] {
    const absR = Math.abs(r);
    if (absR >= 0.7) return 'strong';
    if (absR >= 0.4) return 'moderate';
    if (absR >= 0.15) return 'weak';
    return 'none';
}

/**
 * Classify correlation direction.
 */
function classifyCorrelationDirection(r: number): CorrelationResult['direction'] {
    if (r > 0.05) return 'positive';
    if (r < -0.05) return 'negative';
    return 'none';
}

/**
 * Compute correlations between all numeric columns in a result set.
 * Returns only pairs with at least moderate correlation (|r| >= 0.4) or
 * the top N pairs if fewer moderate correlations are found.
 * 
 * @param rows - The data model result set
 * @param columnSummaries - Pre-computed column summaries to identify numeric columns
 * @returns Array of correlation results for meaningful pairs
 */
export function computeColumnCorrelations(
    rows: any[],
    numericColumnNames: string[],
    maxPairs: number = 50
): CorrelationResult[] {
    if (rows.length < 3 || numericColumnNames.length < 2) {
        return [];
    }

    // Extract paired non-null values for each numeric column
    const columnValues: Map<string, number[]> = new Map();
    
    for (const colName of numericColumnNames) {
        const values: number[] = [];
        for (const row of rows) {
            const raw = row[colName];
            if (raw !== null && raw !== undefined && raw !== '') {
                const num = typeof raw === 'number' ? raw : Number(raw);
                if (!isNaN(num) && isFinite(num)) {
                    values.push(num);
                }
            }
        }
        if (values.length >= 3) {
            columnValues.set(colName, values);
        }
    }

    const validColumns = Array.from(columnValues.keys());
    if (validColumns.length < 2) {
        return [];
    }

    // Build a complete set of paired arrays (row-aligned, skipping rows where either is null)
    const allResults: CorrelationResult[] = [];

    for (let i = 0; i < validColumns.length; i++) {
        for (let j = i + 1; j < validColumns.length; j++) {
            const colA = validColumns[i];
            const colB = validColumns[j];

            // Build paired arrays from original rows (row-aligned)
            const x: number[] = [];
            const y: number[] = [];

            for (const row of rows) {
                const rawA = row[colA];
                const rawB = row[colB];
                if (rawA !== null && rawA !== undefined && rawA !== '' &&
                    rawB !== null && rawB !== undefined && rawB !== '') {
                    const numA = typeof rawA === 'number' ? rawA : Number(rawA);
                    const numB = typeof rawB === 'number' ? rawB : Number(rawB);
                    if (!isNaN(numA) && isFinite(numA) && !isNaN(numB) && isFinite(numB)) {
                        x.push(numA);
                        y.push(numB);
                    }
                }
            }

            if (x.length < 3) continue;

            const r = pearsonCorrelation(x, y);

            allResults.push({
                column_a: colA,
                column_b: colB,
                correlation: r,
                strength: classifyCorrelationStrength(r),
                direction: classifyCorrelationDirection(r),
                sample_size: x.length,
            });
        }
    }

    // Sort by absolute correlation descending
    allResults.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    // Filter to meaningful correlations (|r| >= 0.15) or take top N
    const meaningful = allResults.filter(r => Math.abs(r.correlation) >= 0.15);
    
    return meaningful.length > 0
        ? meaningful.slice(0, maxPairs)
        : allResults.slice(0, Math.min(maxPairs, 10));
}

// ── Anomaly Detection (Z-Score) ────────────────────────────────────────

/**
 * Detect anomalies in a numeric column using Z-score method.
 * A value is anomalous if its Z-score exceeds the threshold (default: 2).
 * 
 * @param values - Array of numeric values (must be non-null)
 * @param columnName - Name of the column for labeling
 * @param threshold - Z-score threshold (default: 2.0)
 * @returns Array of detected anomalies
 */
export function detectAnomaliesInColumn(
    values: number[],
    columnName: string,
    threshold: number = 2.0,
    maxAnomalies: number = 100
): AnomalyResult[] {
    const n = values.length;
    if (n < 5) {
        return [];
    }

    // Compute mean and std dev
    const mean = values.reduce((acc, v) => acc + v, 0) / n;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    // If std dev is 0 (all values identical), no anomalies
    if (stdDev === 0) {
        return [];
    }

    const anomalies: AnomalyResult[] = [];

    for (let i = 0; i < values.length; i++) {
        const zScore = Math.abs((values[i] - mean) / stdDev);
        if (zScore > threshold) {
            anomalies.push({
                column_name: columnName,
                row_index: i,
                value: values[i],
                z_score: Math.round(zScore * 100) / 100,
                mean: Math.round(mean * 1e6) / 1e6,
                std_dev: Math.round(stdDev * 1e6) / 1e6,
                severity: zScore > threshold * 1.5 ? 'high' : 'medium',
            });
        }
    }

    // Sort by Z-score descending (most anomalous first)
    anomalies.sort((a, b) => b.z_score - a.z_score);

    return anomalies.slice(0, maxAnomalies);
}

/**
 * Detect anomalies across all numeric columns in a result set.
 * 
 * @param rows - The data model result set
 * @param numericColumnNames - Names of numeric columns to check
 * @param threshold - Z-score threshold
 * @returns Array of all anomalies found, sorted by severity
 */
export function detectAnomalies(
    rows: any[],
    numericColumnNames: string[],
    threshold: number = 2.0,
    maxAnomalies: number = 100
): AnomalyResult[] {
    const allAnomalies: AnomalyResult[] = [];

    for (const colName of numericColumnNames) {
        const values: number[] = [];
        for (const row of rows) {
            const raw = row[colName];
            if (raw !== null && raw !== undefined && raw !== '') {
                const num = typeof raw === 'number' ? raw : Number(raw);
                if (!isNaN(num) && isFinite(num)) {
                    values.push(num);
                }
            }
        }

        const colAnomalies = detectAnomaliesInColumn(values, colName, threshold, maxAnomalies);
        allAnomalies.push(...colAnomalies);
    }

    // Sort globally by Z-score descending
    allAnomalies.sort((a, b) => b.z_score - a.z_score);

    return allAnomalies.slice(0, maxAnomalies);
}

// ── Linear Regression (Trend Detection) ────────────────────────────────

/**
 * Fit a simple linear regression (y = slope * x + intercept) using least squares.
 * 
 * @param y - Array of dependent variable values
 * @returns Object with slope, intercept, and R-squared
 */
export function linearRegression(y: number[]): { slope: number; intercept: number; r_squared: number } {
    const n = y.length;
    if (n < 3) {
        return { slope: 0, intercept: 0, r_squared: 0 };
    }

    // x values are just indices: 0, 1, 2, ...
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += y[i];
        sumXY += i * y[i];
        sumX2 += i * i;
        sumY2 += y[i] * y[i];
    }

    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) {
        return { slope: 0, intercept: sumY / n, r_squared: 0 };
    }

    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    // R-squared (coefficient of determination)
    const meanY = sumY / n;
    let ssRes = 0, ssTot = 0;
    for (let i = 0; i < n; i++) {
        const predicted = slope * i + intercept;
        ssRes += Math.pow(y[i] - predicted, 2);
        ssTot += Math.pow(y[i] - meanY, 2);
    }

    const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

    return {
        slope: Math.round(slope * 1e6) / 1e6,
        intercept: Math.round(intercept * 1e6) / 1e6,
        r_squared: Math.round(rSquared * 1e6) / 1e6,
    };
}

/**
 * Classify trend direction based on slope and R-squared.
 */
function classifyTrendDirection(slope: number, rSquared: number): TrendResult['direction'] {
    // Only classify as increasing/decreasing if the model explains enough variance
    if (rSquared < 0.3) return 'stable';
    if (Math.abs(slope) < 1e-10) return 'stable';
    return slope > 0 ? 'increasing' : 'decreasing';
}

/**
 * Detect momentum by comparing the first half trend to the second half trend.
 * If the second half slope is steeper, it's accelerating; flatter = decelerating.
 */
function detectMomentum(y: number[]): TrendResult['momentum'] {
    if (y.length < 6) return 'steady'; // Need enough data to split

    const mid = Math.floor(y.length / 2);
    const firstHalf = y.slice(0, mid);
    const secondHalf = y.slice(mid);

    const reg1 = linearRegression(firstHalf);
    const reg2 = linearRegression(secondHalf);

    // Compare absolute slopes
    const absSlope1 = Math.abs(reg1.slope);
    const absSlope2 = Math.abs(reg2.slope);

    // If the direction changed, consider it decelerating
    if ((reg1.slope > 0 && reg2.slope < 0) || (reg1.slope < 0 && reg2.slope > 0)) {
        return 'decelerating';
    }

    // Compare magnitudes
    const ratio = absSlope1 > 0 ? absSlope2 / absSlope1 : (absSlope2 > 0 ? 2 : 1);
    if (ratio > 1.2) return 'accelerating';
    if (ratio < 0.8) return 'decelerating';
    return 'steady';
}

/**
 * Analyze trends in time-series or ordered numeric columns.
 * Works on any column that has a meaningful order (e.g., sorted by date).
 * 
 * @param rows - The data model result set (assumed to have a meaningful row order)
 * @param numericColumnNames - Names of numeric columns to analyze
 * @param minR2 - Minimum R-squared to consider a trend significant (default: 0.3)
 * @returns Array of trend results for columns with significant trends
 */
export function computeTrends(
    rows: any[],
    numericColumnNames: string[],
    minR2: number = 0.3
): TrendResult[] {
    if (rows.length < 5) {
        return [];
    }

    const results: TrendResult[] = [];

    for (const colName of numericColumnNames) {
        const values: number[] = [];
        for (const row of rows) {
            const raw = row[colName];
            if (raw !== null && raw !== undefined && raw !== '') {
                const num = typeof raw === 'number' ? raw : Number(raw);
                if (!isNaN(num) && isFinite(num)) {
                    values.push(num);
                }
            }
        }

        if (values.length < 5) continue;

        const { slope, intercept, r_squared } = linearRegression(values);
        const direction = classifyTrendDirection(slope, r_squared);
        const momentum = detectMomentum(values);

        results.push({
            column_name: colName,
            direction,
            slope,
            intercept,
            r_squared,
            data_points: values.length,
            momentum,
        });
    }

    // Sort by R-squared descending (strongest trends first)
    results.sort((a, b) => b.r_squared - a.r_squared);

    // Only return columns with significant trends, or the top 5 if none are significant
    const significant = results.filter(r => r.r_squared >= minR2);
    return significant.length > 0
        ? significant
        : results.slice(0, Math.min(5, results.length));
}