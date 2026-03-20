<script setup>
import { useUserManagementStore } from '@/stores/user_management';
import { validate, validateRequired, validateEmail, validatePassword, validateSamePassword } from '@/composables/Validator';
const { $swal } = useNuxtApp();
const userManagementStore = useUserManagementStore();
const router = useRouter();
const route = useRoute();

const state = reactive({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    user_type: 'normal',
    loading: false,
    loadingBetaUser: false,
    isConversion: false,
    betaUserId: null,
    betaUserData: null,
    errors: {
        first_name: false,
        last_name: false,
        email: false,
        password: false,
        confirm_password: false,
    },
    errorMessages: [],
});

// Check if this is a beta user conversion
const betaUserId = route.query.betaUserId;
if (betaUserId) {
    state.isConversion = true;
    state.betaUserId = parseInt(betaUserId);
}

// Load beta user data if converting
onMounted(async () => {
    if (state.betaUserId) {
        await loadBetaUserData();
    }
});

async function loadBetaUserData() {
    state.loadingBetaUser = true;
    try {
        const result = await userManagementStore.getEnterpriseQueryForConversion(state.betaUserId);
        if (result.success) {
            state.betaUserData = result.betaUser;
            // Pre-populate form fields
            state.first_name = result.betaUser.first_name;
            state.last_name = result.betaUser.last_name;
            state.email = result.betaUser.email;
        } else {
            $swal.fire({
                title: "Error!",
                text: result.message || "Failed to load inquiry data",
                icon: "error",
                confirmButtonColor: "#3C8DBC",
            });
            router.push('/admin/enterprise-queries');
        }
    } catch (error) {
        $swal.fire({
            title: "Error!",
            text: "An unexpected error occurred while loading inquiry data.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
        router.push('/admin/enterprise-queries');
    } finally {
        state.loadingBetaUser = false;
    }
}

function validateForm() {
    state.errorMessages = [];
    state.errors = {
        first_name: false,
        last_name: false,
        email: false,
        password: false,
        confirm_password: false,
    };

    // First name validation
    if (!validate(state.first_name, "", [validateRequired])) {
        state.errors.first_name = true;
        state.errorMessages.push("First name is required.");
    }

    // Last name validation
    if (!validate(state.last_name, "", [validateRequired])) {
        state.errors.last_name = true;
        state.errorMessages.push("Last name is required.");
    }

    // Email validation
    if (!validate(state.email, "", [validateEmail, validateRequired])) {
        state.errors.email = true;
        state.errorMessages.push("Please enter a valid email address.");
    }

    // Password validation
    if (!validate(state.password, "", [validatePassword, validateRequired])) {
        state.errors.password = true;
        state.errorMessages.push("Password should be at least 8 characters in length, have at least one lowercase character, at least one uppercase character, at least one number between 0 and 9 and at least one special character (#?!@$%^&*-).");
    }

    // Confirm password validation
    if (!validate(state.password, state.confirm_password, [validateSamePassword])) {
        state.errors.confirm_password = true;
        state.errorMessages.push("Password confirmation does not match the password.");
    }

    return state.errorMessages.length === 0;
}

async function createUser() {
    if (!validateForm()) {
        $swal.fire({
            title: "Validation Error",
            text: state.errorMessages.join(' '),
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
        return;
    }

    state.loading = true;

    const userData = {
        first_name: state.first_name,
        last_name: state.last_name,
        email: state.email,
        password: state.password,
        user_type: state.user_type,
        is_conversion: state.isConversion
    };

    try {
        const result = await userManagementStore.createUser(userData);
        
        if (result.success) {
            const successMessage = state.isConversion 
                ? `Successfully converted ${state.first_name} ${state.last_name} to a platform user!` 
                : result.message;
            
            $swal.fire({
                title: "Success!",
                text: successMessage,
                icon: "success",
                confirmButtonColor: "#3C8DBC",
            });

            if (import.meta.client) {
                localStorage.setItem('refreshData', 'true');
            }
            
            // Redirect based on conversion type
            if (state.isConversion) {
                router.push(`/admin/enterprise-queries?converted=true&userName=${encodeURIComponent(state.first_name + ' ' + state.last_name)}`);
            } else {
                router.push('/admin/users');
            }
        } else {
            $swal.fire({
                title: "Error!",
                text: result.message,
                icon: "error",
                confirmButtonColor: "#3C8DBC",
            });
        }
    } catch (error) {
        $swal.fire({
            title: "Error!",
            text: "An unexpected error occurred while creating the user.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    } finally {
        state.loading = false;
    }
}

function resetForm() {
    state.first_name = '';
    state.last_name = '';
    state.email = '';
    state.password = '';
    state.confirm_password = '';
    state.user_type = 'normal';
    state.errors = {
        first_name: false,
        last_name: false,
        email: false,
        password: false,
        confirm_password: false,
    };
    state.errorMessages = [];
}
</script>
<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
        />
        <div class="w-5/6">
            <!-- Navigation breadcrumb -->
            <div v-if="state.isConversion" class="ml-4 mr-4 md:ml-10 md:mr-10 mt-5 mb-2">
                <div class="text-sm text-gray-600">
                    <NuxtLink to="/admin/enterprise-queries" class="hover:text-primary-blue-100 underline">Enterprise Inquiries</NuxtLink>
                    <span class="mx-2">→</span>
                    <span class="text-gray-800 font-medium">Convert to User</span>
                </div>
            </div>
            
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md rounded-lg">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div>
                        <div class="font-bold text-2xl">
                            {{ state.isConversion ? 'Convert Enterprise Inquiry' : 'Create New User' }}
                        </div>
                        <div v-if="state.isConversion && state.betaUserData" class="text-sm text-gray-600 mt-1">
                            Converting: {{ state.betaUserData.first_name }} {{ state.betaUserData.last_name }} ({{ state.betaUserData.email }})
                        </div>
                    </div>
                    <NuxtLink 
                        :to="state.isConversion ? '/admin/enterprise-queries' : '/admin/users'"
                        class="text-sm px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 cursor-pointer font-bold shadow-md rounded-lg"
                    >
                        {{ state.isConversion ? 'Back to Enterprise Inquiries' : 'Back to Users' }}
                    </NuxtLink>
                </div>

                <!-- Loading beta user data -->
                <div v-if="state.loadingBetaUser" class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg mb-5">
                    <div class="flex items-center">
                        <spinner class="mr-2" />
                        Loading enterprise inquiry data...
                    </div>
                </div>

                <!-- Conversion info -->
                <div v-if="state.isConversion && state.betaUserData" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg mb-5">
                    <div class="flex items-center">
                        <font-awesome icon="fas fa-info-circle" class="mr-2" />
                        <div>
                            <strong>Converting Enterprise Inquiry:</strong> The form has been pre-populated with data from {{ state.betaUserData.first_name }} {{ state.betaUserData.last_name }}. 
                            You can modify any information before creating the user account.
                            <div class="mt-2 text-sm">
                                <strong>Original Company:</strong> {{ state.betaUserData.company_name || 'Not provided' }} |
                                <strong>Phone:</strong> {{ state.betaUserData.phone_number || 'Not provided' }} |
                                <strong>Country:</strong> {{ state.betaUserData.country || 'Not provided' }}
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="state.errorMessages.length > 0" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-5">
                    <ul class="list-disc list-inside">
                        <li v-for="error in state.errorMessages" :key="error">{{ error }}</li>
                    </ul>
                </div>

                <form @submit.prevent="createUser" class="space-y-6">
                    <!-- Name Fields -->
                    <div class="grid grid-cols-2 gap-4">
                        <BaseFormField label="First Name" required>
                            <BaseInput
                                v-model="state.first_name"
                                placeholder="First Name"
                                :error="state.errors.first_name"
                                :disabled="state.loading"
                                required
                            />
                        </BaseFormField>
                        <BaseFormField label="Last Name" required>
                            <BaseInput
                                v-model="state.last_name"
                                placeholder="Last Name"
                                :error="state.errors.last_name"
                                :disabled="state.loading"
                                required
                            />
                        </BaseFormField>
                    </div>

                    <!-- Email Field -->
                    <BaseFormField label="Email Address" required>
                        <BaseInput
                            v-model="state.email"
                            type="email"
                            placeholder="Email Address"
                            :error="state.errors.email"
                            :disabled="state.loading"
                            required
                        />
                    </BaseFormField>

                    <!-- Password Fields -->
                    <div class="grid grid-cols-2 gap-4">
                        <BaseFormField 
                            label="Password" 
                            required
                            hint="Must be at least 8 characters with uppercase, lowercase, number, and special character"
                        >
                            <BaseInput
                                v-model="state.password"
                                type="password"
                                placeholder="Password"
                                :error="state.errors.password"
                                :disabled="state.loading"
                                :show-password-toggle="true"
                                required
                            />
                        </BaseFormField>
                        <BaseFormField label="Confirm Password" required>
                            <BaseInput
                                v-model="state.confirm_password"
                                type="password"
                                placeholder="Confirm Password"
                                :error="state.errors.confirm_password"
                                :disabled="state.loading"
                                :show-password-toggle="true"
                                required
                            />
                        </BaseFormField>
                    </div>

                    <!-- User Type Field -->
                    <BaseFormField 
                        label="User Type"
                        hint="Administrators have full access to the admin panel"
                    >
                        <BaseSelect
                            v-model="state.user_type"
                            :options="[
                                { value: 'normal', label: 'Normal User' },
                                { value: 'admin', label: 'Administrator' }
                            ]"
                            :disabled="state.loading"
                        />
                    </BaseFormField>

                    <!-- Action Buttons -->
                    <div class="flex flex-wrap gap-4 pt-6 border-t">
                        <button 
                            type="submit"
                            :disabled="state.loading"
                            class="px-6 py-3 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {{ state.loading ? 'Creating User...' : 'Create User' }}
                        </button>
                        
                        <button 
                            type="button"
                            @click="resetForm"
                            :disabled="state.loading"
                            class="px-6 py-3 bg-gray-600 text-white hover:bg-gray-700 cursor-pointer font-bold shadow-md rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Reset Form
                        </button>

                        <NuxtLink 
                            :to="state.isConversion ? '/admin/enterprise-queries' : '/admin/users'"
                            class="px-6 py-3 bg-gray-400 text-white hover:bg-gray-500 cursor-pointer font-bold shadow-md rounded-lg text-center"
                        >
                            Cancel
                        </NuxtLink>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>