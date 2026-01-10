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
    tier_name: props.tier?.tier_name || '',
    max_rows_per_data_model: props.tier?.max_rows_per_data_model ? parseInt(props.tier.max_rows_per_data_model, 10) : null,
    max_projects: props.tier?.max_projects || null,
    max_data_sources_per_project: props.tier?.max_data_sources_per_project || null,
    max_data_models_per_data_source: props.tier?.max_data_models_per_data_source || null,
    max_dashboards: props.tier?.max_dashboards || null,
    ai_generations_per_month: props.tier?.ai_generations_per_month || null,
    price_per_month_usd: props.tier?.price_per_month_usd !== undefined ? parseFloat(props.tier.price_per_month_usd) : null,
    is_active: props.tier?.is_active !== undefined ? props.tier.is_active : true,
});

const errors = ref({});

function validateForm() {
    errors.value = {};
    
    console.log('Validating form data:', JSON.stringify(formData, null, 2));
    
    // Tier name is required and must not be empty
    if (!formData.tier_name || formData.tier_name.trim() === '') {
        errors.value.tier_name = 'Tier name is required';
    }
    
    // Required field: max_rows_per_data_model must be -1 or positive integer (not empty)
    if (formData.max_rows_per_data_model === null || 
        formData.max_rows_per_data_model === undefined || 
        formData.max_rows_per_data_model === '' || 
        Number.isNaN(formData.max_rows_per_data_model)) {
        errors.value.max_rows_per_data_model = 'Max rows is required - enter a number or click Unlimited';
        console.log('Max rows validation failed:', formData.max_rows_per_data_model);
    } else if (!Number.isInteger(formData.max_rows_per_data_model)) {
        errors.value.max_rows_per_data_model = 'Max rows must be a whole number';
    } else if (formData.max_rows_per_data_model === 0) {
        errors.value.max_rows_per_data_model = 'Max rows cannot be 0 - use -1 for unlimited or enter a positive number';
    } else if (formData.max_rows_per_data_model !== -1 && formData.max_rows_per_data_model < 0) {
        errors.value.max_rows_per_data_model = 'Max rows must be -1 (unlimited) or a positive number';
    }
    
    // Required field: price must be explicitly set (0 is valid, but null is not)
    if (formData.price_per_month_usd === null || 
        formData.price_per_month_usd === undefined || 
        formData.price_per_month_usd === '' || 
        Number.isNaN(formData.price_per_month_usd)) {
        errors.value.price_per_month_usd = 'Price is required - enter 0 for free or a positive amount';
        console.log('Price validation failed:', formData.price_per_month_usd);
    } else if (formData.price_per_month_usd < 0) {
        errors.value.price_per_month_usd = 'Price must be 0 or greater';
    }
    
    // Required fields: These must be -1 or positive integers (cannot be null/empty)
    const requiredLimitFields = [
        { key: 'max_projects', label: 'Max Projects' },
        { key: 'max_data_sources_per_project', label: 'Max Data Sources Per Project' },
        { key: 'max_data_models_per_data_source', label: 'Max Data Models Per Data Source' },
        { key: 'max_dashboards', label: 'Max Dashboards' },
        { key: 'ai_generations_per_month', label: 'AI Generations Per Month' }
    ];
    
    for (const field of requiredLimitFields) {
        const value = formData[field.key];
        
        // Check if empty/null
        if (value === null || value === undefined || value === '' || Number.isNaN(value)) {
            errors.value[field.key] = `${field.label} is required - enter a number or click Unlimited`;
        }
        // Check if it's an integer
        else if (!Number.isInteger(value)) {
            errors.value[field.key] = 'Must be a whole number';
        }
        // Check if it's 0 (not allowed)
        else if (value === 0) {
            errors.value[field.key] = 'Cannot be 0 - use -1 for unlimited or enter a positive number';
        }
        // Check if it's a negative number other than -1
        else if (value !== -1 && value < 0) {
            errors.value[field.key] = 'Must be -1 (unlimited) or a positive number';
        }
    }
    
    console.log('formData', formData);
    
    const isValid = Object.keys(errors.value).length === 0;
    console.log('Form validation result:', isValid, 'Errors:', errors.value);
    return isValid;
}

