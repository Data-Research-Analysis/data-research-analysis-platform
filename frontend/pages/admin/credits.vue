<script setup lang="ts">
const { $swal } = useNuxtApp();
const config = useRuntimeConfig();

type Tab = 'wallets' | 'actions' | 'packs';

const tab = ref<Tab>('wallets');
const loading = ref(false);
const saving = ref<number | null>(null);

const creditsEnabled = ref(false);
const wallets = ref<any[]>([]);
const actionPrices = ref<any[]>([]);
const packs = ref<any[]>([]);

const selectedOrg = ref<number | null>(null);
const ledger = ref<any>(null);
const ledgerLoading = ref(false);
const adjustAmount = ref<number | null>(null);
const adjustDescription = ref('');
const grantAmount = ref<number | null>(null);
const autoRechargeThreshold = ref<number | null>(null);
const autoRechargePackId = ref<number | null>(null);

const newPack = reactive({
    name: '',
    credits: 1000,
    price_usd: 9,
    paddle_price_id: '',
    sort_order: 0,
});

function authHeaders() {
    const token = getAuthToken();
    return {
        Authorization: `Bearer ${token}`,
        'Authorization-Type': 'auth',
        'Content-Type': 'application/json',
    };
}

async function api(path: string, options: any = {}) {
    return $fetch<any>(`${config.public.apiBase}/admin/credits${path}`, {
        ...options,
        headers: { ...authHeaders(), ...(options.headers || {}) },
    });
}

async function loadOverview() {
    const res = await api('/overview');
    creditsEnabled.value = res.data?.credits_enabled === true;
    wallets.value = res.data?.wallets ?? [];
}

async function loadActionPrices() {
    const res = await api('/action-prices');
    actionPrices.value = (res.data ?? []).map((p: any) => ({
        ...p,
        band_multipliers_text: Array.isArray(p.band_multipliers) ? p.band_multipliers.join(', ') : '',
    }));
}

async function loadPacks() {
    const res = await api('/packs');
    packs.value = res.data ?? [];
}

async function loadAll() {
    loading.value = true;
    try {
        await Promise.all([loadOverview(), loadActionPrices(), loadPacks()]);
    } catch (err: any) {
        await $swal.fire({
            title: 'Failed to load credits',
            text: err?.data?.error || err?.message || 'Unexpected error',
            icon: 'error',
            confirmButtonColor: '#3C8DBC',
        });
    } finally {
        loading.value = false;
    }
}

