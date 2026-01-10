/**
 * useApiErrorHandler composable
 * 
 * Provides centralized error handling for API responses, specifically handling 402 Payment Required
 * responses with upgrade prompts via SweetAlert.
 */

import Swal from 'sweetalert2';

export function useApiErrorHandler() {
    /**
     * Handle 402 Payment Required response
     * Shows upgrade prompt with tier limit information
     */
    async function handle402Error(errorData: any): Promise<void> {
        if (import.meta.server) return; // SSR guard

        const resourceDisplays: Record<string, string> = {
            'project': 'Project',
            'data_source': 'Data Source',
            'dashboard': 'Dashboard',
            'ai_generation': 'AI Generation'
        };

        const resourceDisplay = resourceDisplays[errorData.resource] || 'Resource';
        const upgradeTiersHtml = errorData.upgradeTiers && errorData.upgradeTiers.length > 0
            ? `
                <div class="mt-4 text-left">
                    <p class="font-semibold mb-2">Available Upgrades:</p>
                    ${errorData.upgradeTiers.map((tier: any) => `
                        <div class="flex justify-between items-center p-2 bg-gray-50 rounded mb-1">
                            <span class="font-medium">${tier.tierName}</span>
                            <span class="text-sm text-gray-600">
                                ${tier.limit === null ? 'Unlimited' : `${tier.limit} ${resourceDisplay}s`}
                                - $${tier.pricePerMonth}/mo
                            </span>
                        </div>
                    `).join('')}
                </div>
            `
            : '';

        const result = await Swal.fire({
            title: `${errorData.tierName} Tier Limit Reached`,
            html: `
                <div class="text-center">
                    <p class="mb-3">
                        You've reached your ${errorData.tierName} tier limit for ${resourceDisplay}s.
                    </p>
                    <div class="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
                        <p class="text-sm">
                            <strong>Current Usage:</strong> ${errorData.currentUsage} / ${errorData.limit}
                        </p>
                    </div>
                    <p class="text-sm text-gray-600 mb-3">
                        Upgrade your subscription to create more ${resourceDisplay.toLowerCase()}s.
                    </p>
                    ${upgradeTiersHtml}
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Upgrade Now',
            cancelButtonText: 'Maybe Later',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#6b7280',
            customClass: {
                popup: 'tier-limit-alert',
                htmlContainer: 'text-left'
            }
        });

        if (result.isConfirmed) {
            window.location.href = '/pricing';
        }
    }

    /**
     * Generic error handler for API responses
     * Automatically detects and handles 402 responses
     */
    async function handleApiError(error: any): Promise<void> {
        if (import.meta.server) return; // SSR guard

        // Handle 402 Payment Required
        if (error.status === 402 || error.error === 'TIER_LIMIT_EXCEEDED') {
            await handle402Error(error);
            return;
        }

        // Handle other errors with generic alert
        await Swal.fire({
            title: 'Error',
            text: error.message || 'An unexpected error occurred',
            icon: 'error',
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc2626'
        });
    }

    return {
        handle402Error,
        handleApiError
    };
}
