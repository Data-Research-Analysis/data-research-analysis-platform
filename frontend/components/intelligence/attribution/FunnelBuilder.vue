<script setup lang="ts">
/**
 * FunnelBuilder — Step-by-step wizard for creating a funnel definition.
 *
 * Steps:
 *   1. Name the funnel
 *   2. Add and order funnel stages
 *   3. For each stage, define UTM parameter matching rules
 *   4. Preview and save
 */
import { useFunnelStore } from '@/stores/funnel'

interface Props {
    projectId: number
}

interface Emits {
    (e: 'close'): void
    (e: 'saved', funnelId: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const funnelStore = useFunnelStore()

// ── Wizard state ──
const currentStep = ref(1)
const totalSteps = 4
const isSaving = ref(false)

// ── Form state ──
const funnelName = ref('')
const stages = ref<IFunnelStageForm[]>([
    { id: generateId(), name: 'Awareness', order: 1, matchType: 'all', conditions: [{ id: generateId(), field: 'utm_medium', operator: 'contains', value: 'display' }] },
    { id: generateId(), name: 'Interest', order: 2, matchType: 'all', conditions: [{ id: generateId(), field: 'utm_medium', operator: 'contains', value: 'cpc' }] },
    { id: generateId(), name: 'Consideration', order: 3, matchType: 'all', conditions: [{ id: generateId(), field: 'utm_campaign', operator: 'contains', value: 'lead_gen' }] },
    { id: generateId(), name: 'Intent', order: 4, matchType: 'all', conditions: [{ id: generateId(), field: 'utm_campaign', operator: 'contains', value: 'demo' }] },
    { id: generateId(), name: 'Conversion', order: 5, matchType: 'all', conditions: [{ id: generateId(), field: 'utm_campaign', operator: 'contains', value: 'purchase' }] },
])

function generateId(): string {
    return `funnel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

interface IFunnelCondition {
    id: string
    field: 'utm_source' | 'utm_medium' | 'utm_campaign' | 'utm_term' | 'utm_content'
    operator: 'equals' | 'contains' | 'starts_with' | 'regex'
    value: string
}

interface IFunnelStageForm {
    id: string
    name: string
    order: number
    matchType: 'all' | 'any'
    conditions: IFunnelCondition[]
}

const stageNameErrors = ref<Record<string, string>>({})

// ── Computed ──
const canProceed = computed(() => {
    switch (currentStep.value) {
        case 1: return funnelName.value.trim().length > 0
        case 2: return stages.value.length >= 2
        case 3: return stages.value.every(s => s.conditions.length > 0)
        default: return true
    }
})

const stepTitle = computed(() => {
    switch (currentStep.value) {
        case 1: return 'Name Your Funnel'
        case 2: return 'Add Funnel Stages'
        case 3: return 'Define UTM Matching Rules'
        case 4: return 'Review & Save'
        default: return ''
    }
})

const stepDescription = computed(() => {
    switch (currentStep.value) {
        case 1: return 'Give your funnel a descriptive name that reflects your marketing process'
        case 2: return 'Add the stages users go through, from first touch to conversion'
        case 3: return 'For each stage, set the UTM parameter rules that determine which events match'
        case 4: return 'Review your funnel definition before saving'
        default: return ''
    }
})

// ── Stage management ──
function addStage() {
    const newOrder = stages.value.length + 1
    stages.value.push({
        id: generateId(),
        name: `Stage ${newOrder}`,
        order: newOrder,
        matchType: 'all',
        conditions: [],
    })
}

function removeStage(id: string) {
    if (stages.value.length <= 2) return
    stages.value = stages.value
        .filter(s => s.id !== id)
        .map((s, i) => ({ ...s, order: i + 1 }))
}

function moveStageUp(id: string) {
    const idx = stages.value.findIndex(s => s.id === id)
    if (idx <= 0) return
    const temp = stages.value[idx]
    stages.value[idx] = { ...stages.value[idx - 1], order: idx + 1 }
    stages.value[idx - 1] = { ...temp, order: idx }
}

function moveStageDown(id: string) {
    const idx = stages.value.findIndex(s => s.id === id)
    if (idx >= stages.value.length - 1) return
    const temp = stages.value[idx]
    stages.value[idx] = { ...stages.value[idx + 1], order: idx + 1 }
    stages.value[idx + 1] = { ...temp, order: idx + 2 }
}

function updateStageName(stageId: string, name: string) {
    const stage = stages.value.find(s => s.id === stageId)
    if (stage) {
        stage.name = name
        delete stageNameErrors.value[stageId]
    }
}

// ── Condition management ──
function addCondition(stageId: string) {
    const stage = stages.value.find(s => s.id === stageId)
    if (stage) {
        stage.conditions.push({
            id: generateId(),
            field: 'utm_campaign',
            operator: 'contains',
            value: '',
        })
    }
}

function removeCondition(stageId: string, conditionId: string) {
    const stage = stages.value.find(s => s.id === stageId)
    if (stage) {
        stage.conditions = stage.conditions.filter(c => c.id !== conditionId)
    }
}

// ── Navigation ──
function nextStep() {
    if (!canProceed.value) return
    if (currentStep.value < totalSteps) currentStep.value++
}

function prevStep() {
    if (currentStep.value > 1) currentStep.value--
}

// ── Save ──
async function saveFunnel() {
    if (isSaving.value) return
    isSaving.value = true
    try {
        const funnelData = {
            project_id: props.projectId,
            name: funnelName.value.trim(),
            steps: stages.value.map(s => ({
                name: s.name,
                order: s.order,
                match_type: s.matchType,
                conditions: s.conditions.map(c => ({
                    field: c.field,
                    operator: c.operator,
                    value: c.value,
                })),
            })),
        }
        const result = await funnelStore.createFunnel(props.projectId, funnelData)
        if (result?.id) {
            emit('saved', result.id)
        }
    } finally {
        isSaving.value = false
    }
}

// ── Preview: Estimate matched events from sample data ──
const showPreview = ref(false)
const previewMatches = ref<Record<string, number>>({})
const isPreviewLoading = ref(false)

async function loadPreview() {
    if (stages.value.length === 0) return
    isPreviewLoading.value = true
    try {
        const counts: Record<string, number> = {}
        for (const stage of stages.value) {
            if (stage.conditions.length === 0) continue
            const result = await funnelStore.previewStageMatch(props.projectId, stage)
            counts[stage.id] = result?.estimatedMatches ?? 0
        }
        previewMatches.value = counts
        showPreview.value = true
    } catch {
        // Preview unavailable — non-blocking
    } finally {
        isPreviewLoading.value = false
    }
}

function stageColor(order: number): string {
    const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500']
    return colors[(order - 1) % colors.length]
}

function stageBorderColor(order: number): string {
    const colors = ['border-blue-200', 'border-indigo-200', 'border-purple-200', 'border-amber-200', 'border-emerald-200', 'border-rose-200', 'border-cyan-200']
    return colors[(order - 1) % colors.length]
}

function stageBgColor(order: number): string {
    const colors = ['bg-blue-50', 'bg-indigo-50', 'bg-purple-50', 'bg-amber-50', 'bg-emerald-50', 'bg-rose-50', 'bg-cyan-50']
    return colors[(order - 1) % colors.length]
}
</script>

<template>
    <overlay-dialog @close="emit('close')" :enable-scrolling="true" :y-offset="40">
        <template #overlay>
            <div class="w-full max-w-3xl mx-auto">
                <!-- Header -->
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">Create Funnel</h2>
                        <p class="text-sm text-gray-500 mt-1">Step {{ currentStep }} of {{ totalSteps }}: {{ stepTitle }}</p>
                    </div>
                    <button
                        class="p-2 bg-transparent text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer transition-colors"
                        @click="emit('close')"
                    >
                        <font-awesome-icon :icon="['fas', 'xmark']" class="w-5 h-5" />
                    </button>
                </div>

                <!-- Progress Bar -->
                <div class="flex gap-1 mb-6">
                    <div v-for="i in totalSteps" :key="i" class="flex-1 h-2 rounded-full transition-colors"
                        :class="i <= currentStep ? 'bg-blue-500' : 'bg-gray-200'"></div>
                </div>

                <!-- Step 1: Name -->
                <div v-if="currentStep === 1" class="bg-white border border-gray-200 rounded-xl p-6">
                    <label class="block text-sm font-medium text-gray-700 mb-2">Funnel Name</label>
                    <input
                        v-model="funnelName"
                        type="text"
                        placeholder="e.g., Google Ads Conversion Funnel, Full Marketing Funnel"
                        class="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                        @keyup.enter="nextStep"
                    />
                    <p class="text-xs text-gray-500 mt-2">Choose a name that clearly identifies this funnel's purpose</p>
                </div>

                <!-- Step 2: Stages -->
                <div v-if="currentStep === 2" class="bg-white border border-gray-200 rounded-xl p-6">
                    <div class="flex items-center justify-between mb-4">
                        <p class="text-sm text-gray-500">Add at least 2 stages to define your funnel</p>
                        <button
                            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                            @click="addStage"
                        >
                            <font-awesome-icon :icon="['fas', 'plus']" class="w-3 h-3" />
                            Add Stage
                        </button>
                    </div>

                    <div class="flex flex-col gap-3">
                        <div
                            v-for="(stage, idx) in stages"
                            :key="stage.id"
                            class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                            <div class="flex flex-col gap-0.5">
                                <button
                                    class="w-6 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-30"
                                    :disabled="idx === 0"
                                    @click="moveStageUp(stage.id)"
                                >
                                    <font-awesome-icon :icon="['fas', 'chevron-up']" class="w-2.5 h-2.5" />
                                </button>
                                <button
                                    class="w-6 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer disabled:opacity-30"
                                    :disabled="idx === stages.length - 1"
                                    @click="moveStageDown(stage.id)"
                                >
                                    <font-awesome-icon :icon="['fas', 'chevron-down']" class="w-2.5 h-2.5" />
                                </button>
                            </div>
                            <div class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" :class="stageColor(stage.order)">
                                {{ stage.order }}
                            </div>
                            <input
                                :value="stage.name"
                                @input="updateStageName(stage.id, ($event.target as HTMLInputElement).value)"
                                type="text"
                                class="flex-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                placeholder="Stage name"
                            />
                            <button
                                class="p-1.5 text-red-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-30"
                                :disabled="stages.length <= 2"
                                @click="removeStage(stage.id)"
                            >
                                <font-awesome-icon :icon="['fas', 'trash']" class="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Step 3: UTM Rules -->
                <div v-if="currentStep === 3" class="space-y-4">
                    <div
                        v-for="stage in stages"
                        :key="stage.id"
                        class="bg-white border border-gray-200 rounded-xl p-5"
                    >
                        <div class="flex items-center gap-2 mb-4">
                            <div class="w-5 h-5 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" :class="stageColor(stage.order)">
                                {{ stage.order }}
                            </div>
                            <h3 class="text-sm font-semibold text-gray-800">{{ stage.name }}</h3>
                        </div>

                        <!-- Match Type -->
                        <div class="flex items-center gap-2 mb-4">
                            <span class="text-xs text-gray-500">Match</span>
                            <select
                                v-model="stage.matchType"
                                class="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                                <option value="all">All conditions (AND)</option>
                                <option value="any">Any condition (OR)</option>
                            </select>
                        </div>

                        <!-- Conditions -->
                        <div class="flex flex-col gap-2">
                            <div
                                v-for="condition in stage.conditions"
                                :key="condition.id"
                                class="flex items-center gap-2 flex-wrap"
                            >
                                <select
                                    v-model="condition.field"
                                    class="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                    <option value="utm_source">utm_source</option>
                                    <option value="utm_medium">utm_medium</option>
                                    <option value="utm_campaign">utm_campaign</option>
                                    <option value="utm_term">utm_term</option>
                                    <option value="utm_content">utm_content</option>
                                </select>
                                <select
                                    v-model="condition.operator"
                                    class="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                                >
                                    <option value="equals">equals</option>
                                    <option value="contains">contains</option>
                                    <option value="starts_with">starts with</option>
                                    <option value="regex">regex</option>
                                </select>
                                <input
                                    v-model="condition.value"
                                    type="text"
                                    placeholder="Value"
                                    class="flex-1 min-w-24 px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:border-blue-500"
                                />
                                <button
                                    class="p-1.5 text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                                    @click="removeCondition(stage.id, condition.id)"
                                >
                                    <font-awesome-icon :icon="['fas', 'xmark']" class="w-3 h-3" />
                                </button>
                            </div>

                            <button
                                class="self-start inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                @click="addCondition(stage.id)"
                            >
                                <font-awesome-icon :icon="['fas', 'plus']" class="w-2.5 h-2.5" />
                                Add Condition
                            </button>
                        </div>

                        <!-- Helper text -->
                        <div class="mt-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                            <p class="text-xs text-gray-500">
                                <strong>Tip:</strong> For {{ stage.name.toLowerCase() }}, common patterns include
                                <code class="bg-gray-200 px-1 rounded text-xs">utm_campaign contains {{ stage.name.toLowerCase() }}</code>
                                or
                                <code class="bg-gray-200 px-1 rounded text-xs">utm_medium equals cpc</code>
                            </p>
                        </div>
                    </div>

                    <!-- Preview Button -->
                    <div class="flex justify-center">
                        <button
                            class="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            @click="loadPreview"
                            :disabled="isPreviewLoading"
                        >
                            <font-awesome-icon :icon="['fas', 'eye']" class="w-3.5 h-3.5" />
                            {{ isPreviewLoading ? 'Loading preview...' : 'Preview Estimated Matches' }}
                        </button>
                    </div>

                    <div v-if="showPreview && Object.keys(previewMatches).length > 0" class="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <p class="text-sm font-medium text-emerald-800 mb-2">Estimated Event Matches</p>
                        <div class="flex flex-col gap-1.5">
                            <div v-for="stage in stages" :key="stage.id" class="flex items-center gap-2 text-xs text-emerald-700">
                                <span class="font-medium">{{ stage.name }}:</span>
                                <span>{{ previewMatches[stage.id] ?? '—' }} events</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 4: Review -->
                <div v-if="currentStep === 4" class="bg-white border border-gray-200 rounded-xl p-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-2">{{ funnelName }}</h3>
                    <p class="text-sm text-gray-500 mb-6">{{ stages.length }} stages defined</p>

                    <div class="flex flex-col gap-3">
                        <div
                            v-for="(stage, idx) in stages"
                            :key="stage.id"
                            class="flex items-start gap-3 p-3 rounded-lg border" :class="stageBorderColor(stage.order), stageBgColor(stage.order)"
                        >
                            <div class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" :class="stageColor(stage.order)">
                                {{ stage.order }}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-800">{{ stage.name }}</p>
                                <div v-if="stage.conditions.length > 0" class="mt-1 flex flex-wrap gap-1">
                                    <span
                                        v-for="condition in stage.conditions"
                                        :key="condition.id"
                                        class="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-xs text-gray-600"
                                    >
                                        <code class="text-xs text-gray-500">{{ condition.field }}</code>
                                        <span class="text-gray-400">{{ condition.operator === 'equals' ? '=' : condition.operator === 'contains' ? '~' : condition.operator === 'starts_with' ? '^' : 'regex' }}</span>
                                        <span class="font-medium text-gray-700">{{ condition.value }}</span>
                                    </span>
                                </div>
                                <p v-else class="text-xs text-gray-400 mt-1">No matching conditions defined</p>
                            </div>
                            <div class="text-xs text-gray-500 shrink-0 mt-1">
                                <span v-if="stage.matchType === 'all'" class="text-gray-400">AND</span>
                                <span v-else class="text-amber-600">OR</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                        <font-awesome-icon :icon="['fas', 'diagram-project']" class="w-4 h-4 text-gray-400" />
                        <p class="text-xs text-gray-600">
                            This funnel will match attribution events against each stage's UTM rules sequentially.
                            Users who match Stage 1 are counted, then those who also match Stage 2, etc.
                        </p>
                    </div>
                </div>

                <!-- Footer Navigation -->
                <div class="flex items-center justify-between mt-6">
                    <button
                        v-if="currentStep > 1"
                        class="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        @click="prevStep"
                    >
                        <font-awesome-icon :icon="['fas', 'arrow-left']" class="w-3.5 h-3.5" />
                        Back
                    </button>
                    <div v-else></div>

                    <div class="flex gap-2">
                        <button
                            class="px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                            @click="emit('close')"
                        >
                            Cancel
                        </button>
                        <button
                            v-if="currentStep < totalSteps"
                            class="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            :disabled="!canProceed"
                            @click="nextStep"
                        >
                            Continue
                            <font-awesome-icon :icon="['fas', 'arrow-right']" class="w-3.5 h-3.5" />
                        </button>
                        <button
                            v-else
                            class="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
                            :disabled="isSaving"
                            @click="saveFunnel"
                        >
                            <font-awesome-icon :icon="['fas', 'floppy-disk']" class="w-3.5 h-3.5" />
                            {{ isSaving ? 'Saving...' : 'Save Funnel' }}
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </overlay-dialog>
</template>
