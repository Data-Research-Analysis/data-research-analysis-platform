<script setup>
import { useUserManagementStore } from '@/stores/user_management';
const { $swal } = useNuxtApp();
const userManagementStore = useUserManagementStore();
const route = useRoute();
const router = useRouter();

const state = reactive({
    user: null,
    editing: {
        first_name: '',
        last_name: '',
        email: '',
        user_type: 'normal'
    },
    subscription: {
        current: null,
        availableTiers: [],
        selectedTierId: null,
        endsAt: '',
        loading: false,
    },
    loading: true
});

const userId = computed(() => parseInt(route.params.userid));

async function loadUserSubscription() {
    state.subscription.loading = true;
    try {
        const [currentSubscription, availableTiers] = await Promise.all([
            userManagementStore.fetchUserSubscription(userId.value),
            userManagementStore.getAvailableTiers(userId.value)
        ]);
        console.log('Current Subscription:', currentSubscription);
        console.log('Available Tiers:', availableTiers);
        state.subscription.current = currentSubscription;
        state.subscription.availableTiers = availableTiers;
        if (currentSubscription) {
            state.subscription.selectedTierId = currentSubscription.subscription_tier.id;
            if (currentSubscription.ends_at) {
                state.subscription.endsAt = new Date(currentSubscription.ends_at).toISOString().split('T')[0];
            }
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
    } finally {
        state.subscription.loading = false;
    }
}

async function updateSubscription() {
    if (!state.subscription.selectedTierId) {
        $swal.fire({
            title: "Validation Error",
            text: "Please select a subscription tier.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
        return;
    }

    const result = await userManagementStore.updateUserSubscription(
        userId.value,
        state.subscription.selectedTierId,
        state.subscription.endsAt || undefined
    );

    if (result.success) {
        $swal.fire({
            title: "Success!",
            text: "Subscription updated successfully.",
            icon: "success",
            confirmButtonColor: "#3C8DBC",
        });
        await loadUserSubscription();
    } else {
        $swal.fire({
            title: "Error!",
            text: result.message || "Failed to update subscription.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

function getTierBadgeClass(tierName) {
    if (!tierName) return 'bg-gray-100 text-gray-700';
    const name = tierName.toUpperCase();
    if (name === 'FREE') return 'bg-gray-100 text-gray-700';
    if (name === 'PRO') return 'bg-blue-100 text-blue-700';
    if (name === 'TEAM') return 'bg-green-100 text-green-700';
    if (name === 'BUSINESS') return 'bg-purple-100 text-purple-700';
    if (name === 'ENTERPRISE') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-700';
}

async function loadUser() {
    state.loading = true;
    try {
        const user = await userManagementStore.retrieveUserById(userId.value);
        if (user) {
            state.user = user;
            state.editing = {
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                user_type: user.user_type
            };
        } else {
            $swal.fire({
                title: "User Not Found",
                text: "The requested user could not be found.",
                icon: "error",
                confirmButtonColor: "#3C8DBC",
            });
            router.push('/admin/users');
        }
    } catch (error) {
        $swal.fire({
            title: "Error",
            text: "Failed to load user information.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    } finally {
        state.loading = false;
    }
}

async function saveChanges() {
    if (!state.editing.first_name || !state.editing.last_name || !state.editing.email) {
        $swal.fire({
            title: "Validation Error",
            text: "All fields are required.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
        return;
    }

    const success = await userManagementStore.updateUser(userId.value, state.editing);
    if (success) {
        $swal.fire({
            title: "Success!",
            text: "User information updated successfully.",
            icon: "success",
            confirmButtonColor: "#3C8DBC",
        });
        router.push('/admin/users');
    } else {
        $swal.fire({
            title: "Error!",
            text: "Failed to update user information.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

async function deleteUser() {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete this user?",
        text: "You won't be able to revert this! All user data will be permanently removed.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    if (!confirmDelete) {
        return;
    }

    const success = await userManagementStore.deleteUser(userId.value);
    if (success) {
        $swal.fire({
            title: "Deleted!",
            text: "The user has been deleted successfully.",
            icon: "success",
            confirmButtonColor: "#3C8DBC",
        });
        router.push('/admin/users');
    } else {
        $swal.fire({
            title: "Error!",
            text: "There was an error deleting the user.",
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Not verified';
    return new Date(dateString).toLocaleDateString();
}

onMounted(async () => {
    await loadUser();
    await loadUserSubscription();
});
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
                        Edit User
                    </div>
                    <NuxtLink 
                        to="/admin/users"
                        class="text-sm px-4 py-2 bg-gray-600 text-white hover:bg-gray-700 cursor-pointer font-bold shadow-md rounded"
                    >
                        Back to Users
                    </NuxtLink>
                </div>

                <div v-if="state.loading" class="text-center text-gray-500 text-xl mt-20">
                    Loading user information...
                </div>

                <div v-else-if="state.user" class="space-y-6">
                    <!-- User Info Section -->
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="font-bold text-lg mb-3">User Information</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p>
                                    <strong>ID:</strong> {{ state.user.id }}
                                </p>
                                <p>
                                    <strong>Current Type:</strong> 
                                    <span class="ml-2" :class="{'text-red-600 font-bold': state.user.user_type === 'admin', 'text-blue-600': state.user.user_type === 'normal'}">
                                        {{ state.user.user_type.toUpperCase() }}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <p>
                                    <strong>Email Verified:</strong> 
                                    <span class="ml-2" :class="{'text-green-600 font-bold': state.user.email_verified_at, 'text-red-600': !state.user.email_verified_at}">
                                        {{ formatDate(state.user.email_verified_at) }}
                                    </span>
                                </p>
                                <p v-if="state.user.unsubscribe_from_emails_at">
                                    <strong>Unsubscribed:</strong> {{ formatDate(state.user.unsubscribe_from_emails_at) }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Subscription Management Section -->
                    <div class="bg-blue-50 p-6 rounded-lg border border-blue-200">
                        <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
                            <font-awesome icon="fas fa-crown" class="text-yellow-500" />
                            Subscription Management
                        </h3>
                        
                        <div v-if="state.subscription.loading" class="text-center text-gray-500">
                            Loading subscription information...
                        </div>

                        <div v-else class="space-y-4">
                            <!-- Current Subscription Display -->
                            <div class="bg-white p-4 rounded-lg border border-gray-200">
                                <p class="text-sm font-bold mb-2">Current Subscription:</p>
                                <div v-if="state.subscription.current" class="space-y-2">
                                    <div>
                                        <span :class="['px-3 py-1.5 rounded-lg text-sm font-bold inline-block', getTierBadgeClass(state.subscription.current.subscription_tier?.tier_name)]">
                                            {{ state.subscription.current.subscription_tier?.tier_name?.toUpperCase() || 'UNKNOWN' }}
                                        </span>
                                    </div>
                                    <div class="text-sm text-gray-600">
                                        <p><strong>Started:</strong> {{ new Date(state.subscription.current.started_at).toLocaleDateString() }}</p>
                                        <p v-if="state.subscription.current.ends_at">
                                            <strong>Ends:</strong> {{ new Date(state.subscription.current.ends_at).toLocaleDateString() }}
                                        </p>
                                        <p v-else class="text-green-600 font-medium">
                                            <strong>Status:</strong> Active (No expiration)
                                        </p>
                                        <p v-if="state.subscription.current.cancelled_at" class="text-red-600 font-medium">
                                            <strong>Cancelled:</strong> {{ new Date(state.subscription.current.cancelled_at).toLocaleDateString() }}
                                        </p>
                                    </div>
                                </div>
                                <div v-else class="text-gray-500 italic">
                                    No active subscription assigned
                                </div>
                            </div>

                            <!-- Update Subscription Form -->
                            <div class="space-y-3">
                                <!-- Debug Info -->
                                <div v-if="state.subscription.availableTiers.length === 0" class="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800">
                                    <strong>Debug:</strong> No subscription tiers available. Available tiers count: {{ state.subscription.availableTiers.length }}
                                </div>
                                
                                <div>
                                    <label class="block text-sm font-bold mb-2">Select Subscription Tier</label>
                                    <select 
                                        v-model="state.subscription.selectedTierId"
                                        class="w-full p-2 border border-gray-300 rounded"
                                    >
                                        <option :value="null" disabled>Select a tier...</option>
                                        <option 
                                            v-for="tier in state.subscription.availableTiers" 
                                            :key="tier.id" 
                                            :value="tier.id"
                                        >
                                            {{ tier.tier_name?.toUpperCase() }} - {{ tier.price_per_month_usd == 0 ? 'Free' : `$${tier.price_per_month_usd}/month` }}
                                        </option>
                                    </select>
                                    <p class="text-xs text-gray-500 mt-1">{{ state.subscription.availableTiers.length }} tier(s) available</p>
                                </div>

                                <div>
                                    <label class="block text-sm font-bold mb-2">
                                        Expiration Date (Optional)
                                        <span class="text-xs font-normal text-gray-500 ml-2">Leave empty for no expiration</span>
                                    </label>
                                    <input 
                                        v-model="state.subscription.endsAt"
                                        type="date"
                                        class="w-full p-2 border border-gray-300 rounded"
                                    />
                                </div>

                                <button 
                                    @click="updateSubscription"
                                    class="w-full px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 cursor-pointer font-bold shadow-md rounded flex items-center justify-center gap-2"
                                >
                                    <font-awesome icon="fas fa-save" />
                                    Update Subscription
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Edit Form -->
                    <div class="space-y-4">
                        <h3 class="font-bold text-lg">Edit User Details</h3>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold mb-2">First Name</label>
                                <input 
                                    v-model="state.editing.first_name"
                                    type="text"
                                    class="w-full p-2 border border-gray-300 rounded"
                                    placeholder="First Name"
                                    required
                                />
                            </div>
                            <div>
                                <label class="block text-sm font-bold mb-2">Last Name</label>
                                <input 
                                    v-model="state.editing.last_name"
                                    type="text"
                                    class="w-full p-2 border border-gray-300 rounded"
                                    placeholder="Last Name"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-bold mb-2">Email</label>
                            <input 
                                v-model="state.editing.email"
                                type="email"
                                class="w-full p-2 border border-gray-300 rounded"
                                placeholder="Email Address"
                                required
                            />
                        </div>

                        <div>
                            <label class="block text-sm font-bold mb-2">User Type</label>
                            <select 
                                v-model="state.editing.user_type"
                                class="w-full p-2 border border-gray-300 rounded"
                            >
                                <option value="normal">Normal User</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex flex-wrap gap-4 pt-4 border-t">
                        <button 
                            @click="saveChanges"
                            class="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 cursor-pointer font-bold shadow-md rounded"
                        >
                            Save Changes
                        </button>
                        
                        <button 
                            @click="deleteUser"
                            class="px-6 py-2 bg-red-600 text-white hover:bg-red-700 cursor-pointer font-bold shadow-md rounded"
                        >
                            Delete User
                        </button>
                    </div>
                </div>

                <div v-else class="text-center text-gray-500 text-xl mt-20">
                    User not found
                </div>
            </div>
        </div>
    </div>
</template>