function handleSubmit() {
    console.log('handleSubmit called');
    const isValid = validateForm();
    
    if (!isValid) {
        console.error('Form validation failed. Cannot submit.');
        // Scroll to first error
        nextTick(() => {
            const firstError = document.querySelector('.border-red-500');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstError.focus();
            }
        });
        return;
    }
    
    console.log('Form is valid, emitting submit with data:', formData);
    emit('submit', formData);
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
            <input
                v-model="formData.tier_name"
                type="text"
                placeholder="e.g., Premium, Standard, Custom"
                class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                :class="{ 'border-red-500': errors.tier_name }"
            />
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
                    required
                    placeholder="e.g., 100000"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_rows_per_data_model }"
                    min="-1"                    
                />
                <button
                    type="button"
                    @click="setUnlimited('max_rows_per_data_model')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer"
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
                Max Projects <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_projects"
                    type="number"
                    placeholder="Enter number or click Unlimited"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_projects }"
                    min="-1"                    
                />
                <button
                    type="button"
                    @click="setUnlimited('max_projects')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer"
                >
                    Unlimited
                </button>
            </div>
            <p v-if="formData.max_projects === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_projects" class="mt-1 text-sm text-red-500">{{ errors.max_projects }}</p>
        </div>

        <!-- Max Data Sources Per Project -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Max Data Sources Per Project <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_data_sources_per_project"
                    type="number"
                    placeholder="Enter number or click Unlimited"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_data_sources_per_project }"
                    min="-1"                    
                />
                <button
                    type="button"
                    @click="setUnlimited('max_data_sources_per_project')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer"
                >
                    Unlimited
                </button>
            </div>
            <p v-if="formData.max_data_sources_per_project === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_data_sources_per_project" class="mt-1 text-sm text-red-500">{{ errors.max_data_sources_per_project }}</p>
        </div>

        <!-- Max Data Models Per Data Source -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Max Data Models Per Data Source <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_data_models_per_data_source"
                    type="number"
                    placeholder="Enter number or click Unlimited"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_data_models_per_data_source }"
                    min="-1"
                />
                <button
                    type="button"
                    @click="setUnlimited('max_data_models_per_data_source')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer"
                >
                    Unlimited
                </button>
            </div>
            <p v-if="formData.max_data_models_per_data_source === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_data_models_per_data_source" class="mt-1 text-sm text-red-500">{{ errors.max_data_models_per_data_source }}</p>
        </div>

        <!-- Max Dashboards -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                Max Dashboards <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.max_dashboards"
                    type="number"
                    placeholder="Enter number or click Unlimited"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.max_dashboards }"
                    min="-1"
                />
                <button
                    type="button"
                    @click="setUnlimited('max_dashboards')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer"
                >
                    Unlimited
                </button>
            </div>
            <p v-if="formData.max_dashboards === -1" class="mt-1 text-sm text-blue-600">Set to unlimited</p>
            <p v-if="errors.max_dashboards" class="mt-1 text-sm text-red-500">{{ errors.max_dashboards }}</p>
        </div>

        <!-- AI Generations Per Month -->
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
                AI Generations Per Month <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
                <input
                    v-model.number="formData.ai_generations_per_month"
                    type="number"
                    placeholder="Enter number or click Unlimited"
                    class="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-blue-100 focus:border-primary-blue-100"
                    :class="{ 'border-red-500': errors.ai_generations_per_month }"
                    min="-1"                    
                />
                <button
                    type="button"
                    @click="setUnlimited('ai_generations_per_month')"
                    class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 cursor-pointer"
                >
                    Unlimited
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
                    required
                    min="0"
                    placeholder="e.g., 0 or 99.99"
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
                class="h-4 w-4 text-primary-blue-100 focus:ring-primary-blue-100 border-gray-300 rounded cursor-pointer"
            />
            <label for="is_active" class="ml-2 block text-sm text-gray-700 cursor-pointer">
                Active
            </label>
        </div>

        <!-- Form Actions -->
        <div class="flex justify-end gap-3 pt-4">
            <button
                type="button"
                @click="handleCancel"
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium cursor-pointer"
            >
                Cancel
            </button>
            <button
                type="submit"
                class="px-4 py-2 bg-primary-blue-100 text-white rounded-md hover:bg-primary-blue-300 font-medium cursor-pointer"
            >
                {{ mode === 'edit' ? 'Update' : 'Create' }} Tier
            </button>
        </div>
    </form>
</template>
