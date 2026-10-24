import { defineStore } from 'pinia';
import { getAuthToken } from '~/composables/AuthToken';
import { useAppFetch } from '~/composables/useAppFetch';
import { baseUrl } from '~/composables/Utils';

export interface IPlanSummary {
    id: number;
    projectId: number;
    name: string;
    slug: string;
    mode: 'basic' | 'advanced';
    status: 'draft' | 'running' | 'paused' | 'completed' | 'failed' | 'archived';
    funnelCoverage: string;
    buildMode: string;
    platforms: string[];
    markets: string[];
    budgetTotal: number | null;
    currency: string;
    currentStep: number;
    completedStepCount: number;
    stepCount: number;
    artifactCount: number;
    updatedAt: string;
}

export interface IPlanStep {
    id: number;
    planId: number;
    stepNumber: number;
    stepKey: string;
    title: string;
    phase: string;
    status: 'pending' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'skipped';
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
    attempts: number;
    error: string | null;
    outputSummary: string | null;
    gate: IPlanGate | null;
    runMeta: Record<string, any> | null;
}

export interface IPlanGate {
    id: string;
    stepKey: string;
    question: string;
    options?: Array<{ label: string; value: string }> | null;
    purpose?: 'info' | 'confirm';
    answered?: boolean;
    answer?: string | null;
    answeredAt?: string | null;
}

export interface IPlanMessage {
    id: number;
    planId: number;
    stepId: number | null;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    metadata: Record<string, any> | null;
    createdAt: string;
}

export interface IPlanEvent {
    id: number;
    planId: number;
    stepId: number | null;
    eventType: string;
    severity: 'info' | 'warn' | 'error';
    message: string;
    data: Record<string, any> | null;
    createdAt: string;
}

export interface IPlanArtifact {
    id: number;
    planId: number;
    stepId: number | null;
    artifactKey: string;
    title: string;
    kind: 'markdown' | 'json' | 'csv' | 'xlsx' | 'pptx' | 'html' | 'image';
    mimeType: string;
    content: string | null;
    storageKey: string | null;
    byteSize: number;
    version: number;
    isCurrent: boolean;
    source: 'ai' | 'user_edited' | 'uploaded';
    metadata: Record<string, any> | null;
    createdAt: string;
    updatedAt: string;
}

