<script setup>
import { useUserManagementStore } from '@/stores/user_management';
import { validate, validateRequired, validateEmail, validatePassword, validateSamePassword } from '@/composables/Validator';
const { $swal } = useNuxtApp();
const userManagementStore = useUserManagementStore();
const router = useRouter();

const state = reactive({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    user_type: 'normal',
    loading: false,
    errors: {
        first_name: false,
        last_name: false,
        email: false,
        password: false,
        confirm_password: false,
    },
    errorMessages: [],
});

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
        user_type: state.user_type
    };

    try {
        const result = await userManagementStore.createUser(userData);
        
        if (result.success) {
            $swal.fire({
                title: "Success!",
                text: result.message,
                icon: "success",
                confirmButtonColor: "#3C8DBC",
            });
            router.push('/admin/users');
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
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
                <div class="flex flex-row justify-between items-center mb-5">
                    <div class="font-bold text-2xl">
                        Create New User
                    </div>
                    <NuxtLink 
                        to="/admin/users"
                        class="text-sm px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 cursor-pointer font-bold shadow-md rounded"
                    >
                        Back to Users
                    </NuxtLink>
                </div>

                <div v-if="state.errorMessages.length > 0" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-5">
                    <ul class="list-disc list-inside">
                        <li v-for="error in state.errorMessages" :key="error">{{ error }}</li>
                    </ul>
                </div>

                <form @submit.prevent="createUser" class="space-y-6">
                    <!-- Name Fields -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold mb-2">First Name *</label>
                            <input 
                                v-model="state.first_name"
                                type="text"
                                class="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-primary-blue-100"
                                :class="{ 'border-red-500 bg-red-50': state.errors.first_name }"
                                placeholder="First Name"
                                :disabled="state.loading"
                                required
                            />
                        </div>
                        <div>
                            <label class="block text-sm font-bold mb-2">Last Name *</label>
                            <input 
                                v-model="state.last_name"
                                type="text"
                                class="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-primary-blue-100"
                                :class="{ 'border-red-500 bg-red-50': state.errors.last_name }"
                                placeholder="Last Name"
                                :disabled="state.loading"
                                required
                            />
                        </div>
                    </div>

                    <!-- Email Field -->
                    <div>
                        <label class="block text-sm font-bold mb-2">Email Address *</label>
                        <input 
                            v-model="state.email"
                            type="email"
                            class="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-primary-blue-100"
                            :class="{ 'border-red-500 bg-red-50': state.errors.email }"
                            placeholder="Email Address"
                            :disabled="state.loading"
                            required
                        />
                    </div>

                    <!-- Password Fields -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-bold mb-2">Password *</label>
                            <input 
                                v-model="state.password"
                                type="password"
                                class="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-primary-blue-100"
                                :class="{ 'border-red-500 bg-red-50': state.errors.password }"
                                placeholder="Password"
                                :disabled="state.loading"
                                required
                            />
                            <div class="text-xs text-gray-600 mt-1">
                                Must be at least 8 characters with uppercase, lowercase, number, and special character
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-bold mb-2">Confirm Password *</label>
                            <input 
                                v-model="state.confirm_password"
                                type="password"
                                class="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-primary-blue-100"
                                :class="{ 'border-red-500 bg-red-50': state.errors.confirm_password }"
                                placeholder="Confirm Password"
                                :disabled="state.loading"
                                required
                            />
                        </div>
                    </div>

                    <!-- User Type Field -->
                    <div>
                        <label class="block text-sm font-bold mb-2">User Type</label>
                        <select 
                            v-model="state.user_type"
                            class="w-full p-3 border border-gray-300 rounded focus:outline-none focus:border-primary-blue-100"
                            :disabled="state.loading"
                        >
                            <option value="normal">Normal User</option>
                            <option value="admin">Administrator</option>
                        </select>
                        <div class="text-xs text-gray-600 mt-1">
                            Administrators have full access to the admin panel
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex flex-wrap gap-4 pt-6 border-t">
                        <button 
                            type="submit"
                            :disabled="state.loading"
                            class="px-6 py-3 bg-primary-blue-100 text-white hover:bg-primary-blue-300 cursor-pointer font-bold shadow-md rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {{ state.loading ? 'Creating User...' : 'Create User' }}
                        </button>
                        
                        <button 
                            type="button"
                            @click="resetForm"
                            :disabled="state.loading"
                            class="px-6 py-3 bg-gray-600 text-white hover:bg-gray-700 cursor-pointer font-bold shadow-md rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Reset Form
                        </button>

                        <NuxtLink 
                            to="/admin/users"
                            class="px-6 py-3 bg-gray-400 text-white hover:bg-gray-500 cursor-pointer font-bold shadow-md rounded text-center"
                        >
                            Cancel
                        </NuxtLink>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>