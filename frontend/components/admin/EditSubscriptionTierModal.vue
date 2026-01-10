<script setup>
import { useSubscriptionTiersStore } from '@/stores/admin/subscription-tiers';

const props = defineProps({
    tier: {
        type: Object,
        default: null,
    },
    show: {
        type: Boolean,
        default: false,
    },
});

const emit = defineEmits(['close', 'success']);
const { $swal } = useNuxtApp();
const tiersStore = useSubscriptionTiersStore();

const mode = computed(() => props.tier ? 'edit' : 'create');
const title = computed(() => props.tier ? 'Edit Subscription Tier' : 'Create New Subscription Tier');

async function handleSubmit(formData) {
    try {
        if (props.tier) {
            // Update existing tier
            await tiersStore.updateTier(props.tier.id, formData);
            $swal.fire({
                title: "Success!",
                text: "Subscription tier updated successfully.",
                icon: "success",
                confirmButtonColor: "#3C8DBC",
            });
        } else {
            // Create new tier
            await tiersStore.createTier(formData);
            $swal.fire({
                title: "Success!",
                text: "Subscription tier created successfully.",
                icon: "success",
                confirmButtonColor: "#3C8DBC",
            });
        }
        emit('success');
        emit('close');
    } catch (error) {
        $swal.fire({
            title: "Error!",
            text: error.message || `Failed to ${mode.value} subscription tier.`,
            icon: "error",
            confirmButtonColor: "#3C8DBC",
        });
    }
}

function handleCancel() {
    emit('close');
}

function handleClickOutside(event) {
    if (event.target === event.currentTarget) {
        emit('close');
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition name="modal">
            <div
                v-if="show"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
                @click="handleClickOutside"
            >
                <div
                    class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
                    @click.stop
                >
                    <!-- Modal Header -->
                    <div class="flex justify-between items-center p-6 border-b border-gray-200">
                        <h2 class="text-xl font-bold text-gray-900">{{ title }}</h2>
                        <button
                            @click="handleCancel"
                            class="text-gray-400 hover:text-gray-600"
                        >
                            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <!-- Modal Body -->
                    <div class="p-6">
                        <SubscriptionTierForm
                            :tier="tier"
                            :mode="mode"
                            @submit="handleSubmit"
                            @cancel="handleCancel"
                        />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
    transition: transform 0.3s ease;
}

.modal-enter-from .bg-white,
.modal-leave-to .bg-white {
    transform: scale(0.9);
}
</style>
