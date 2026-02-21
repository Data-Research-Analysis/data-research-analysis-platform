<script setup lang="ts">
// This page handles the Meta OAuth callback redirect from Facebook.
// Facebook redirects here with ?code=...&state=...
// We exchange the code via the backend, store the token, then redirect back to the project page.

const route = useRoute();
const router = useRouter();
const config = useRuntimeConfig();

const statusMessage = ref('Completing Facebook authentication...');
const isError = ref(false);

onMounted(async () => {
    const code = route.query.code as string;
    const state = route.query.state as string;
    const error = route.query.error as string;

    if (error) {
        isError.value = true;
        statusMessage.value = 'Facebook authentication was cancelled or failed.';
        setTimeout(() => router.push('/'), 3000);
        return;
    }

    if (!code || !state) {
        isError.value = true;
        statusMessage.value = 'Invalid OAuth callback — missing code or state.';
        setTimeout(() => router.push('/'), 3000);
        return;
    }

    try {
        // Exchange code for token via backend
        const response = await $fetch(`${config.public.apiBase}/meta-ads/callback`, {
            method: 'GET',
            query: { code, state },
        }) as any;

        if (response.success) {
            // Store token and redirect target in localStorage for the meta-ads wizard to pick up
            const pendingOAuth = localStorage.getItem('meta_ads_pending_oauth');
            const parsed = pendingOAuth ? JSON.parse(pendingOAuth) : {};

            localStorage.setItem('meta_ads_oauth_token', JSON.stringify({
                access_token: response.access_token,
                token_type: response.token_type,
                expires_in: response.expires_in,
                token_info: response.token_info,
            }));

            // Redirect back to the project data source connection page
            const projectId = parsed.projectId;
            if (projectId) {
                localStorage.removeItem('meta_ads_pending_oauth');
                await router.push(`/projects/${projectId}/data-sources/connect/meta-ads`);
            } else {
                statusMessage.value = 'Authentication successful. Please return to the data sources page.';
                setTimeout(() => router.push('/'), 3000);
            }
        } else {
            throw new Error(response.error || 'Failed to complete OAuth');
        }
    } catch (err: any) {
        isError.value = true;
        statusMessage.value = err.message || 'Failed to complete Facebook authentication.';
        setTimeout(() => router.push('/'), 5000);
    }
});
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-gray-50">
        <div class="text-center p-8">
            <div v-if="!isError" class="mb-4">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            </div>
            <div v-else class="mb-4 text-red-500 text-4xl">✗</div>
            <p class="text-gray-700 text-lg">{{ statusMessage }}</p>
        </div>
    </div>
</template>
