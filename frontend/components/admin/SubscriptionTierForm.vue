<script setup>
import { ESubscriptionTier } from '@/types/subscriptions/ESubscriptionTier';

const props = defineProps({
    tier: {
        type: Object,
        default: null,
    },
    mode: {
        type: String,
        default: 'create', // 'create' or 'edit'
    },
});

const emit = defineEmits(['submit', 'cancel']);

const formData = reactive({
    tier_name: props.tier?.tier_name || ESubscriptionTier.FREE,
    max_rows_per_data_model: props.tier?.max_rows_per_data_model ? parseInt(props.tier.max_rows_per_data_model, 10) : 100000,
    max_projects: props.tier?.max_projects || null,
    max_data_sources_per_project: props.tier?.max_data_sources_per_project || null,
    max_dashboards: props.tier?.max_dashboards || null,
    ai_generations_per_month: props.tier?.ai_generations_per_month || null,
    price_per_month_usd: props.tier?.price_per_month_usd ? parseFloat(props.tier.price_per_month_usd) : 0,
    is_active: props.tier?.is_active !== undefined ? props.tier.is_active : true,
});

const errors = ref({});

const tierOptions = Object.values(ESubscriptionTier);

function validateForm() {
    errors.value = {};
    
    if (!formData.tier_name) {
        errors.value.tier_name = 'Tier name is required';
    }
    
    if (formData.max_rows_per_data_model === null || formData.max_rows_per_data_model === undefined) {
        errors.value.max_rows_per_data_model = 'Max rows is required';
    } else if (formData.max_rows_per_data_model < -1) {
        errors.value.max_rows_per_data_model = 'Max rows must be -1 (unlimited) or a positive number';
    }
    
    if (formData.price_per_month_usd < 0) {
        errors.value.price_per_month_usd = 'Price must be 0 or greater';
    }
    
    // Validate optional fields if they're not null
    if (formData.max_projects !== null && formData.max_projects < -1) {
        errors.value.max_projects = 'Max projects must be -1 (unlimited) or a positive number';
    }
    
    if (formData.max_data_sources_per_project !== null && formData.max_data_sources_per_project < -1) {
        errors.value.max_data_sources_per_project = 'Max data sources must be -1 (unlimited) or a positive number';
    }
    
    if (formData.max_dashboards !== null && formData.max_dashboards < -1) {
        errors.value.max_dashboards = 'Max dashboards must be -1 (unlimited) or a positive number';
    }
    
    if (formData.ai_generations_per_month !== null && formData.ai_generations_per_month < -1) {
        errors.value.ai_generations_per_month = 'AI generations must be -1 (unlimited) or a positive number';
    }
    
    return Object.keys(errors.value).length === 0;
}

function handleSubmit() {
    if (validateForm()) {
        emit('submit', formData);
    }
}

function handleCancel() {
    emit('cancel');
}

function setUnlimited(field) {
    formData[field] = -1;
}

function setNull(field) {
    formData[field] = null;
}
</script>

<template>
    <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Tier Name -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Tier Name <span class="text-red-500">*</span>
            </label>
            <select
                v-model="formData.tier_name"
                :disabled="mode === 'edit'"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                :class="{ 'bg-gray-100': mode === 'edit', 'border-red-500': errors.tier_name }"
            >
                <option v-for="tier in tierOptions" :key="tier" :value="tier">
                    {{ tier }}
                </option>
            </select>
            <p v-if="errors.tier_name" class="mt-1 text-sm text-red-500">{{ errors.tier_name }}</p>
        </div>

        <!-- Max Rows Per Data Model -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Max Rows Per Data Model <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_rows_per_data_model"
                    type="number"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_rows_per_data_model }"
                />
                <button
                    type="button"
                    @click="setUnlimited('max_rows_per_data_model')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    Unlimited
                </button>
            </div>
            <p v-if="formData.max_rows_per_data_model === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_rows_per_data_model" class="mt-1 text-sm text-red-500">{{ errors.max_rows_per_data_model }}</p>
        </div>

        <!-- Max Projects -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Max Projects
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_projects"
                    type="number"
                    placeholder="Leave blank for no limit"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_projects }"
                />
                <button
                    type="button"
                    @click="setUnlimited('max_projects')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    Unlimited
                </button>
                <button
                    type="button"
                    @click="setNull('max_projects')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    N/A
                </button>
            </div>
            <p v-if="formData.max_projects === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_projects" class="mt-1 text-sm text-red-500">{{ errors.max_projects }}</p>
        </div>

        <!-- Max Data Sources Per Project -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Max Data Sources Per Project
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_data_sources_per_project"
                    type="number"
                    placeholder="Leave blank for no limit"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_data_sources_per_project }"
                />
                <button
                    type="button"
                    @click="setUnlimited('max_data_sources_per_project')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    Unlimited
                </button>
                <button
                    type="button"
                    @click="setNull('max_data_sources_per_project')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    N/A
                </button>
            </div>
            <p v-if="formData.max_data_sources_per_project === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_data_sources_per_project" class="mt-1 text-sm text-red-500">{{ errors.max_data_sources_per_project }}</p>
        </div>

        <!-- Max Dashboards -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Max Dashboards
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_dashboards"
                    type="number"
                    placeholder="Leave blank for no limit"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_dashboards }"
                />
                <button
                    type="button"
                    @click="setUnlimited('max_dashboards')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    Unlimited
                </button>
                <button
                    type="button"
                    @click="setNull('max_dashboards')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    N/A
                </button>
            </div>
            <p v-if="formData.max_dashboards === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_dashboards" class="mt-1 text-sm text-red-500">{{ errors.max_dashboards }}</p>
        </div>

        <!-- AI Generations Per Month -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                AI Generations Per Month
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.ai_generations_per_month"
                    type="number"
                    placeholder="Leave blank for no limit"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.ai_generations_per_month }"
                />
                <button
                    type="button"
                    @click="setUnlimited('ai_generations_per_month')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    Unlimited
                </button>
                <button
                    type="button"
                    @click="setNull('ai_generations_per_month')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                    N/A
                </button>
            </div>
            <p v-if="formData.ai_generations_per_month === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.ai_generations_per_month" class="mt-1 text-sm text-red-500">{{ errors.ai_generations_per_month }}</p>
        </div>

        <!-- Price Per Month USD -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Price Per Month (USD) <span class="text-red-500">*</span>
            </label>
            <div class="flex items-center">
                <span class="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-700">$</span>
                <input
                    v-model.number="formData.price_per_month_usd"
                    type="number"
                    step="0.01"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-r-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.price_per_month_usd }"
                />
            </div>
            <p v-if="errors.price_per_month_usd" class="mt-1 text-sm text-red-500">{{ errors.price_per_month_usd }}</p>
        </div>

        <!-- Is Active -->
        <div class="flex items-center">
            <input
                v-model="formData.is_active"
                type="checkbox"
                id="is_active"
                class="h-4 w-4 text-primary-blue-100 focus:ring-primary-blue-100 border-gray-300 rounded"
            />
            <label for="is_active" class="ml-2 block text-sm text-gray-700">
                Active
            </label>
        </div>

        <!-- Form Actions -->
        <div class="flex justify-end gap-3 pt-4">
            <button
                type="button"
                @click="handleCancel"
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
            >
                Cancel
            </button>
            <button
                type="submit"
                class="px-4 py-2 bg-primary-blue-100 text-white rounded-md hover:bg-primary-blue-300 font-medium"
            >
                {{ mode === 'edit' ? 'Update' : 'Create' }} Tier
            </button>
        </div>
    </form>
</template>
