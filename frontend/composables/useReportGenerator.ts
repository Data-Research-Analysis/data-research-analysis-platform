/**
 * useReportGenerator composable
 *
 * Implements the frontend side of TICKET RPT-006: One-Click "Generate Report" from Data Model.
 * Calls POST /data-model/:data_model_id/generate-report to auto-create a populated report.
 */

import { ref } from 'vue';
import { useAppFetch } from './useAppFetch';

export interface IGenerateReportOptions {
  skipAiAnalysis?: boolean;
  reportName?: string;
  reportDescription?: string;
}

export interface IGenerateReportResponse {
  success: boolean;
  report: any;
  sectionsAdded: string[];
  aiInsightsGenerated: boolean;
  warnings: string[];
}

export function useReportGenerator() {
  const loading = ref(false);
  const error = ref<string | null>(null);
  const result = ref<IGenerateReportResponse | null>(null);

  /**
   * Generate a report from a data model.
   * @param dataModelId - The data model ID
   * @param projectId - The project ID (for the API URL)
   * @param options - Optional parameters for report generation
   */
  async function generateReport(
    dataModelId: number,
    projectId: number | string,
    options: IGenerateReportOptions = {},
  ): Promise<IGenerateReportResponse | null> {
    loading.value = true;
    error.value = null;
    result.value = null;

    try {
      const response = await useAppFetch<IGenerateReportResponse>(
        `/data-model/${dataModelId}/generate-report`,
        {
          method: 'POST',
          body: {
            skipAiAnalysis: options.skipAiAnalysis ?? false,
            reportName: options.reportName,
            reportDescription: options.reportDescription,
          },
        },
      );

      if (response.value?.success) {
        result.value = response.value;
        return response.value;
      } else {
        const msg = (response.value as any)?.message || 'Failed to generate report';
        error.value = msg;
        return null;
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to generate report';
      error.value = msg;
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    loading.value = false;
    error.value = null;
    result.value = null;
  }

  return {
    loading,
    error,
    result,
    generateReport,
    reset,
  };
}