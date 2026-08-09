<script setup lang="ts">
definePageMeta({ layout: 'default' });

import { getAuthToken } from '~/composables/AuthToken';
import { useOrganizationContext } from '@/composables/useOrganizationContext';

const { getOrgId, getHeaders } = useOrganizationContext();
const router = useRouter();

const config = useRuntimeConfig();
const apiUrl = config.public.apiBase;

const orgId = ref<number | null>(null);
const orgName = ref('');
const isLoading = ref(true);
const isSaving = ref(false);
const isUploading = ref(false);
const error = ref('');
const successMessage = ref('');

const primaryColor = ref('#3C8DBC');
const secondaryColor = ref('#1E3050');
const brandingEnabled = ref(false);
const logoUrl = ref('');

const eligible = ref(false);
const tierName = ref('');
const tierRank = ref(0);

async function loadOrg() {
    isLoading.value = true;
    error.value = '';

    const headers = getHeaders();

    try {
        const orgsData = await $fetch<{ success: boolean; data: any[] }>(`${apiUrl}/organizations`, {
            headers,
        });
        const orgs = orgsData?.data ?? [];

        if (orgs.length === 0) {
            error.value = 'No organization found.';
            return;
        }

        const selectedOrgId = getOrgId() ?? orgs[0].id;
        orgId.value = selectedOrgId;

        const org = orgs.find((o: any) => o.id === selectedOrgId);
        if (org) {
            orgName.value = org.name;
        }

        const sub = await $fetch<{ success: boolean; data: any }>(
            `${apiUrl}/subscription/${selectedOrgId}`, { headers }
        );
        const subData = sub?.data;
        tierRank.value = subData?.tier_rank ?? 0;
        tierName.value = subData?.tier_name ?? 'Free';
        eligible.value = tierRank.value >= 30;

        const brandingData = await $fetch<{ success: boolean; data: any }>(
            `${apiUrl}/organizations/${selectedOrgId}/branding`
        );
        const branding = brandingData?.data;
        if (branding) {
            primaryColor.value = branding.primaryColor ?? '#3C8DBC';
            secondaryColor.value = branding.secondaryColor ?? '#1E3050';
            brandingEnabled.value = branding.enabled ?? false;
            logoUrl.value = branding.logoUrl ?? '';
        }
    } catch (err: any) {
        error.value = err?.data?.message ?? err?.message ?? 'Failed to load organization settings';
    } finally {
        isLoading.value = false;
    }
}

async function handleLogoUpload(file: File) {
    if (!file) return;
    isUploading.value = true;
    error.value = '';

    try {
        const token = getAuthToken();
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${apiUrl}/admin/image/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error('Logo upload failed');
        }

        const data = await response.json();
        if (data.urls && data.urls.length > 0 && data.urls[0].url) {
            logoUrl.value = data.urls[0].url;
        }
    } catch (err: any) {
        error.value = err?.message ?? 'Failed to upload logo.';
    } finally {
        isUploading.value = false;
    }
}

async function saveBranding() {
    if (!orgId.value) return;
    isSaving.value = true;
    error.value = '';
    successMessage.value = '';

    try {
        const headers = getHeaders();
        await $fetch(`${apiUrl}/organizations/${orgId.value}/branding`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                primaryColor: primaryColor.value || null,
                secondaryColor: secondaryColor.value || null,
                brandingEnabled: brandingEnabled.value,
                logoUrl: logoUrl.value || null,
            }),
        });
        successMessage.value = 'Branding settings saved successfully.';
        setTimeout(() => { successMessage.value = ''; }, 3000);
    } catch (err: any) {
        error.value = err?.data?.message ?? err?.message ?? 'Failed to save branding settings';
    } finally {
        isSaving.value = false;
    }
}

onMounted(() => {
    loadOrg();
});
</script>

