<script setup lang="ts">
import { useLoggedInUserStore } from '@/stores/logged_in_user';

const route = useRoute();
const router = useRouter();
const loggedInUserStore = useLoggedInUserStore();

interface State {
    loading: boolean;
    success: boolean;
    error: string;
}

const state = reactive<State>({
    loading: true,
    success: false,
    error: ''
});

onMounted(async () => {
    if (!import.meta.client) {
        return;
    }

    try {
        const token = String(route.query.token || '');
        const error = String(route.query.error || '');

        if (error) {
            state.error = decodeURIComponent(error);
            state.loading = false;
            return;
        }

        if (!token) {
            state.error = 'SSO login did not return a token.';
            state.loading = false;
            return;
        }

        setAuthToken(token);
        await loggedInUserStore.retrieveLoggedInUser();

        state.success = true;
        state.loading = false;

        setTimeout(() => {
            router.push('/projects');
        }, 800);
    } catch (err: any) {
        state.error = err?.message || 'Failed to complete SSO login.';
        state.loading = false;
    }
});
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-white p-4">
        <div class="w-full max-w-xl rounded-xl border border-slate-200 shadow-lg p-8 text-center">
            <div v-if="state.loading" class="space-y-4">
                <div class="mx-auto w-14 h-14 border-4 border-slate-200 border-t-primary-blue-100 rounded-full animate-spin"></div>
                <h1 class="text-2xl font-semibold text-slate-900">Completing SSO Sign In</h1>
                <p class="text-slate-600">Please wait while we finalize your authentication.</p>
            </div>

            <div v-else-if="state.success" class="space-y-4">
                <div class="mx-auto w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'check']" class="text-white text-2xl" />
                </div>
                <h1 class="text-2xl font-semibold text-slate-900">Signed In Successfully</h1>
                <p class="text-slate-600">Redirecting to your projects...</p>
            </div>

            <div v-else class="space-y-4">
                <div class="mx-auto w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                    <font-awesome-icon :icon="['fas', 'triangle-exclamation']" class="text-white text-2xl" />
                </div>
                <h1 class="text-2xl font-semibold text-slate-900">SSO Sign In Failed</h1>
                <p class="text-slate-600">{{ state.error }}</p>
                <button
                    class="px-5 py-2 rounded-lg bg-primary-blue-100 text-white hover:bg-primary-blue-300"
                    @click="router.push('/login')"
                >
                    Return to Login
                </button>
            </div>
        </div>
    </div>
</template>