/**
 * useApiErrorHandler composable
 * 
 * Provides centralized error handling for API responses, specifically handling 402 Payment Required
 * responses with upgrade prompts via SweetAlert.
 */

/**
 * Load SweetAlert2 (and its stylesheet) on demand. This composable is imported
 * by request helpers that run on every page, so importing SweetAlert2 statically
 * pulled the whole library into the entry bundle. Error dialogs are rare, so the
 * library is fetched only when an error actually needs to be shown.
 */
async function loadSwal() {
    if (import.meta.client) {
        await import('sweetalert2/dist/sweetalert2.min.css');
    }
    const { default: Swal } = await import('sweetalert2');
    return Swal;
}

export function useApiErrorHandler() {
    /**
     * Handle 402 Payment Required response (AI fair-use ceiling or credits).
     */
    async function handle402Error(errorData: any): Promise<void> {
        if (import.meta.server) return; // SSR guard

        const Swal = await loadSwal();
        const isCreditError = errorData.error === 'CREDIT_INSUFFICIENT';

        const result = await Swal.fire({
            title: isCreditError ? 'Insufficient Credits' : 'Usage Limit Reached',
            text: errorData.message || 'You have reached a usage limit for your current plan.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: isCreditError ? 'Buy Credits' : 'View Plans',
            cancelButtonText: 'Close',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#6b7280'
        });

        if (result.isConfirmed) {
            window.location.href = errorData.upgradeUrl || '/pricing';
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
        const Swal = await loadSwal();
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
