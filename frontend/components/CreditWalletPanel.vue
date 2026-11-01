<template>
    <div class="bg-white shadow rounded-lg p-6 mb-6">
        <div class="flex items-start justify-between mb-6">
            <div>
                <h2 class="text-xl font-semibold text-gray-900">Workspace Credits</h2>
                <p class="mt-1 text-sm text-gray-600">
                    Credits power AI actions — plan builds, AI analysis, exports. They are pooled across your whole workspace.
                </p>
            </div>
            <button
                @click="handleRefresh"
                :disabled="subscriptionStore.loadingCredits"
                class="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
                <font-awesome-icon
                    v-if="subscriptionStore.loadingCredits"
                    :icon="['fas', 'spinner']"
                    class="animate-spin mr-2"
                />
                <font-awesome-icon v-else :icon="['fas', 'rotate']" class="mr-2" />
                Refresh
            </button>
        </div>

        <!-- Balance -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-primary-blue-90/5 border border-primary-blue-90/20 rounded-lg p-4">
                <p class="text-sm text-gray-500">Available Balance</p>
                <p class="mt-1 text-3xl font-bold text-gray-900">
                    {{ formatNumber(balance) }}
                </p>
                <p class="text-sm text-gray-500">credits</p>
                <p v-if="hasOnboardingBonus" class="text-xs text-green-600 mt-1">
                    Includes a one-time onboarding bonus
                </p>
            </div>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p class="text-sm text-gray-500">Monthly Grant</p>
                <p class="mt-1 text-2xl font-semibold text-gray-900">
                    {{ formatNumber(monthlyGrant) }}
                </p>
                <p class="text-sm text-gray-500">resets monthly</p>
            </div>
            <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p class="text-sm text-gray-500">Rollover Balance</p>
                <p class="mt-1 text-2xl font-semibold text-gray-900">
                    {{ formatNumber(rollover) }}
                </p>
                <p class="text-sm text-gray-500">credits roll over</p>
            </div>
        </div>

        <!-- Buy credits / auto-recharge are a Pro top-up. Free orgs only get
             the monthly allowance, so they see the upgrade CTA instead. -->
        <template v-if="canBuyPacks">
        <!-- Buy credits -->
        <h3 class="text-lg font-medium text-gray-900 mb-3">Buy Credits</h3>
        <p class="text-sm text-gray-600 mb-4">
            Packs never expire. Purchase is completed securely through Paddle and credits are added to your workspace instantly.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div
                v-for="pack in subscriptionStore.creditPacks"
                :key="pack.id"
                class="border border-gray-200 rounded-lg p-4 flex flex-col justify-between"
            >
                <div>
                    <p class="font-medium text-gray-900">{{ pack.name }}</p>
                    <p class="mt-1 text-2xl font-bold text-gray-900">${{ pack.price_usd }}</p>
                    <p class="text-sm text-gray-500">one-time</p>
                </div>
                <button
                    @click="handleBuy(pack.id)"
                    :disabled="purchasingPackId === pack.id"
                    class="mt-4 w-full bg-primary-blue-100 hover:bg-primary-blue-80 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                    <font-awesome-icon
                        v-if="purchasingPackId === pack.id"
                        :icon="['fas', 'spinner']"
                        class="animate-spin mr-2"
                    />
                    {{ purchasingPackId === pack.id ? 'Opening Checkout...' : 'Buy' }}
                </button>
            </div>
            <div v-if="subscriptionStore.creditPacks.length === 0 && !subscriptionStore.loadingCredits"
                 class="col-span-full text-sm text-gray-500">
                No credit packs available right now.
            </div>
        </div>

        <!-- Auto-recharge -->
        <h3 class="text-lg font-medium text-gray-900 mb-3">Auto-Recharge</h3>
        <p class="text-sm text-gray-600 mb-4">
            Automatically top up with a credit pack when your balance drops below a threshold (charged to your saved payment method).
        </p>
        <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-end mb-2">
            <label class="flex-1 max-w-xs">
                <span class="block text-sm font-medium text-gray-700 mb-1">Recharge when balance is below</span>
                <input
                    v-model.number="autoRechargeThreshold"
                    type="number"
                    min="0"
                    step="100"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g. 1250"
                />
            </label>
            <label class="flex-1 max-w-xs">
                <span class="block text-sm font-medium text-gray-700 mb-1">Recharge with pack</span>
                <select
                    v-model="autoRechargePackId"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                    <option :value="null">Disabled</option>
                    <option v-for="pack in subscriptionStore.creditPacks" :key="pack.id" :value="pack.id">
                        {{ pack.name }} — ${{ pack.price_usd }}
                    </option>
                </select>
            </label>
            <button
                @click="handleSaveAutoRecharge"
                :disabled="savingAutoRecharge"
                class="px-4 py-2 bg-primary-blue-100 hover:bg-primary-blue-80 text-white font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
                <font-awesome-icon v-if="savingAutoRecharge" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                Save
            </button>
        </div>
        <p class="text-xs text-gray-500 mb-6">
            {{ autoRechargePackId ? 'Auto-recharge enabled. Credits are charged instantly when the threshold is crossed.' : 'Auto-recharge disabled — you can still buy packs manually at any time.' }}
        </p>
        </template>

        <div v-else-if="subscriptionStore.creditsWallet" class="border border-primary-blue-90/20 bg-primary-blue-90/5 rounded-lg p-4 mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-1">Need more credits?</h3>
            <p class="text-sm text-gray-600 mb-3">
                Credit packs and auto-recharge are available on the Pro plan. Free workspaces receive
                {{ formatNumber(monthlyGrant) }} credits each month.
            </p>
            <NuxtLink
                to="/pricing"
                class="inline-flex items-center px-4 py-2 bg-primary-blue-100 hover:bg-primary-blue-80 text-white font-medium rounded-lg transition-colors"
            >
                Upgrade to Pro
            </NuxtLink>
        </div>

        <!-- Ledger -->
        <h3 class="text-lg font-medium text-gray-900 mb-3">Recent Activity</h3>
        <div class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-left text-gray-500 border-b border-gray-200">
                        <th class="pb-2 pr-4 font-medium">Date</th>
                        <th class="pb-2 pr-4 font-medium">Type</th>
                        <th class="pb-2 pr-4 font-medium">Description</th>
                        <th class="pb-2 text-right font-medium">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="tx in ledger"
                        :key="tx.id"
                        class="border-b border-gray-100 last:border-0"
                    >
                        <td class="py-2 pr-4 whitespace-nowrap text-gray-600">{{ formatDate(tx.created_at) }}</td>
                        <td class="py-2 pr-4">
                            <span
                                class="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                                :class="typeBadgeClass(tx.type)"
                            >
                                {{ displayType(tx.type) }}
                            </span>
                        </td>
                        <td class="py-2 pr-4 text-gray-700 max-w-xs truncate">{{ tx.description || '—' }}</td>
                        <td class="py-2 text-right font-semibold" :class="tx.amount >= 0 ? 'text-green-600' : 'text-gray-900'">
                            {{ tx.amount >= 0 ? '+' : '' }}{{ formatNumber(tx.amount) }}
                        </td>
                    </tr>
                    <tr v-if="ledger.length === 0 && !subscriptionStore.loadingCredits">
                        <td colspan="4" class="py-4 text-center text-gray-500">No credit activity yet.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useSubscriptionStore } from '~/stores/subscription';

