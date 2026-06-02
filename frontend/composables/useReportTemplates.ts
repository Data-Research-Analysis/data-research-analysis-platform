/**
 * useReportTemplates composable
 *
 * Implements the frontend side of TICKET RPT-007: Report Templates with Data Model Awareness.
 * Fetches available templates with compatibility info and generates reports from templates.
 */

import { ref } from 'vue';
import { useAppFetch } from './useAppFetch';

export interface ITemplateSection {
  id: string;
  type: 'kpi_row' | 'comparison_table' | 'ai_insights' | 'trend_note' | 'text_block';
  title: string;
  condition?: {
    type: string;
    [key: string]: any;
  };
  kpiSlots?: string;
  dimensionSelection?: string;
  aggregation?: string;
  content?: string;
  required?: boolean;
}

export interface IReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'executive' | 'marketing' | 'data_quality' | 'comparison' | 'general';
  sections: ITemplateSection[];
  compatible: boolean;
  compatibilityReason?: string;
}

export interface ITemplatesResponse {
  success: boolean;
  templates: IReportTemplate[];
}

export interface IGenerateFromTemplateResponse {
  success: boolean;
  report: any;
  templateId: string;
  templateName: string;
  sectionsAdded: string[];
  aiInsightsGenerated: boolean;
  warnings: string[];
}

export interface IGenerateFromTemplateOptions {
  skipAiAnalysis?: boolean;
  reportName?: string;
  reportDescription?: string;
}

export function useReportTemplates() {
  const loading = ref(false);
  const generating = ref(false);
  const error = ref<string | null>(null);
  const templates = ref<IReportTemplate[]>([]);
  const result = ref<IGenerateFromTemplateResponse | null>(null);

  /**
   * Fetch available templates with compatibility info for a given data model.
   */
  async function fetchTemplates(
    dataModelId: number,
    projectId: number | string,
  ): Promise<IReportTemplate[]> {
    loading.value = true;
    error.value = null;

    try {
      const response = await useAppFetch<ITemplatesResponse>(
        `/data-model/${dataModelId}/templates`,
      );

      if (response.value?.success) {
        templates.value = response.value.templates;
        return response.value.templates;
      } else {
        const msg = (response.value as any)?.message || 'Failed to fetch templates';
        error.value = msg;
        return [];
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to fetch templates';
      error.value = msg;
      return [];
    } finally {
      loading.value = false;
    }
  }

  /**
   * Generate a report from a specific template and data model.
   */
  async function generateFromTemplate(
    dataModelId: number,
    projectId: number | string,
    templateId: string,
    options: IGenerateFromTemplateOptions = {},
  ): Promise<IGenerateFromTemplateResponse | null> {
    generating.value = true;
    error.value = null;
    result.value = null;

    try {
      const response = await useAppFetch<IGenerateFromTemplateResponse>(
        `/data-model/${dataModelId}/generate-from-template`,
        {
          method: 'POST',
          body: {
            template_id: templateId,
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
        const msg = (response.value as any)?.message || 'Failed to generate report from template';
        error.value = msg;
        return null;
      }
    } catch (err: any) {
      const msg = err?.data?.message || err?.message || 'Failed to generate report from template';
      error.value = msg;
      return null;
    } finally {
      generating.value = false;
    }
  }

  /**
   * Get the icon component name or emoji for a template.
   */
  function getTemplateIcon(template: IReportTemplate): string {
    const iconMap: Record<string, string> = {
      'chart-bar': '📊',
      'megaphone': '📢',
      'shield-check': '🛡️',
      'arrows-left-right': '↔️',
      'squares-2x2': '🗂️',
    };
    return iconMap[template.icon] || '📄';
  }

  /**
   * Get the color classes for a template category.
   */
  function getCategoryColor(category: string): { bg: string; text: string; border: string; badge: string } {
    const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
      executive: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
      marketing: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
      data_quality: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
      comparison: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
      general: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' },
    };
    return colorMap[category] || colorMap.general;
  }

  /**
   * Get human-readable section type label.
   */
  function getSectionTypeLabel(type: string): string {
    const labelMap: Record<string, string> = {
      kpi_row: 'KPI Cards',
      comparison_table: 'Comparison Table',
      ai_insights: 'AI Insights',
      trend_note: 'Trend Note',
      text_block: 'Text Block',
    };
    return labelMap[type] || type;
  }

  function reset() {
    loading.value = false;
    generating.value = false;
    error.value = null;
    templates.value = [];
    result.value = null;
  }

  return {
    loading,
    generating,
    error,
    templates,
    result,
    fetchTemplates,
    generateFromTemplate,
    getTemplateIcon,
    getCategoryColor,
    getSectionTypeLabel,
    reset,
  };
}