export const usePaidMediaPlansStore = defineStore('paidMediaPlans', () => {
    const plans = ref<IPlanSummary[]>([]);
    const currentPlan = ref<any>(null);
    const steps = ref<IPlanStep[]>([]);
    const messages = ref<IPlanMessage[]>([]);
    const events = ref<IPlanEvent[]>([]);
    const artifacts = ref<IPlanArtifact[]>([]);
    const isLoading = ref(false);
    const isCreating = ref(false);
    const error = ref<string | null>(null);
    const streamingText = ref('');
    const lastMessageId = ref(0);

    const completedStepCount = computed(() => steps.value.filter((s) => s.status === 'completed').length);
    const runningStep = computed(() => steps.value.find((s) => s.status === 'running') ?? null);
    const waitingStep = computed(() => steps.value.find((s) => s.status === 'waiting_for_input') ?? null);
    const nextPendingStep = computed(() => steps.value.find((s) => s.status === 'pending') ?? null);

    function headers() {
        const { getOrgHeaders } = useOrganizationContext();
        return {
            Authorization: `Bearer ${getAuthToken()}`,
            'Authorization-Type': 'auth' as const,
            'Content-Type': 'application/json',
            ...getOrgHeaders(),
        };
    }

    const GUEST_TOKEN_STORAGE_KEY = 'dra_guest_plan_token';

    function guestHeaders(token: string) {
        return {
            'Content-Type': 'application/json',
            'X-Guest-Token': token,
        };
    }

    function setGuestToken(token: string | null) {
        if (import.meta.client) {
            if (token) localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
            else localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
        }
    }

    function getStoredGuestToken(): string | null {
        if (!import.meta.client) return null;
        return localStorage.getItem(GUEST_TOKEN_STORAGE_KEY);
    }

    // ===== Guest (lead-in) plan flows =====

    async function createGuestPlan(payload: Record<string, any>) {
        isCreating.value = true;
        error.value = null;
        try {
            const response = await useAppFetch<any>(`${baseUrl()}/guest/plans`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
            });
            const plan = (response?.data ?? response) as any;
            if (plan?.guestToken) setGuestToken(plan.guestToken);
            currentPlan.value = plan;
            steps.value = (plan.steps ?? []) as IPlanStep[];
            return plan;
        } catch (e: any) {
            error.value = e?.data?.error ?? 'Failed to create guest plan';
            throw e;
        } finally {
            isCreating.value = false;
        }
    }

    async function fetchGuestPlan(token: string) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            const plan = (response?.data ?? response) as any;
            currentPlan.value = plan;
            steps.value = (plan.steps ?? []) as IPlanStep[];
            messages.value = await fetchGuestMessages(token, 0);
            artifacts.value = await fetchGuestArtifacts(token);
            events.value = await fetchGuestEvents(token, 0);
            lastMessageId.value = messages.value.length ? messages.value[messages.value.length - 1].id : 0;
            return plan;
        } catch (e: any) {
            error.value = e?.data?.error ?? 'Failed to load guest plan';
            throw e;
        } finally {
            isLoading.value = false;
        }
    }

    async function refreshGuestPlanState(token: string) {
        const response = await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        const plan = (response?.data ?? response) as any;
        if (!plan?.id) return;
        currentPlan.value = plan;
        steps.value = (plan.steps ?? []) as IPlanStep[];
        try {
            artifacts.value = await fetchGuestArtifacts(token);
            events.value = await fetchGuestEvents(token, 0);
        } catch {
            // keep the last known state if the auxiliary fetch fails
        }
    }

    async function startGuestPlan(token: string) {
        return await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
    }

    async function runGuestStep(token: string, stepKey: string) {
        return await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/steps/${stepKey}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { trigger: 'user' },
        });
    }

    async function sendGuestMessage(token: string, payload: Record<string, any>) {
        await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
        });
        await refreshGuestMessages(token);
    }

    async function answerGuestGate(token: string, gateId: string, answer: string) {
        await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { gateId, answer },
        });
        await refreshGuestMessages(token);
    }

    async function refreshGuestMessages(token: string) {
        messages.value = await fetchGuestMessages(token, 0);
        lastMessageId.value = messages.value.length ? messages.value[messages.value.length - 1].id : 0;
    }

    async function fetchGuestMessages(token: string, since: number): Promise<IPlanMessage[]> {
        const response = await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/messages?since=${since}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        return (response?.data ?? response ?? []) as IPlanMessage[];
    }

    async function fetchGuestEvents(token: string, since: number): Promise<IPlanEvent[]> {
        const response = await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/events?since=${since}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        return (response?.data ?? response ?? []) as IPlanEvent[];
    }

    async function fetchGuestArtifacts(token: string): Promise<IPlanArtifact[]> {
        const response = await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/artifacts?currentOnly=true`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });
        return (response?.data ?? response ?? []) as IPlanArtifact[];
    }

    async function claimGuestPlan(token: string) {
        const response = await useAppFetch<any>(`${baseUrl()}/guest/plans/${token}/claim`, {
            method: 'POST',
            headers: headers(),
        });
        setGuestToken(null);
        return response?.data ?? response;
    }

    async function fetchPlans(projectId: number) {
        isLoading.value = true;
        error.value = null;
        try {
            await useOrganizationContext().ensureWorkspaceContext();
            const response = await useAppFetch<any>(`${baseUrl()}/plans?projectId=${projectId}`, {
                method: 'GET',
                headers: headers(),
            });
            plans.value = (response?.data ?? response ?? []) as IPlanSummary[];
        } catch (e: any) {
            error.value = e?.data?.error ?? 'Failed to load plans';
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchPlan(planId: number) {
        isLoading.value = true;
        error.value = null;
        try {
            await useOrganizationContext().ensureWorkspaceContext();
            const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}`, {
                method: 'GET',
                headers: headers(),
            });
            const plan = (response?.data ?? response) as any;
            currentPlan.value = plan;
            steps.value = (plan.steps ?? []) as IPlanStep[];
            messages.value = await fetchMessages(planId, 0);
            artifacts.value = await fetchArtifacts(planId);
            events.value = await fetchEvents(planId, 0);
            lastMessageId.value = messages.value.length ? messages.value[messages.value.length - 1].id : 0;
        } catch (e: any) {
            error.value = e?.data?.error ?? 'Failed to load plan';
        } finally {
            isLoading.value = false;
        }
    }

    /**
     * Lightweight refresh used while a plan is active. Updates only the plan
     * record and its steps, so a gate raised while the socket is reconnecting
     * still becomes visible without disturbing streamed messages.
     */
    async function refreshPlanState(planId: number) {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}`, {
            method: 'GET',
            headers: headers(),
        });
        const plan = (response?.data ?? response) as any;
        if (!plan?.id) return;
        currentPlan.value = plan;
        steps.value = (plan.steps ?? []) as IPlanStep[];
    }

    async function createPlan(projectId: number, payload: Record<string, any>) {
        isCreating.value = true;
        error.value = null;
        try {
            const response = await useAppFetch<any>(`${baseUrl()}/plans`, {
                method: 'POST',
                headers: headers(),
                body: { projectId, ...payload },
            });
            const plan = (response?.data ?? response) as any;
            plans.value.unshift(plan as IPlanSummary);
            return plan;
        } catch (e: any) {
            error.value = e?.data?.error ?? 'Failed to create plan';
            throw e;
        } finally {
            isCreating.value = false;
        }
    }

    async function updatePlan(planId: number, patch: Record<string, any>) {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}`, {
            method: 'PATCH',
            headers: headers(),
            body: patch,
        });
        currentPlan.value = response?.data ?? response;
        return currentPlan.value;
    }

    async function deletePlan(planId: number) {
        await useAppFetch(`${baseUrl()}/plans/${planId}`, {
            method: 'DELETE',
            headers: headers(),
        });
        plans.value = plans.value.filter((p) => p.id !== planId);
    }

    async function runStep(planId: number, stepKey: string, sync = false) {
        return await useAppFetch<any>(`${baseUrl()}/plans/${planId}/steps/${stepKey}/run${sync ? '?sync=true' : ''}`, {
            method: 'POST',
            headers: headers(),
            body: { trigger: 'user' },
        });
    }

    async function retryStep(planId: number, stepKey: string) {
        return await useAppFetch<any>(`${baseUrl()}/plans/${planId}/steps/${stepKey}/retry`, {
            method: 'POST',
            headers: headers(),
        });
    }

    async function skipStep(planId: number, stepKey: string, reason?: string) {
        return await useAppFetch<any>(`${baseUrl()}/plans/${planId}/steps/${stepKey}/skip`, {
            method: 'POST',
            headers: headers(),
            body: { reason },
        });
    }

    async function startPlan(planId: number) {
        return await useAppFetch<any>(`${baseUrl()}/plans/${planId}/start`, {
            method: 'POST',
            headers: headers(),
        });
    }

    async function updateBrief(planId: number, payload: Record<string, any>) {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/brief`, {
            method: 'POST',
            headers: headers(),
            body: payload,
        });
        const data = response?.data ?? response;
        if (data?.steps) {
            currentPlan.value = data;
            steps.value = data.steps;
        } else {
            currentPlan.value = data;
        }
        return data;
    }

    async function pausePlan(planId: number) {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/pause`, {
            method: 'POST',
            headers: headers(),
        });
        currentPlan.value = response?.data ?? response;
        return currentPlan.value;
    }

    async function resumePlan(planId: number) {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/resume`, {
            method: 'POST',
            headers: headers(),
        });
        currentPlan.value = response?.data ?? response;
        return currentPlan.value;
    }

    async function sendMessage(planId: number, content: string, sync = true) {
        await useAppFetch<any>(`${baseUrl()}/plans/${planId}/messages${sync ? '?sync=true' : ''}`, {
            method: 'POST',
            headers: headers(),
            body: { content },
        });
        await refreshMessages(planId);
    }

    async function answerGate(planId: number, gateId: string, answer: string) {
        await useAppFetch<any>(`${baseUrl()}/plans/${planId}/messages`, {
            method: 'POST',
            headers: headers(),
            body: { gateId, answer },
        });
        await refreshMessages(planId);
    }

    async function refreshMessages(planId: number) {
        messages.value = await fetchMessages(planId, 0);
        lastMessageId.value = messages.value.length ? messages.value[messages.value.length - 1].id : 0;
    }

    async function fetchMessages(planId: number, since: number): Promise<IPlanMessage[]> {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/messages?since=${since}`, {
            method: 'GET',
            headers: headers(),
        });
        return (response?.data ?? response ?? []) as IPlanMessage[];
    }

    async function fetchEvents(planId: number, since: number): Promise<IPlanEvent[]> {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/events?since=${since}`, {
            method: 'GET',
            headers: headers(),
        });
        return (response?.data ?? response ?? []) as IPlanEvent[];
    }

    async function fetchArtifacts(planId: number): Promise<IPlanArtifact[]> {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/artifacts?currentOnly=true`, {
            method: 'GET',
            headers: headers(),
        });
        return (response?.data ?? response ?? []) as IPlanArtifact[];
    }

    async function editArtifact(planId: number, artifactId: number, content: string) {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/artifacts/${artifactId}`, {
            method: 'PATCH',
            headers: headers(),
            body: { content },
        });
        artifacts.value = await fetchArtifacts(planId);
        return response?.data ?? response;
    }

    async function regenerateArtifact(planId: number, artifactId: number) {
        await useAppFetch<any>(`${baseUrl()}/plans/${planId}/artifacts/${artifactId}/regenerate`, {
            method: 'POST',
            headers: headers(),
        });
    }

    async function exportPlan(planId: number) {
        const token = getAuthToken();
        const response = await $fetch(`${baseUrl()}/plans/${planId}/export`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                'Authorization-Type': 'auth',
            },
        });
        const blob = response as unknown as Blob;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `paid-media-plan-${planId}.zip`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }

    async function publishPlan(planId: number, createCampaigns = false) {
        const response = await useAppFetch<any>(`${baseUrl()}/plans/${planId}/publish`, {
            method: 'POST',
            headers: headers(),
            body: { createCampaigns },
        });
        return response?.data ?? response;
    }

    async function syncResults(planId: number) {
        await useAppFetch<any>(`${baseUrl()}/plans/${planId}/results/sync`, {
            method: 'POST',
            headers: headers(),
        });
    }

    function applyStepStatus(planId: number, stepKey: string, status: IPlanStep['status'], extra: Partial<IPlanStep> = {}) {
        const step = steps.value.find((s) => s.stepKey === stepKey);
        if (!step) return;
        step.status = status;
        Object.assign(step, extra);
    }

    let socketListenersRegistered = false;
    let socketInitAttempts = 0;

    function initializeSocketListeners() {
        if (socketListenersRegistered || import.meta.server) return;
        const nuxtApp = useNuxtApp();
        const socket = nuxtApp.$socketio as any;
        if (!socket) {
            // The socket plugin loads asynchronously; retry briefly instead of
            // permanently skipping listener registration.
            if (socketInitAttempts++ < 40) {
                setTimeout(() => initializeSocketListeners(), 250);
            }
            return;
        }
        socketListenersRegistered = true;

        socket.on('connect', () => {
            // A reconnect can miss events emitted while the socket was down;
            // re-sync the active plan so gates and step state are not lost.
            if (currentPlan.value?.id) {
                void refreshPlanState(currentPlan.value.id);
            }
        });

        socket.on('plan:step:started', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            applyStepStatus(payload.planId, payload.stepKey, 'running', { startedAt: new Date().toISOString() });
        });

        socket.on('plan:step:progress', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            streamingText.value = payload?.toolName ? `Working with ${payload.toolName}...` : streamingText.value;
            const step = steps.value.find((s) => s.stepKey === payload.stepKey);
            if (step && step.status !== 'running' && step.status !== 'completed' && step.status !== 'waiting_for_input') {
                applyStepStatus(payload.planId, payload.stepKey, 'running', { startedAt: new Date().toISOString() });
            }
        });

        socket.on('plan:step:gate', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            applyStepStatus(payload.planId, payload.stepKey, 'waiting_for_input', { gate: payload.gate });
        });

        socket.on('plan:step:completed', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            applyStepStatus(payload.planId, payload.stepKey, 'completed');
            streamingText.value = '';
            refreshAfterStep(payload.planId);
        });

        socket.on('plan:step:failed', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            applyStepStatus(payload.planId, payload.stepKey, 'failed', { error: payload.error });
            streamingText.value = '';
        });

        socket.on('plan:artifact', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            if (payload?.artifact) {
                const artifact = payload.artifact as IPlanArtifact;
                artifacts.value = artifacts.value.filter((a) => a.artifactKey !== artifact.artifactKey);
                artifacts.value.push(artifact);
            }
        });

        socket.on('plan:updated', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            refreshAfterStep(payload.planId);
        });

        socket.on('plan:message', (payload: any) => {
            if (payload?.planId !== currentPlan.value?.id) return;
            if (payload?.done) {
                const message: IPlanMessage = {
                    id: payload.messageId ?? Date.now(),
                    planId: payload.planId,
                    stepId: null,
                    role: 'assistant',
                    content: payload.text ?? '',
                    metadata: null,
                    createdAt: new Date().toISOString(),
                };
                messages.value.push(message);
                streamingText.value = '';
                lastMessageId.value = message.id;
            } else {
                streamingText.value += payload?.delta ?? '';
                const step = steps.value.find((s) => s.stepKey === payload.stepKey);
                if (step && step.status !== 'running' && step.status !== 'completed' && step.status !== 'waiting_for_input') {
                    applyStepStatus(payload.planId, payload.stepKey, 'running', { startedAt: new Date().toISOString() });
                }
            }
        });
    }

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    function refreshAfterStep(planId: number) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(async () => {
            try {
                const plan = await useAppFetch<any>(`${baseUrl()}/plans/${planId}`, {
                    method: 'GET',
                    headers: headers(),
                });
                const data = plan?.data ?? plan;
                if (data?.steps) {
                    currentPlan.value = data;
                    steps.value = data.steps;
                }
                events.value = await fetchEvents(planId, 0);
                artifacts.value = await fetchArtifacts(planId);
            } catch {
                // keep existing state on refresh failure
            }
        }, 300);
    }

    function clearCurrentPlan() {
        currentPlan.value = null;
        steps.value = [];
        messages.value = [];
        events.value = [];
        artifacts.value = [];
        streamingText.value = '';
        lastMessageId.value = 0;
    }

    return {
        plans,
        currentPlan,
        steps,
        messages,
        events,
        artifacts,
        isLoading,
        isCreating,
        error,
        streamingText,
        completedStepCount,
        runningStep,
        waitingStep,
        nextPendingStep,
        fetchPlans,
        fetchPlan,
        refreshPlanState,
        createPlan,
        updatePlan,
        deletePlan,
        runStep,
        retryStep,
        skipStep,
        startPlan,
        pausePlan,
        resumePlan,
        updateBrief,
        sendMessage,
        answerGate,
        editArtifact,
        regenerateArtifact,
        exportPlan,
        publishPlan,
        syncResults,
        initializeSocketListeners,
        clearCurrentPlan,
        setGuestToken,
        getStoredGuestToken,
        createGuestPlan,
        fetchGuestPlan,
        refreshGuestPlanState,
        startGuestPlan,
        runGuestStep,
        sendGuestMessage,
        answerGuestGate,
        claimGuestPlan,
    };
});
