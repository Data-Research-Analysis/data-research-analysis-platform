import { ref, computed, shallowRef } from 'vue';
import { getAuthToken } from '@/composables/AuthToken';

/**
 * Data Model Analysis API Response Interfaces
 * Matches the backend DataModelAIInsights interface from GeminiService.ts
 */

export interface KeyInsight {
  title: string;
  description: string;
  severity: 'info' | 'success' | 'warning' | 'danger';
  metric?: string | null;
  icon?: string;
}

export interface PatternTrend {
  pattern: string;
  columns_involved: string[];
  confidence: number;
  marketing_implication: string;
}

export interface AnomalyDetected {
  anomaly: string;
  affected_column: string;
  expected_range: string;
  actual_value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MarketingRecommendation {
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  expected_impact: string;
  related_metrics: string[];
}

export interface DataQualityScore {
  overall_score: number;
  completeness_score: number;
  consistency_score: number;
  accuracy_score: number;
  issues: string[];
}

export interface DataModelAIInsights {
  key_insights: KeyInsight[];
  patterns_and_trends: PatternTrend[];
  anomalies_detected: AnomalyDetected[];
  marketing_recommendations: MarketingRecommendation[];
  data_quality_score: DataQualityScore;
  metadata?: {
    ai_enhanced: boolean;
    model_used: string;
    analysis_timestamp: string;
    cache_hit?: boolean;
  };
}

export interface KPIClassification {
  columns: Array<{
    column_name: string;
    kpi_type: string;
    display_name: string;
    aggregation: string;
  }>;
  derived_kpis: Array<{
    name: string;
    formula: string;
    required_columns: string[];
    display_name: string;
  }>;
  has_marketing_data: boolean;
  summary: {
    total_columns: number;
    metrics: number;
    dimensions: number;
    time_columns: number;
    derived_kpis_available: number;
  };
}

export function useDataModelAnalysis(dataModelId: Ref<number> | number) {
  const baseUrl = () => useRuntimeConfig().public.apiBase;

  // State
  const isAnalyzing = ref(false);
  const isLoadingClassification = ref(false);
  const error = ref<string | null>(null);
  const insights = shallowRef<DataModelAIInsights | null>(null);
  const kpiClassification = shallowRef<KPIClassification | null>(null);

  // Computed
  const hasInsights = computed(() => !!insights.value);
  const hasKPIClassification = computed(() => !!kpiClassification.value);
  const keyInsights = computed(() => insights.value?.key_insights || []);
  const patterns = computed(() => insights.value?.patterns_and_trends || []);
  const anomalies = computed(() => insights.value?.anomalies_detected || []);
  const recommendations = computed(() => insights.value?.marketing_recommendations || []);
  const qualityScore = computed(() => insights.value?.data_quality_score || null);

  /**
   * Trigger AI analysis on the data model (calls POST /data-model/:id/ai-analyze)
   * Cached server-side for 1 hour; subsequent calls return cached results.
   */
  async function runAnalysis(): Promise<DataModelAIInsights | null> {
    const id = unref(dataModelId);
    if (!id) return null;

    isAnalyzing.value = true;
    error.value = null;

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await $fetch<DataModelAIInsights>(
        `${baseUrl()}/data-model/${id}/ai-analyze`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Authorization-Type': 'auth',
            'Content-Type': 'application/json',
          },
        }
      );

      insights.value = response;
      return response;
    } catch (err: any) {
      const message = err?.data?.error || err?.message || 'Failed to analyze data model';
      error.value = message;
      console.error('[useDataModelAnalysis] AI analysis failed:', err);
      return null;
    } finally {
      isAnalyzing.value = false;
    }
  }

  /**
   * Load KPI column classification (calls GET /data-model/:id/kpi-classification)
   */
  async function loadKPIClassification(forceRefresh = false): Promise<KPIClassification | null> {
    const id = unref(dataModelId);
    if (!id) return null;

    isLoadingClassification.value = true;

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const url = `${baseUrl()}/data-model/${id}/kpi-classification${forceRefresh ? '?force_refresh=true' : ''}`;
      const response = await $fetch<KPIClassification>(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Authorization-Type': 'auth',
        },
      });

      kpiClassification.value = response;
      return response;
    } catch (err: any) {
      console.error('[useDataModelAnalysis] KPI classification failed:', err);
      return null;
    } finally {
      isLoadingClassification.value = false;
    }
  }

  /**
   * Clear cached insights (useful when user wants a fresh analysis)
   */
  function clearInsights() {
    insights.value = null;
    error.value = null;
  }

  function clearClassification() {
    kpiClassification.value = null;
  }

  return {
    // State
    isAnalyzing: readonly(isAnalyzing),
    isLoadingClassification: readonly(isLoadingClassification),
    error: readonly(error),
    insights: readonly(insights),
    kpiClassification: readonly(kpiClassification),

    // Computed
    hasInsights,
    hasKPIClassification,
    keyInsights,
    patterns,
    anomalies,
    recommendations,
    qualityScore,

    // Actions
    runAnalysis,
    loadKPIClassification,
    clearInsights,
    clearClassification,
  };
}