const subscriptionStore = useSubscriptionStore();

const purchasingPackId = ref<number | null>(null);
const savingAutoRecharge = ref(false);

const wallet = computed(() => subscriptionStore.creditsWallet?.wallet);
const balance = computed(() => wallet.value?.balance_credits ?? 0);
const monthlyGrant = computed(() => wallet.value?.monthly_grant_amount ?? 0);
const rollover = computed(() => wallet.value?.rollover_balance ?? 0);
const ledger = computed(() => subscriptionStore.creditsWallet?.transactions ?? []);
const canBuyPacks = computed(() => subscriptionStore.canBuyPacks === true);
const hasOnboardingBonus = computed(() =>
    ledger.value.some((tx) => tx.type === 'bonus' && tx.source === 'onboarding')
);

const autoRechargeThreshold = ref<number>(wallet.value?.auto_recharge_threshold ?? 1250);
const autoRechargePackId = ref<number | null>(wallet.value?.auto_recharge_pack_id ?? null);

function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function displayType(type: string): string {
    const map: Record<string, string> = {
        grant: 'Grant',
        bonus: 'Bonus',
        purchase: 'Purchase',
        consume: 'Used',
        release: 'Released',
        refund: 'Refund',
        expire: 'Expired',
        adjust: 'Adjustment',
    };
    return map[type] ?? type;
}

function typeBadgeClass(type: string): string {
    if (type === 'purchase' || type === 'grant' || type === 'bonus' || type === 'refund' || type === 'release') {
        return 'bg-green-100 text-green-700';
    }
    if (type === 'consume') return 'bg-gray-100 text-gray-700';
    return 'bg-amber-100 text-amber-700';
}

async function handleRefresh() {
    await Promise.allSettled([subscriptionStore.fetchCreditsWallet(), subscriptionStore.fetchCreditPacks()]);
}

async function handleBuy(packId: number) {
    const { $swal } = useNuxtApp() as any;
    purchasingPackId.value = packId;
    try {
        const result = await subscriptionStore.purchaseCreditPack(packId);
        if (!result?.sessionId) {
            $swal.fire({
                icon: 'error',
                title: 'Checkout unavailable',
                text: 'No checkout session was returned. Please try again.',
                confirmButtonColor: '#1e3a5f',
            });
            return;
        }
        // Open the Paddle overlay on the current page (same pattern as
        // subscription checkout). window.open after an await is blocked by
        // popup blockers, and a hosted checkout URL can point at another
        // environment (e.g. production while running locally).
        if (!import.meta.client || !(window as any).Paddle) {
            throw new Error('Paddle checkout is not ready yet. Please refresh the page and try again.');
        }
        (window as any).Paddle.Checkout.open({ transactionId: result.sessionId });
    } catch (error: any) {
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: error?.data?.error || error?.message || 'Failed to start checkout.',
            confirmButtonColor: '#1e3a5f',
        });
    } finally {
        purchasingPackId.value = null;
    }
}

async function handleSaveAutoRecharge() {
    const { $swal } = useNuxtApp() as any;
    savingAutoRecharge.value = true;
    try {
        const threshold = Math.max(0, autoRechargeThreshold.value || 0);
        await subscriptionStore.saveAutoRecharge(threshold, autoRechargePackId.value);
        $swal.fire({
            icon: 'success',
            title: 'Saved',
            text: 'Auto-recharge settings updated.',
            confirmButtonColor: '#1e3a5f',
        });
    } catch (error: any) {
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: error?.data?.error || error?.message || 'Failed to save auto-recharge.',
            confirmButtonColor: '#1e3a5f',
        });
    } finally {
        savingAutoRecharge.value = false;
    }
}

onMounted(() => {
    handleRefresh();
});
</script>
