/**
 * SSR Performance Interfaces
 */

export interface SSRMetrics {
    pageLoadTime: number;
    hydrationTime: number;
    ttfb: number; // Time to First Byte
    fcp: number; // First Contentful Paint
    lcp: number; // Largest Contentful Paint
    fid: number; // First Input Delay
    cls: number; // Cumulative Layout Shift
    tti: number; // Time to Interactive
    tbt: number; // Total Blocking Time
    timestamp: number;
}
