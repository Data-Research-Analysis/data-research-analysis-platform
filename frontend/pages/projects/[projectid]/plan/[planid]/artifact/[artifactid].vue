<script setup lang="ts">
import { usePaidMediaPlansStore } from '@/stores/paid_media_plans';

definePageMeta({ layout: 'project' });

const route = useRoute();
const projectId = computed(() => parseInt(String(route.params.projectid), 10));
const planId = computed(() => parseInt(String(route.params.planid), 10));
const artifactId = computed(() => parseInt(String(route.params.artifactid), 10));

const store = usePaidMediaPlansStore();

const artifact = ref<any>(null);
const editMode = ref(false);
const editContent = ref('');
const isSaving = ref(false);

onMounted(async () => {
    await store.fetchPlan(planId.value);
    const token = getAuthToken();
    const response = await $fetch<any>(`${baseUrl()}/plans/${planId.value}/artifacts/${artifactId.value}`, {
        headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
    });
    artifact.value = response?.data ?? response;
    editContent.value = artifact.value?.content ?? '';
});

function startEdit() {
    editMode.value = true;
    editContent.value = artifact.value?.content ?? '';
}

async function saveEdit() {
    isSaving.value = true;
    try {
        await store.editArtifact(planId.value, artifactId.value, editContent.value);
        editMode.value = false;
        await store.fetchPlan(planId.value);
        const token = getAuthToken();
        const response = await $fetch<any>(`${baseUrl()}/plans/${planId.value}/artifacts/${artifactId.value}`, {
            headers: { Authorization: `Bearer ${token}`, 'Authorization-Type': 'auth' },
        });
        artifact.value = response?.data ?? response;
    } finally {
        isSaving.value = false;
    }
}
</script>

<template>
    <div class="p-6 max-w-4xl mx-auto">
        <div v-if="artifact" class="bg-white border border-gray-200 rounded-2xl">
            <div class="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100">
                <div>
                    <NuxtLink :to="`/projects/${projectId}/plan/${planId}`" class="text-sm text-gray-500 hover:text-primary-blue-100">
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-1" /> Back to plan
                    </NuxtLink>
                    <h1 class="text-xl font-semibold text-gray-800 mt-1">{{ artifact.title }}</h1>
                    <p class="text-xs text-gray-500 mt-0.5">
                        {{ artifact.artifactKey }} ·
                        {{ artifact.kind === 'markdown' && String(artifact.artifactKey).includes('checklist') ? 'pdf + excel' : (artifact.kind === 'markdown' ? 'pdf' : artifact.kind) }} ·
                        v{{ artifact.version }} ·
                        {{ artifact.source === 'user_edited' ? 'you edited' : 'generated' }}
                    </p>
                </div>
                <div class="flex gap-2">
                    <button v-if="!editMode && ['markdown', 'json', 'csv', 'html'].includes(artifact.kind)" type="button"
                        class="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50" @click="startEdit">
                        Edit
                    </button>
                </div>
            </div>
            <div class="p-6">
                <div v-if="editMode" class="space-y-3">
                    <textarea v-model="editContent" rows="20" class="w-full px-3 py-2 rounded-lg border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-blue-100" />
                    <div class="flex gap-2">
                        <button type="button" class="px-4 py-2 rounded-lg bg-primary-blue-100 text-white text-sm disabled:opacity-50" :disabled="isSaving" @click="saveEdit">
                            {{ isSaving ? 'Saving...' : 'Save new version' }}
                        </button>
                        <button type="button" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm" @click="editMode = false">Cancel</button>
                    </div>
                </div>
                <PlanArtifactViewer v-else :artifact="artifact" />
            </div>
        </div>
        <div v-else class="flex items-center justify-center py-20">
            <font-awesome-icon :icon="['fas', 'spinner']" class="animate-spin text-3xl text-primary-blue-100" />
        </div>
    </div>
</template>
