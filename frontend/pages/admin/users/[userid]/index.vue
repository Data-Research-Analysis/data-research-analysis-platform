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
    loading: true
});

const userId = computed(() => parseInt(route.params.userid));

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

onMounted(() => {
    loadUser();
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
                                <p><strong>ID:</strong> {{ state.user.id }}</p>
                                <p><strong>Current Type:</strong> 
                                    <span :class="{'text-red-600 font-bold': state.user.user_type === 'admin', 'text-blue-600': state.user.user_type === 'normal'}">
                                        {{ state.user.user_type.toUpperCase() }}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <p><strong>Email Verified:</strong> 
                                    <span :class="{'text-green-600 font-bold': state.user.email_verified_at, 'text-red-600': !state.user.email_verified_at}">
                                        {{ formatDate(state.user.email_verified_at) }}
                                    </span>
                                </p>
                                <p v-if="state.user.unsubscribe_from_emails_at">
                                    <strong>Unsubscribed:</strong> {{ formatDate(state.user.unsubscribe_from_emails_at) }}
                                </p>
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