async function openLedger(orgId: number) {
    selectedOrg.value = orgId;
    ledgerLoading.value = true;
    try {
        const res = await api(`/org/${orgId}`);
        ledger.value = res.data;
        autoRechargeThreshold.value = res.data?.wallet?.auto_recharge_threshold ?? null;
        autoRechargePackId.value = res.data?.wallet?.auto_recharge_pack_id ?? null;
    } catch (err: any) {
        await $swal.fire({ title: 'Ledger unavailable', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    } finally {
        ledgerLoading.value = false;
    }
}

function closeLedger() {
    selectedOrg.value = null;
    ledger.value = null;
    grantAmount.value = null;
    adjustAmount.value = null;
    adjustDescription.value = '';
    autoRechargeThreshold.value = null;
    autoRechargePackId.value = null;
}

async function saveAdminAutoRecharge() {
    if (!selectedOrg.value) return;
    try {
        await api(`/org/${selectedOrg.value}/auto-recharge`, {
            method: 'PUT',
            body: JSON.stringify({
                threshold: Number(autoRechargeThreshold.value),
                packId: autoRechargePackId.value,
            }),
        });
        await Promise.all([loadOverview(), openLedger(selectedOrg.value)]);
        await $swal.fire({ title: 'Auto-recharge saved', icon: 'success', confirmButtonColor: '#10b981' });
    } catch (err: any) {
        await $swal.fire({ title: 'Could not save', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#ef4444' });
    }
}

onMounted(() => {
    if (import.meta.client) {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedOrg.value) closeLedger();
        });
    }
});

async function applyGrant() {
    if (!selectedOrg.value) return;
    try {
        const body = grantAmount.value ? { amount: Number(grantAmount.value) } : {};
        await api(`/org/${selectedOrg.value}/grant`, { method: 'POST', body: JSON.stringify(body) });
        grantAmount.value = null;
        await Promise.all([loadOverview(), openLedger(selectedOrg.value)]);
        await $swal.fire({ title: 'Grant applied', icon: 'success', confirmButtonColor: '#3C8DBC' });
    } catch (err: any) {
        await $swal.fire({ title: 'Grant failed', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    }
}

async function applyAdjustment() {
    if (!selectedOrg.value || !adjustAmount.value || !adjustDescription.value.trim()) {
        await $swal.fire({ title: 'Amount and description are required', icon: 'warning', confirmButtonColor: '#3C8DBC' });
        return;
    }
    try {
        await api(`/org/${selectedOrg.value}/adjust`, {
            method: 'POST',
            body: JSON.stringify({ amount: Number(adjustAmount.value), description: adjustDescription.value.trim() }),
        });
        adjustAmount.value = null;
        adjustDescription.value = '';
        await Promise.all([loadOverview(), openLedger(selectedOrg.value)]);
    } catch (err: any) {
        await $swal.fire({ title: 'Adjustment failed', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    }
}

async function triggerRecharge(orgId: number) {
    try {
        const res = await api(`/org/${orgId}/recharge`, { method: 'POST' });
        const result = res?.data ?? null;
        if (!result) {
            await $swal.fire({
                title: 'Auto-recharge check',
                text: 'Auto-recharge is not configured for this org (no threshold or pack set).',
                icon: 'info',
                confirmButtonColor: '#3C8DBC',
            });
            return;
        }
        await $swal.fire({
            title: 'Auto-recharge check',
            html: `<p class="text-sm text-gray-600">${result.reason ?? JSON.stringify(result)}</p>${result.transactionId ? `<p class="text-xs text-gray-400 mt-1">Transaction ${result.transactionId}</p>` : ''}`,
            icon: result.initiated === true ? 'success' : 'info',
            confirmButtonColor: '#3C8DBC',
        });
    } catch (err: any) {
        await $swal.fire({ title: 'Recharge failed', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    }
}

async function saveActionPrice(price: any) {
    saving.value = price.id;
    try {
        const multipliers = price.band_multipliers_text
            ? String(price.band_multipliers_text).split(',').map((v: string) => Number(v.trim())).filter((n: number) => Number.isFinite(n))
            : null;
        await api(`/action-prices/${price.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                display_name: price.display_name,
                credits: Number(price.credits),
                charge_mode: price.charge_mode,
                band_type: price.band_type,
                band_multipliers: multipliers,
                is_active: price.is_active,
            }),
        });
        await loadActionPrices();
    } catch (err: any) {
        await $swal.fire({ title: 'Save failed', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    } finally {
        saving.value = null;
    }
}

async function savePack(pack: any) {
    saving.value = pack.id;
    try {
        await api(`/packs/${pack.id}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: pack.name,
                credits: Number(pack.credits),
                price_usd: Number(pack.price_usd),
                paddle_price_id: pack.paddle_price_id || null,
                is_active: pack.is_active,
                sort_order: Number(pack.sort_order),
            }),
        });
        await loadPacks();
    } catch (err: any) {
        await $swal.fire({ title: 'Save failed', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    } finally {
        saving.value = null;
    }
}

async function createPack() {
    if (!newPack.name || !newPack.credits || !newPack.price_usd) {
        await $swal.fire({ title: 'Name, credits and price are required', icon: 'warning', confirmButtonColor: '#3C8DBC' });
        return;
    }
    try {
        await api('/packs', {
            method: 'POST',
            body: JSON.stringify({
                name: newPack.name,
                credits: Number(newPack.credits),
                price_usd: Number(newPack.price_usd),
                paddle_price_id: newPack.paddle_price_id || null,
                sort_order: Number(newPack.sort_order),
            }),
        });
        newPack.name = '';
        newPack.credits = 1000;
        newPack.price_usd = 9;
        newPack.paddle_price_id = '';
        newPack.sort_order = 0;
        await loadPacks();
    } catch (err: any) {
        await $swal.fire({ title: 'Create failed', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    }
}

async function syncPaddle(kind: 'packs' | 'pro') {
    const { value: confirmed } = await $swal.fire({
        title: kind === 'packs' ? 'Sync credit packs from Paddle?' : 'Sync Pro credit prices from Paddle?',
        text: 'Creates/backfills the Paddle product and prices, then stores the price IDs. Idempotent.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3C8DBC',
        confirmButtonText: 'Sync now',
    });
    if (!confirmed) return;
    try {
        const res = await api(kind === 'packs' ? '/paddle-sync-packs' : '/paddle-sync-pro-credits', { method: 'POST' });
        await $swal.fire({
            title: 'Sync complete',
            text: res.data?.errors?.length ? res.data.errors.join('\n') : 'Prices synced',
            icon: res.data?.errors?.length ? 'warning' : 'success',
            confirmButtonColor: '#3C8DBC',
        });
        await Promise.all([loadPacks(), loadActionPrices()]);
    } catch (err: any) {
        await $swal.fire({ title: 'Sync failed', text: err?.data?.error || err?.message, icon: 'error', confirmButtonColor: '#3C8DBC' });
    }
}

function formatCredits(value: any) {
    return Number(value ?? 0).toLocaleString();
}

function formatDate(value: any) {
    return value ? new Date(value).toLocaleString() : '—';
}

function planLabel(w: any): string {
    const tier = w.tier_name ?? 'FREE';
    if (/free/i.test(tier)) return 'Free';
    const volume = w.credits_per_month_override
        ? `${Number(w.credits_per_month_override).toLocaleString()} cr/mo`
        : '';
    const cycle = w.billing_cycle === 'annual' ? 'annual' : 'monthly';
    return `${tier}${volume ? ` · ${volume}` : ''} · ${cycle}`;
}

function statusInfo(w: any): { label: string; cls: string } {
    if (/free/i.test(w.tier_name ?? 'FREE')) return { label: 'Free', cls: 'bg-gray-100 text-gray-700' };
    if (w.grace_period_ends_at) return { label: 'Grace', cls: 'bg-amber-100 text-amber-800' };
    if (w.cancelled_at) return { label: 'Cancelling', cls: 'bg-orange-100 text-orange-700' };
    const active = w.subscription_is_active ?? w.is_active;
    return active
        ? { label: 'Active', cls: 'bg-green-100 text-green-800' }
        : { label: 'Inactive', cls: 'bg-red-100 text-red-700' };
}

function priceLabel(w: any): string {
    const price = w.billing_cycle === 'annual' ? w.price_per_year_usd : w.price_per_month_usd;
    if (price === null || price === undefined) return '—';
    return `$${Number(price).toFixed(2)}${w.billing_cycle === 'annual' ? '/yr' : '/mo'}`;
}

onMounted(loadAll);
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin class="w-1/6" />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div>
                        <div class="font-bold text-2xl">Billing &amp; Credits</div>
                        <p class="text-sm text-gray-600 mt-1">
                            Wallet balances, the per-action price table and the pack catalog.
                            <span :class="creditsEnabled ? 'text-green-600' : 'text-amber-600'" class="font-semibold">
                                {{ creditsEnabled ? 'Metering enabled' : 'Metering disabled (CREDITS_ENABLED=false)' }}
                            </span>
                        </p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button
                            @click="syncPaddle('packs')"
                            class="text-sm px-4 py-2 bg-green-600 text-white hover:bg-green-700 cursor-pointer font-bold shadow-md rounded-lg"
                        >
                            Sync Packs
                        </button>
                        <button
                            @click="syncPaddle('pro')"
                            class="text-sm px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 cursor-pointer font-bold shadow-md rounded-lg"
                        >
                            Sync Pro Credits
                        </button>
                        <button
                            @click="loadAll"
                            class="text-sm px-4 py-2 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg"
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div class="flex gap-2 mb-5 border-b border-gray-200">
                    <button
                        v-for="t in [
                            { key: 'wallets', label: 'Wallets & Ledger' },
                            { key: 'actions', label: 'Action Prices' },
                            { key: 'packs', label: 'Credit Packs' },
                        ]"
                        :key="t.key"
                        @click="tab = t.key as Tab"
                        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer"
                        :class="tab === t.key ? 'border-primary-blue-100 text-primary-blue-100' : 'border-transparent text-gray-500 hover:text-gray-700'"
                    >
                        {{ t.label }}
                    </button>
                </div>

                <div v-if="loading" class="text-center py-10">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-blue-100"></div>
                    <p class="mt-2 text-gray-600">Loading credits…</p>
                </div>

                <template v-else>
                    <!-- Wallets -->
                    <div v-if="tab === 'wallets'" class="w-full">
                        <div class="bg-white shadow-md overflow-x-auto overflow-y-auto max-h-150 rounded-lg ring-1 ring-gray-200 ring-inset">
                            <table class="min-w-full divide-y divide-gray-200 whitespace-nowrap">
                                <thead class="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Organization</th>
                                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renewal</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monthly</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <tr v-for="w in wallets" :key="w.org_id" class="hover:bg-gray-50">
                                        <td class="px-4 py-3 font-medium text-gray-900">
                                            <span class="text-[10px]">{{ w.org_name || `#${w.org_id}` }}</span>
                                            <span class="block text-xs text-gray-400">#{{ w.org_id }}</span>
                                        </td>
                                        <td class="px-4 py-3 text-xs text-gray-700">{{ planLabel(w) }}</td>
                                        <td class="px-4 py-3">
                                            <span :class="['px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', statusInfo(w).cls]">
                                                {{ statusInfo(w).label }}
                                            </span>
                                        </td>
                                        <td class="px-4 py-3 text-xs text-gray-500">{{ formatDate(w.ends_at) }}</td>
                                        <td class="px-4 py-3 text-xs text-right text-gray-700">{{ priceLabel(w) }}</td>
                                        <td class="px-4 py-3 text-sm text-right text-gray-900">{{ formatCredits(w.balance_credits) }}</td>
                                        <td class="px-4 py-3 text-sm text-right text-gray-600">{{ formatCredits(w.monthly_grant_amount) }}</td>
                                        <td class="px-4 py-3 text-right">
                                            <div class="flex justify-end gap-2">
                                                <button @click="openLedger(w.org_id)" class="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 cursor-pointer">Ledger</button>
                                                <button @click="triggerRecharge(w.org_id)" class="px-3 py-1.5 rounded-md text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-700 cursor-pointer">Recharge</button>
                                            </div>
                                        </td>
                                    </tr>
                                    <tr v-if="wallets.length === 0">
                                        <td colspan="8" class="px-4 py-6 text-center text-sm text-gray-500">No wallets yet. They are created on first grant or consumption.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                    </div>

                    <!-- Action prices -->
                    <div v-else-if="tab === 'actions'" class="bg-white shadow-md overflow-x-auto overflow-y-auto max-h-150 rounded-lg ring-1 ring-gray-200 ring-inset">
                        <table class="min-w-full divide-y divide-gray-200 whitespace-nowrap">
                            <thead class="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action key</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display name</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Band</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Multipliers</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Save</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="p in actionPrices" :key="p.id" class="hover:bg-gray-50">
                                    <td class="px-4 py-2 text-sm font-mono text-gray-700">{{ p.action_key }}</td>
                                    <td class="px-4 py-2"><input v-model="p.display_name" class="text-sm px-2 py-1 border border-gray-300 rounded w-48" /></td>
                                    <td class="px-4 py-2 text-right"><input v-model.number="p.credits" type="number" min="0" class="text-sm px-2 py-1 border border-gray-300 rounded w-24 text-right" /></td>
                                    <td class="px-4 py-2">
                                        <select v-model="p.charge_mode" class="text-sm px-2 py-1 border border-gray-300 rounded">
                                            <option value="per_action">per_action</option>
                                            <option value="per_call">per_call</option>
                                        </select>
                                    </td>
                                    <td class="px-4 py-2">
                                        <select v-model="p.band_type" class="text-sm px-2 py-1 border border-gray-300 rounded">
                                            <option value="fixed">fixed</option>
                                            <option value="row_band">row_band</option>
                                            <option value="event_band">event_band</option>
                                        </select>
                                    </td>
                                    <td class="px-4 py-2"><input v-model="p.band_multipliers_text" class="text-sm px-2 py-1 border border-gray-300 rounded w-28" placeholder="1, 2, 3" /></td>
                                    <td class="px-4 py-2 text-center"><input v-model="p.is_active" type="checkbox" /></td>
                                    <td class="px-4 py-2 text-right">
                                        <button @click="saveActionPrice(p)" :disabled="saving === p.id" class="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-50 cursor-pointer">
                                            {{ saving === p.id ? 'Saving…' : 'Save' }}
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- Packs -->
                    <div v-else class="space-y-6">
                        <div class="bg-white shadow-md rounded-lg ring-1 ring-gray-200 ring-inset p-5">
                            <h3 class="font-semibold mb-3">Create pack</h3>
                            <div class="flex flex-wrap items-end gap-3">
                                <input v-model="newPack.name" placeholder="Name" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-44" />
                                <input v-model.number="newPack.credits" type="number" min="1" placeholder="Credits" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-28" />
                                <input v-model.number="newPack.price_usd" type="number" min="0" step="0.01" placeholder="Price USD" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-28" />
                                <input v-model="newPack.paddle_price_id" placeholder="Paddle price ID" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-52" />
                                <input v-model.number="newPack.sort_order" type="number" placeholder="Order" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-20" />
                                <button @click="createPack" class="px-4 py-2 rounded-md text-sm font-medium bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer">Create</button>
                            </div>
                        </div>

                        <div class="bg-white shadow-md overflow-x-auto overflow-y-auto max-h-150 rounded-lg ring-1 ring-gray-200 ring-inset">
                            <table class="min-w-full divide-y divide-gray-200 whitespace-nowrap">
                                <thead class="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credits</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price USD</th>
                                        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paddle price ID</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Order</th>
                                        <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                                        <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Save</th>
                                    </tr>
                                </thead>
                                <tbody class="bg-white divide-y divide-gray-200">
                                    <tr v-for="p in packs" :key="p.id" class="hover:bg-gray-50">
                                        <td class="px-4 py-2"><input v-model="p.name" class="text-sm px-2 py-1 border border-gray-300 rounded w-40" /></td>
                                        <td class="px-4 py-2 text-right"><input v-model.number="p.credits" type="number" class="text-sm px-2 py-1 border border-gray-300 rounded w-28 text-right" /></td>
                                        <td class="px-4 py-2 text-right"><input v-model.number="p.price_usd" type="number" step="0.01" class="text-sm px-2 py-1 border border-gray-300 rounded w-24 text-right" /></td>
                                        <td class="px-4 py-2"><input v-model="p.paddle_price_id" class="text-sm px-2 py-1 border border-gray-300 rounded w-56" /></td>
                                        <td class="px-4 py-2 text-right"><input v-model.number="p.sort_order" type="number" class="text-sm px-2 py-1 border border-gray-300 rounded w-16 text-right" /></td>
                                        <td class="px-4 py-2 text-center"><input v-model="p.is_active" type="checkbox" /></td>
                                        <td class="px-4 py-2 text-right">
                                            <button @click="savePack(p)" :disabled="saving === p.id" class="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 disabled:opacity-50 cursor-pointer">
                                                {{ saving === p.id ? 'Saving…' : 'Save' }}
                                            </button>
                                        </td>
                                    </tr>
                                    <tr v-if="packs.length === 0">
                                        <td colspan="7" class="px-4 py-6 text-center text-sm text-gray-500">No packs configured.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Ledger dialog -->
                    <overlay-dialog v-if="selectedOrg" @close="closeLedger">
                        <template #overlay>
                            <div v-if="ledgerLoading" class="text-sm text-gray-500">Loading…</div>
                            <template v-else-if="ledger">
                                <div class="flex items-center justify-between mb-3">
                                    <h3 class="font-semibold text-[10px]">
                                        {{ ledger?.org_name || `Org #${selectedOrg}` }}
                                        <span v-if="ledger?.org_name" class="text-[10px] font-normal text-gray-400">#{{ selectedOrg }}</span>
                                    </h3>
                                </div>
                                <div v-if="ledger.subscription" class="mb-4 border border-gray-200 rounded-md overflow-hidden">
                                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 text-sm">
                                        <div>
                                            <div class="text-xs text-gray-500">Plan</div>
                                            <div class="font-semibold">{{ planLabel(ledger.subscription) }}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-500">Status</div>
                                            <div>
                                                <span :class="['px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', statusInfo(ledger.subscription).cls]">
                                                    {{ statusInfo(ledger.subscription).label }}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-500">Renewal / End</div>
                                            <div class="font-semibold">{{ formatDate(ledger.subscription.ends_at) }}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs text-gray-500">Price</div>
                                            <div class="font-semibold">{{ priceLabel(ledger.subscription) }}</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center justify-end gap-3 border-t border-gray-100 px-4 py-2 bg-gray-50">
                                        <NuxtLink :to="`/pricing?orgId=${selectedOrg}`" class="text-xs text-blue-600 hover:underline cursor-pointer">Change plan / volume</NuxtLink>
                                        <NuxtLink :to="`/admin/organizations/${selectedOrg}/settings`" class="text-xs text-gray-500 hover:underline">Org settings</NuxtLink>
                                    </div>
                                </div>
                                <div class="grid grid-cols-3 gap-3 mb-4 text-sm">
                                    <div class="bg-gray-50 rounded p-2">
                                        <div class="text-xs text-gray-500">Balance</div>
                                        <div class="font-semibold">{{ formatCredits(ledger.wallet.balance_credits) }}</div>
                                    </div>
                                    <div class="bg-gray-50 rounded p-2">
                                        <div class="text-xs text-gray-500">Monthly</div>
                                        <div class="font-semibold">{{ formatCredits(ledger.wallet.monthly_grant_amount) }}</div>
                                    </div>
                                    <div class="bg-gray-50 rounded p-2">
                                        <div class="text-xs text-gray-500">Rollover</div>
                                        <div class="font-semibold">{{ formatCredits(ledger.wallet.rollover_balance) }}</div>
                                    </div>
                                </div>

                                <div class="flex flex-wrap items-end gap-2 mb-4">
                                    <div>
                                        <label class="block text-xs text-gray-500 mb-1">Grant amount (blank = plan default)</label>
                                        <input v-model.number="grantAmount" type="number" min="0" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-40" />
                                    </div>
                                    <button @click="applyGrant" class="px-3 py-1.5 rounded-md text-xs font-medium bg-green-100 hover:bg-green-200 text-green-700 cursor-pointer">Apply grant</button>
                                </div>

                                <div class="flex flex-wrap items-end gap-2 mb-4">
                                    <div>
                                        <label class="block text-xs text-gray-500 mb-1">Adjustment (+/-)</label>
                                        <input v-model.number="adjustAmount" type="number" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-32" />
                                    </div>
                                    <div class="flex-1 min-w-40">
                                        <label class="block text-xs text-gray-500 mb-1">Reason</label>
                                        <input v-model="adjustDescription" type="text" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-full" placeholder="Support adjustment" />
                                    </div>
                                    <button @click="applyAdjustment" class="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-700 cursor-pointer">Adjust</button>
                                </div>

                                <div class="flex flex-wrap items-end gap-2 mb-4">
                                    <div>
                                        <label class="block text-xs text-gray-500 mb-1">Auto-recharge threshold</label>
                                        <input v-model.number="autoRechargeThreshold" type="number" min="0" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-40" />
                                    </div>
                                    <div class="flex-1 min-w-40">
                                        <label class="block text-xs text-gray-500 mb-1">Recharge with pack</label>
                                        <select v-model="autoRechargePackId" class="text-sm px-2 py-1.5 border border-gray-300 rounded-md w-full bg-white">
                                            <option :value="null">Disabled</option>
                                            <option v-for="pack in packs" :key="pack.id" :value="pack.id">{{ pack.name }} — ${{ pack.price_usd }}</option>
                                        </select>
                                    </div>
                                    <button @click="saveAdminAutoRecharge" class="px-3 py-1.5 rounded-md text-xs font-medium bg-purple-100 hover:bg-purple-200 text-purple-700 cursor-pointer">Save auto-recharge</button>
                                </div>

                                <div class="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                                    <table class="min-w-full divide-y divide-gray-200 text-xs">
                                        <thead class="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th class="px-2 py-2 text-left text-gray-500">Type</th>
                                                <th class="px-2 py-2 text-right text-gray-500">Amount</th>
                                                <th class="px-2 py-2 text-left text-gray-500">Source</th>
                                                <th class="px-2 py-2 text-left text-gray-500">Action</th>
                                                <th class="px-2 py-2 text-left text-gray-500">When</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100">
                                            <tr v-for="t in ledger.transactions" :key="t.id">
                                                <td class="px-2 py-1.5 font-medium">{{ t.type }}</td>
                                                <td class="px-2 py-1.5 text-right" :class="Number(t.amount) < 0 ? 'text-red-600' : 'text-green-600'">{{ formatCredits(t.amount) }}</td>
                                                <td class="px-2 py-1.5 text-gray-600">{{ t.source }}</td>
                                                <td class="px-2 py-1.5 text-gray-600">{{ t.action_key || '—' }}</td>
                                                <td class="px-2 py-1.5 text-gray-500">{{ formatDate(t.created_at) }}</td>
                                            </tr>
                                            <tr v-if="ledger.transactions.length === 0">
                                                <td colspan="5" class="px-2 py-4 text-center text-gray-500">No ledger entries yet.</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </template>
                        </template>
                    </overlay-dialog>
                </template>
            </div>
        </div>
    </div>
</template>
