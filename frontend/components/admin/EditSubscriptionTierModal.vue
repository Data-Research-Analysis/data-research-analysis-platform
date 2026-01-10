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
</script>

<template>
    <overlay-dialog v-if="show" @close="handleCancel" :yOffset="100">
        <template #overlay>
            <div>
                <!-- Modal Header -->
                <div class="mb-6">
                    <h2 class="text-2xl font-bold text-gray-900">{{ title }}</h2>
                </div>

                <!-- Modal Body -->
                <div>
                    <SubscriptionTierForm
                        :tier="tier"
                        :mode="mode"
                        @submit="handleSubmit"
                        @cancel="handleCancel"
                    />
                </div>
            </div>
        </template>
    </overlay-dialog>
</template>

<style scoped>
.z-15 {
    z-index: 15;
}
</style>
