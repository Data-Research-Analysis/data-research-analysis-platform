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
    price_per_year_usd: props.tier?.price_per_year_usd !== undefined && props.tier.price_per_year_usd !== null ? parseFloat(props.tier.price_per_year_usd) : null,
    is_active: props.tier?.is_active !== undefined ? props.tier.is_active : true,
    paddle_product_id: props.tier?.paddle_product_id || null,
    paddle_price_id_monthly: props.tier?.paddle_price_id_monthly || null,
    paddle_price_id_annual: props.tier?.paddle_price_id_annual || null,
});

const errors = ref({});

function validateForm() {
    errors.value = {};
    
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
    } else if (formData.price_per_month_usd < 0) {
        errors.value.price_per_month_usd = 'Price must be 0 or greater';
    }
    
    // Optional field: annual price, if set must be non-negative
    if (formData.price_per_year_usd !== null && formData.price_per_year_usd !== undefined && formData.price_per_year_usd !== '') {
        if (Number.isNaN(Number(formData.price_per_year_usd)) || Number(formData.price_per_year_usd) < 0) {
            errors.value.price_per_year_usd = 'Annual price must be 0 or greater';
        }
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
    
    const isValid = Object.keys(errors.value).length === 0;
    return isValid;
}

function handleSubmit() {
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
        <BaseFormField label="Tier Name" required>
            <BaseInput
                v-model="formData.tier_name"
                placeholder="e.g., Premium, Standard, Custom"
                :error="errors.tier_name"
            />
        </BaseFormField>

        <!-- Max Rows Per Data Model -->
        <BaseFormField label="Max Rows Per Data Model" required>
            <div class="flex gap-2">
                <BaseNumberInput
                    v-model="formData.max_rows_per_data_model"
                    placeholder="e.g., 100000"
                    :error="errors.max_rows_per_data_model"
                    :min="-1"
                    input-class="flex-1"
                    required
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
        </BaseFormField>

        <!-- Max Projects -->
        <BaseFormField label="Max Projects" required>
            <div class="flex gap-2">
                <BaseNumberInput
                    v-model="formData.max_projects"
                    placeholder="Enter number or click Unlimited"
                    :error="errors.max_projects"
                    :min="-1"
                    input-class="flex-1"
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
        </BaseFormField>

        <!-- Max Data Sources Per Project -->
        <BaseFormField label="Max Data Sources Per Project" required>
            <div class="flex gap-2">
                <BaseNumberInput
                    v-model="formData.max_data_sources_per_project"
                    placeholder="Enter number or click Unlimited"
                    :error="errors.max_data_sources_per_project"
                    :min="-1"
                    input-class="flex-1"
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
        </BaseFormField>

        <!-- Max Data Models Per Data Source -->
        <BaseFormField label="Max Data Models Per Data Source" required>
            <div class="flex gap-2">
                <BaseNumberInput
                    v-model="formData.max_data_models_per_data_source"
                    placeholder="Enter number or click Unlimited"
                    :error="errors.max_data_models_per_data_source"
                    :min="-1"
                    input-class="flex-1"
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
        </BaseFormField>

        <!-- Max Dashboards -->
        <BaseFormField label="Max Dashboards" required>
            <div class="flex gap-2">
                <BaseNumberInput
                    v-model="formData.max_dashboards"
                    placeholder="Enter number or click Unlimited"
                    :error="errors.max_dashboards"
                    :min="-1"
                    input-class="flex-1"
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
        </BaseFormField>

        <!-- AI Generations Per Month -->
        <BaseFormField label="AI Generations Per Month" required>
            <div class="flex gap-2">
                <BaseNumberInput
                    v-model="formData.ai_generations_per_month"
                    placeholder="Enter number or click Unlimited"
                    :error="errors.ai_generations_per_month"
                    :min="-1"
                    input-class="flex-1"
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
        </BaseFormField>

        <!-- Price Per Month USD -->
        <BaseFormField label="Price Per Month (USD)" required>
            <div class="flex items-center">
                <span class="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-700">$</span>
                <BaseNumberInput
                    v-model="formData.price_per_month_usd"
                    placeholder="e.g., 0 or 99.99"
                    :error="errors.price_per_month_usd"
                    :min="0"
                    :step="0.01"
                    input-class="flex-1 rounded-l-none"
                />
            </div>
        </BaseFormField>

        <!-- Price Per Year USD -->
        <BaseFormField label="Price Per Year (USD)" :required="false" hint="Discounted annual billing price. Leave blank to hide annual pricing for this tier.">
            <template #labelSuffix>
                <span class="text-gray-400 text-xs font-normal ml-1">(optional)</span>
            </template>
            <div class="flex items-center">
                <span class="px-3 py-2 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-700">$</span>
                <BaseNumberInput
                    v-model="formData.price_per_year_usd"
                    placeholder="e.g., 0 or 999.99 (leave blank if not set)"
                    :error="errors.price_per_year_usd"
                    :min="0"
                    :step="0.01"
                    input-class="flex-1 rounded-l-none"
                />
            </div>
        </BaseFormField>

        <!-- Paddle Integration Fields -->
        <div class="border-t pt-4 mt-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Paddle Payment Gateway</h3>
            <p class="text-sm text-gray-600 mb-4">
                Configure Paddle.com product and price IDs for this tier. Get these from your Paddle Dashboard → Catalog → Products.
                Leave blank for FREE tier.
            </p>

            <!-- Paddle Product ID -->
            <BaseFormField 
                label="Paddle Product ID" 
                :required="false" 
                hint="Format: pro_xxxxx (from Paddle Dashboard)"
            >
                <template #labelSuffix>
                    <span class="text-gray-400 text-xs font-normal ml-1">(optional)</span>
                </template>
                <BaseInput
                    v-model="formData.paddle_product_id"
                    placeholder="e.g., pro_01h2abc123def456"
                    :error="errors.paddle_product_id"
                />
            </BaseFormField>

            <!-- Paddle Monthly Price ID -->
            <BaseFormField 
                label="Paddle Monthly Price ID" 
                :required="false" 
                hint="Format: pri_xxxxx (monthly billing price from Paddle Dashboard)"
            >
                <template #labelSuffix>
                    <span class="text-gray-400 text-xs font-normal ml-1">(optional)</span>
                </template>
                <BaseInput
                    v-model="formData.paddle_price_id_monthly"
                    placeholder="e.g., pri_01h2xyz789ghi012"
                    :error="errors.paddle_price_id_monthly"
                />
            </BaseFormField>

            <!-- Paddle Annual Price ID -->
            <BaseFormField 
                label="Paddle Annual Price ID" 
                :required="false" 
                hint="Format: pri_xxxxx (annual billing price from Paddle Dashboard)"
            >
                <template #labelSuffix>
                    <span class="text-gray-400 text-xs font-normal ml-1">(optional)</span>
                </template>
                <BaseInput
                    v-model="formData.paddle_price_id_annual"
                    placeholder="e.g., pri_01h2mno345pqr678"
                    :error="errors.paddle_price_id_annual"
                />
            </BaseFormField>
        </div>

        <!-- Is Active -->
        <BaseCheckbox
            v-model="formData.is_active"
            label="Active"
            id="is_active"
        />

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
