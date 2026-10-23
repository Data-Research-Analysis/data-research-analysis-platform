export const PlanEventType = {
    PLAN_CREATED: 'plan_created',
    PLAN_STARTED: 'plan_started',
    PLAN_STEP_STARTED: 'plan_step_started',
    PLAN_STEP_COMPLETED: 'plan_step_completed',
    PLAN_STEP_FAILED: 'plan_step_failed',
    PLAN_STEP_SKIPPED: 'plan_step_skipped',
    PLAN_GATE_RAISED: 'plan_gate_raised',
    PLAN_GATE_ANSWERED: 'plan_gate_answered',
    PLAN_ARTIFACT_GENERATED: 'plan_artifact_generated',
    PLAN_ARTIFACT_VIEWED: 'plan_artifact_viewed',
    PLAN_ARTIFACT_DOWNLOADED: 'plan_artifact_downloaded',
    PLAN_ARTIFACT_EDITED: 'plan_artifact_edited',
    PLAN_ARTIFACT_REGENERATED: 'plan_artifact_regenerated',
    PLAN_EXPORTED: 'plan_exported',
    PLAN_PUBLISHED: 'plan_published',
    PLAN_CAMPAIGN_LINKED: 'plan_campaign_linked',
    PLAN_RESULTS_SYNCED: 'plan_results_synced',
    PLAN_COMPLETED: 'plan_completed',
} as const;

export type PlanEventTypeValue = typeof PlanEventType[keyof typeof PlanEventType];

export const PlanSocketEvent = {
    STEP_STARTED: 'plan:step:started',
    STEP_PROGRESS: 'plan:step:progress',
    STEP_GATE: 'plan:step:gate',
    STEP_COMPLETED: 'plan:step:completed',
    STEP_FAILED: 'plan:step:failed',
    MESSAGE: 'plan:message',
    ARTIFACT: 'plan:artifact',
    UPDATED: 'plan:updated',
} as const;

export type PlanSocketEventValue = typeof PlanSocketEvent[keyof typeof PlanSocketEvent];
