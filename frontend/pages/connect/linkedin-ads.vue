<script setup lang="ts">
// LinkedIn OAuth callback landing page.
// LinkedIn redirects here with:
//   ?tokens=<base64url-encoded JSON>&state=<state>
// We decode the token payload, store it in localStorage, then redirect to the
// project-level connect wizard.

const route = useRoute();
const router = useRouter();

const statusMessage = ref('Completing LinkedIn authentication...');
const isError = ref(false);

onMounted(async () => {
    const tokensParam = route.query.tokens as string;
    const error = route.query.error as string;

    if (error) {
        isError.value = true;
        statusMessage.value = `LinkedIn authentication was cancelled or failed: ${error}`;
        setTimeout(() => router.push('/'), 3000);
        return;
    }

    if (!tokensParam) {
        isError.value = true;
        statusMessage.value = 'Invalid OAuth callback — missing token data.';
        setTimeout(() => router.push('/'), 3000);
        return;
    }

    try {
        // Decode the base64url-encoded token payload sent by the backend callback.
        const tokenJson = atob(tokensParam.replace(/-/g, '+').replace(/_/g, '/'));
        const tokenData = JSON.parse(tokenJson);

        // Persist for the connect wizard to pick up.
        localStorage.setItem('linkedin_ads_oauth_token', JSON.stringify({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || '',
            expires_at: tokenData.expires_at,
            scope: tokenData.scope || '',
        }));

        // Recover the projectId that was saved before the OAuth redirect started.
        const pendingOAuth = localStorage.getItem('linkedin_ads_pending_oauth');
        const parsed = pendingOAuth ? JSON.parse(pendingOAuth) : {};

        const projectId = parsed.projectId;
        if (projectId) {
            localStorage.removeItem('linkedin_ads_pending_oauth');
            await router.push(`/projects/${projectId}/data-sources/connect/linkedin-ads`);
        } else {
            statusMessage.value = 'Authentication successful. Please return to the data sources page.';
            setTimeout(() => router.push('/'), 3000);
        }
    } catch (err: any) {
        isError.value = true;
        statusMessage.value = err.message || 'Failed to complete LinkedIn authentication.';
        setTimeout(() => router.push('/'), 5000);
    }
});

definePageMeta({
    layout: 'default'
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
