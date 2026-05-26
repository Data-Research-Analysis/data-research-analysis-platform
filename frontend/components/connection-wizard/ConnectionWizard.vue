<template>
    <div class="connection-wizard">
        <!-- Wizard Header with Progress -->
        <div class="connection-wizard__header">
            <h1 class="connection-wizard__wizard-title">Smart Connection Wizard</h1>
            <div class="connection-wizard__progress">
                <div
                    v-for="(step, index) in steps"
                    :key="step.id"
                    class="connection-wizard__step"
                    :class="{
                        'connection-wizard__step--active': currentStep === index,
                        'connection-wizard__step--completed': currentStep > index,
                        'connection-wizard__step--upcoming': currentStep < index,
                    }"
                >
                    <div class="connection-wizard__step-indicator">
                        <i
                            v-if="currentStep > index"
                            class="fas fa-check"
                        ></i>
                        <span v-else>{{ index + 1 }}</span>
                    </div>
                    <span class="connection-wizard__step-label">{{ step.label }}</span>
                </div>
                <div class="connection-wizard__progress-line">
                    <div
                        class="connection-wizard__progress-fill"
                        :style="{ width: `${(currentStep / (steps.length - 1)) * 100}%` }"
                    ></div>
                </div>
            </div>
        </div>

        <!-- Step Content -->
        <div class="connection-wizard__content">
            <!-- Step 1: Source Selection -->
            <SourceSelectionStep
                v-if="currentStep === 0"
                v-model="selectedSourceIds"
                @next="goToStep(1)"
            />

            <!-- Step 2: Placeholder (CONN-002) -->
            <div v-else-if="currentStep === 1" class="connection-wizard__placeholder">
                <i class="fas fa-lock"></i>
                <h2>Authentication</h2>
                <p>Step 2 — Authentication & Connection (Coming in CONN-002)</p>
                <p class="connection-wizard__placeholder-selected">
                    Selected sources: {{ selectedSourceIds.join(', ') }}
                </p>
            </div>

            <!-- Step 3: Placeholder (CONN-003) -->
            <div v-else-if="currentStep === 2" class="connection-wizard__placeholder">
                <i class="fas fa-lock"></i>
                <h2>Confirmation & Auto-Setup</h2>
                <p>Step 3 — Confirmation (Coming in CONN-003)</p>
            </div>
        </div>

        <!-- Bottom Navigation (shown for steps 2 & 3) -->
        <div
            v-if="currentStep > 0"
            class="connection-wizard__nav"
        >
            <button
                class="connection-wizard__nav-btn connection-wizard__nav-btn--back"
                @click="goToStep(currentStep - 1)"
            >
                <i class="fas fa-arrow-left"></i>
                Back
            </button>
            <button
                v-if="currentStep < steps.length - 1"
                class="connection-wizard__nav-btn connection-wizard__nav-btn--next"
                @click="goToStep(currentStep + 1)"
            >
                Next
                <i class="fas fa-arrow-right"></i>
            </button>
            <button
                v-else
                class="connection-wizard__nav-btn connection-wizard__nav-btn--finish"
            >
                Connect & Analyze
                <i class="fas fa-rocket"></i>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import SourceSelectionStep from './SourceSelectionStep.vue';

const steps = [
    { id: 'select', label: 'Select Sources' },
    { id: 'connect', label: 'Connect' },
    { id: 'confirm', label: 'Confirm' },
];

const currentStep = ref(0);
const selectedSourceIds = ref<string[]>([]);

function goToStep(step: number) {
    if (step >= 0 && step < steps.length) {
        currentStep.value = step;
    }
}

// Sync step with URL query param for deep linking
const route = useRoute();
const router = useRouter();

// Initialize step from URL
if (route.query.step) {
    const urlStep = parseInt(route.query.step as string, 10);
    if (!isNaN(urlStep) && urlStep >= 0 && urlStep < steps.length) {
        currentStep.value = urlStep;
    }
}

// Update URL when step changes
watch(currentStep, (newStep) => {
    router.replace({
        query: { ...route.query, step: String(newStep) },
    });
});
</script>

<style scoped>
.connection-wizard {
    max-width: 1080px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
    min-height: 100vh;
}

/* Header */
.connection-wizard__header {
    margin-bottom: 2rem;
    text-align: center;
}

.connection-wizard__wizard-title {
    margin: 0 0 1.5rem;
    font-size: 1.75rem;
    font-weight: 700;
    color: #111827;
}

/* Progress Bar */
.connection-wizard__progress {
    position: relative;
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 480px;
    margin: 0 auto;
    padding: 0 1rem;
}

.connection-wizard__progress-line {
    position: absolute;
    top: 50%;
    left: 2rem;
    right: 2rem;
    height: 3px;
    background: #e5e7eb;
    border-radius: 2px;
    transform: translateY(-50%);
    z-index: 0;
}

.connection-wizard__progress-fill {
    height: 100%;
    background: #6366f1;
    border-radius: 2px;
    transition: width 0.4s ease;
}

.connection-wizard__step {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
}

.connection-wizard__step-indicator {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 600;
    background: #e5e7eb;
    color: #9ca3af;
    transition: all 0.3s ease;
}

.connection-wizard__step--active .connection-wizard__step-indicator {
    background: #6366f1;
    color: #ffffff;
    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
}

.connection-wizard__step--completed .connection-wizard__step-indicator {
    background: #10b981;
    color: #ffffff;
}

.connection-wizard__step-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: #9ca3af;
    white-space: nowrap;
}

.connection-wizard__step--active .connection-wizard__step-label {
    color: #6366f1;
    font-weight: 600;
}

.connection-wizard__step--completed .connection-wizard__step-label {
    color: #10b981;
}

/* Content */
.connection-wizard__content {
    min-height: 400px;
}

/* Placeholder (for steps 2 & 3 not yet implemented) */
.connection-wizard__placeholder {
    text-align: center;
    padding: 4rem 2rem;
    color: #6b7280;
}

.connection-wizard__placeholder i {
    font-size: 3rem;
    margin-bottom: 1rem;
    display: block;
    color: #d1d5db;
}

.connection-wizard__placeholder h2 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    color: #374151;
}

.connection-wizard__placeholder p {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
}

.connection-wizard__placeholder-selected {
    margin-top: 1rem;
    padding: 0.75rem 1rem;
    background: #f3f4f6;
    border-radius: 0.5rem;
    font-size: 0.85rem;
    color: #374151;
    display: inline-block;
}

/* Bottom Navigation */
.connection-wizard__nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
}

.connection-wizard__nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
}

.connection-wizard__nav-btn--back {
    background: #f3f4f6;
    color: #374151;
}

.connection-wizard__nav-btn--back:hover {
    background: #e5e7eb;
}

.connection-wizard__nav-btn--next {
    background: #6366f1;
    color: #ffffff;
}

.connection-wizard__nav-btn--next:hover {
    background: #4f46e5;
}

.connection-wizard__nav-btn--finish {
    background: #10b981;
    color: #ffffff;
}

.connection-wizard__nav-btn--finish:hover {
    background: #059669;
}

/* Responsive */
@media (max-width: 639px) {
    .connection-wizard {
        padding: 1rem;
    }

    .connection-wizard__wizard-title {
        font-size: 1.25rem;
    }

    .connection-wizard__step-label {
        font-size: 0.65rem;
    }

    .connection-wizard__nav-btn {
        padding: 0.65rem 1rem;
        font-size: 0.85rem;
    }
}
</style>