<template>
    <div class="min-h-screen bg-gray-50">
        <div class="max-w-3xl mx-auto px-4 py-10">
            <div class="mb-8">
                <button
                    class="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 mb-4 cursor-pointer"
                    @click="router.back()"
                >
                    <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-2" />
                    Back
                </button>
                <h1 class="text-3xl font-bold text-gray-900">Custom Branding</h1>
                <p class="mt-2 text-sm text-gray-500">
                    Customize how your public reports and dashboards look. Your branding will appear on all shared reports, dashboards, and exports.
                </p>
            </div>

            <div v-if="isLoading" class="flex justify-center items-center py-12">
                <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-blue-500" />
            </div>

            <div v-else-if="!eligible" class="bg-white border rounded-lg p-8 text-center">
                <font-awesome-icon :icon="['fas', 'palette']" class="text-4xl text-gray-300 mb-4" />
                <h2 class="text-lg font-semibold text-gray-700 mb-2">Upgrade Required</h2>
                <p class="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                    Custom branding is available on the <strong>Professional Plus</strong> plan and above.
                    Upgrade your plan to add your own logo and colors to public reports and dashboards.
                </p>
                <NuxtLink
                    to="/pricing"
                    class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm font-medium"
                >
                    View Plans
                </NuxtLink>
            </div>

            <div v-else class="space-y-6">
                <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p class="text-red-800 text-sm">{{ error }}</p>
                </div>

                <div v-if="successMessage" class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p class="text-green-800 text-sm">{{ successMessage }}</p>
                </div>

                <div class="bg-white border rounded-lg p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Branding Configuration</h2>

                    <div class="space-y-6">
                        <div class="flex items-start justify-between">
                            <div>
                                <label class="font-medium text-gray-800 text-sm">Enable Custom Branding</label>
                                <p class="text-xs text-gray-500 mt-1">
                                    When enabled, your colors and logo will appear on all public reports and dashboards.
                                </p>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input v-model="brandingEnabled" type="checkbox" class="sr-only peer" />
                                <div
                                    class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                                />
                            </label>
                        </div>

                        <div class="border-t pt-6">
                            <label class="block font-medium text-gray-800 text-sm mb-2">Logo</label>
                            <p class="text-xs text-gray-500 mb-3">
                                Upload your logo image. Recommended size: 200×40px, PNG or SVG.
                            </p>
                            <div class="space-y-3">
                                <div v-if="logoUrl" class="flex items-center gap-3">
                                    <img
                                        :src="logoUrl"
                                        class="h-8 w-auto object-contain border rounded p-1"
                                        alt="Current logo"
                                    />
                                    <button
                                        type="button"
                                        class="text-xs text-red-600 hover:text-red-800 cursor-pointer"
                                        @click="logoUrl = ''"
                                    >
                                        Remove
                                    </button>
                                </div>
                                <div class="flex items-center gap-3">
                                    <label
                                        class="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
                                        :class="{ 'opacity-50 pointer-events-none': isUploading }"
                                    >
                                        <font-awesome-icon
                                            v-if="isUploading"
                                            :icon="['fas', 'spinner']"
                                            class="animate-spin"
                                        />
                                        <font-awesome-icon v-else :icon="['fas', 'upload']" />
                                        {{ isUploading ? 'Uploading...' : 'Upload Logo' }}
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp"
                                            class="hidden"
                                            @change="(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleLogoUpload(f); }"
                                        />
                                    </label>
                                    <span class="text-xs text-gray-400">or</span>
                                    <input
                                        v-model="logoUrl"
                                        type="url"
                                        class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="https://example.com/logo.png"
                                    />
                                </div>
                            </div>
                        </div>

                        <div class="border-t pt-6">
                            <label class="block font-medium text-gray-800 text-sm mb-2">Primary Color</label>
                            <p class="text-xs text-gray-500 mb-3">
                                Used for headers, buttons, and primary accents in public pages.
                            </p>
                            <div class="flex items-center gap-3">
                                <input
                                    v-model="primaryColor"
                                    type="color"
                                    class="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                                />
                                <input
                                    v-model="primaryColor"
                                    type="text"
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="#3C8DBC"
                                    pattern="^#[0-9A-Fa-f]{6}$"
                                    maxlength="7"
                                />
                            </div>
                        </div>

                        <div class="border-t pt-6">
                            <label class="block font-medium text-gray-800 text-sm mb-2">Secondary Color</label>
                            <p class="text-xs text-gray-500 mb-3">
                                Used for secondary accents and subtle highlights.
                            </p>
                            <div class="flex items-center gap-3">
                                <input
                                    v-model="secondaryColor"
                                    type="color"
                                    class="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                                />
                                <input
                                    v-model="secondaryColor"
                                    type="text"
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="#1E3050"
                                    pattern="^#[0-9A-Fa-f]{6}$"
                                    maxlength="7"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white border rounded-lg p-6">
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
                    <p class="text-xs text-gray-500 mb-6">
                        This is a live preview of how your public report header will look.
                    </p>

                    <div class="rounded-lg overflow-hidden border">
                        <div
                            class="px-4 py-3 flex items-center justify-between"
                            :style="brandingEnabled ? { backgroundColor: primaryColor } : { backgroundColor: '#3C8DBC' }"
                        >
                            <div class="flex items-center gap-3">
                                <img
                                    v-if="brandingEnabled && logoUrl"
                                    :src="logoUrl"
                                    class="h-5 w-auto object-contain"
                                    alt="Logo preview"
                                    @error="(e) => { (e.target as HTMLImageElement).style.display = 'none'; }"
                                />
                                <font-awesome-icon
                                    v-else
                                    :icon="['fas', 'chart-bar']"
                                    class="text-lg"
                                    :class="brandingEnabled ? 'text-white/70' : 'text-white/70'"
                                />
                                <span
                                    class="text-sm font-medium"
                                    :style="brandingEnabled ? { color: secondaryColor } : {}"
                                    :class="brandingEnabled ? '' : 'text-white/80'"
                                >
                                    {{ orgName || 'Your Organization' }} — Report
                                </span>
                            </div>
                            <span
                                class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md"
                                :style="brandingEnabled ? { backgroundColor: secondaryColor + '30', color: secondaryColor } : { backgroundColor: '#ffffff20', color: '#ffffff99' }"
                            >
                                <font-awesome-icon :icon="['fas', 'circle-check']" />
                                Published
                            </span>
                        </div>
                        <div class="bg-white px-4 py-8">
                            <div class="flex flex-col items-center justify-center text-center py-6">
                                <p class="text-sm text-gray-400">
                                    Report content will appear here using your brand colors for accents and buttons.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end">
                    <button
                        type="button"
                        :disabled="isSaving"
                        class="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer text-sm font-medium disabled:opacity-50"
                        @click="saveBranding"
                    >
                        <font-awesome-icon v-if="isSaving" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                        {{ isSaving ? 'Saving...' : 'Save Branding Settings' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
