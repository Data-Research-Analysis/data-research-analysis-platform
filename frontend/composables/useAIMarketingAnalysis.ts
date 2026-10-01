/**
 * useAIMarketingAnalysis — Composable for generating the ready-made
 * (non-chat) AI marketing analysis report for a project or a single campaign.
 *
 * Calls POST /intelligence/ai-analysis/:projectId.
 * When campaignId is provided the analysis is scoped to that campaign
 * (used on the campaign drill-down page).
 */
import { useAppFetch } from '@/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';
import { getAuthToken } from '~/composables/AuthToken';
import type { IAIMarketingAnalysisResponse } from '~/types/IAIMarketingAnalysis';

export function useAIMarketingAnalysis() {
    async function generateAnalysis(
        projectId: number,
        startDate: Date,
        endDate: Date,
        force: boolean = false,
        campaignId?: string,
        sourceTable?: string,
        campaignColumn?: string,
        channel?: string,
        adSetName?: string,
    ): Promise<IAIMarketingAnalysisResponse> {
        const token = getAuthToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const body: Record<string, string | boolean> = {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            force,
        };
        if (campaignId) {
            body.campaignId = campaignId;
        }
        if (sourceTable) {
            body.sourceTable = sourceTable;
        }
        if (campaignColumn) {
            body.campaignColumn = campaignColumn;
        }
        if (channel) {
            body.channel = channel;
        }
        if (adSetName) {
            body.adSet = adSetName;
        }

        const result = await useAppFetch<{ success: boolean; data: IAIMarketingAnalysisResponse }>(
            `${baseUrl()}/intelligence/ai-analysis/${projectId}`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                },
                body,
            },
        );

        return result.data;
    }

    return { generateAnalysis };
}
