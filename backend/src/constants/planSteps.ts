import { PlanPhase, PlanFunnelCoverage, PlanBuildMode, PlanAutonomy } from '../types/IPaidMediaPlan.js';

export interface IPlanStepDefinition {
    stepKey: string;
    stepNumber: number;
    title: string;
    phase: PlanPhase;
    artifactKeys: string[];
    gateAfter: boolean;
    gateType?: string;
    gateQuestion?: string;
}

export const PLAN_STEP_DEFINITIONS: IPlanStepDefinition[] = [
    {
        stepKey: 'intake',
        stepNumber: 0,
        title: 'Plan intake',
        phase: 'discover',
        artifactKeys: [],
        gateAfter: true,
        gateType: 'confirm_funnel_build_mode',
        gateQuestion: 'Confirm your funnel coverage and build mode before we continue.',
    },
    {
        stepKey: 'pm-brief',
        stepNumber: 1,
        title: 'Creative brief',
        phase: 'discover',
        artifactKeys: ['01-creative-brief'],
        gateAfter: true,
        gateType: 'confirm_brief',
        gateQuestion: 'Your creative brief is ready. Confirm these before I continue.',
    },
    {
        stepKey: 'pm-market-research',
        stepNumber: 2,
        title: 'Market research',
        phase: 'discover',
        artifactKeys: ['02-market-research'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-competitor-research',
        stepNumber: 3,
        title: 'Competitor research',
        phase: 'discover',
        artifactKeys: ['03-competitor-paid-media-research'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-company-paid-audit',
        stepNumber: 4,
        title: 'Company paid audit',
        phase: 'discover',
        artifactKeys: ['03a-company-paid-media-audit'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-audience-analysis',
        stepNumber: 5,
        title: 'Audience analysis',
        phase: 'discover',
        artifactKeys: ['04-audience-analysis-avatars'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-keyword-research',
        stepNumber: 6,
        title: 'Keyword research',
        phase: 'define',
        artifactKeys: ['05-keyword-destination-url-plan'],
        gateAfter: true,
        gateType: 'confirm_urls_live',
        gateQuestion: 'Confirm your destination URLs are live before we build on them.',
    },
    {
        stepKey: 'pm-ad-copy',
        stepNumber: 7,
        title: 'Ad copy',
        phase: 'define',
        artifactKeys: ['06-ad-copy'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-creatives',
        stepNumber: 8,
        title: 'Creatives',
        phase: 'define',
        artifactKeys: ['07-creatives'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-landing-page-copy',
        stepNumber: 9,
        title: 'Landing page copy',
        phase: 'build',
        artifactKeys: ['08-landing-page-copy'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-landing-page-implementation',
        stepNumber: 10,
        title: 'Landing page implementation',
        phase: 'build',
        artifactKeys: ['09-landing-page-implementation'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-media-plan',
        stepNumber: 11,
        title: 'Media plan',
        phase: 'build',
        artifactKeys: ['10-media-plan'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-tracking-setup',
        stepNumber: 12,
        title: 'Tracking setup',
        phase: 'build',
        artifactKeys: ['11-tracking-setup'],
        gateAfter: true,
        gateType: 'confirm_tracking',
        gateQuestion: 'Confirm your tracking plan before launch.',
    },
    {
        stepKey: 'pm-campaign-build',
        stepNumber: 13,
        title: 'Campaign build guide',
        phase: 'launch',
        artifactKeys: ['12-campaign-build-guide'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-setup-checklist',
        stepNumber: 14,
        title: 'Setup checklist',
        phase: 'launch',
        artifactKeys: ['13-setup-checklist'],
        gateAfter: true,
        gateType: 'pre_launch_qa',
        gateQuestion: 'Pre-launch QA. Confirm the setup checklist before launch.',
    },
    {
        stepKey: 'pm-results-review',
        stepNumber: 15,
        title: 'Results review',
        phase: 'present',
        artifactKeys: ['14-results-review'],
        gateAfter: false,
    },
    {
        stepKey: 'pm-client-presentation',
        stepNumber: 16,
        title: 'Client presentation deck',
        phase: 'present',
        artifactKeys: ['00-digital-marketing-strategy-deck', '00-strategy-deck-content'],
        gateAfter: false,
    },
    {
        stepKey: 'plan-index',
        stepNumber: 17,
        title: 'Plan index',
        phase: 'present',
        artifactKeys: ['00-plan-index'],
        gateAfter: false,
    },
];

export const PLAN_DEFAULT_AUTONOMY: PlanAutonomy = 'assisted';
export const PLAN_DEFAULT_CURRENCY = 'USD';
export const PLAN_DEFAULT_MODE = 'basic';
export const PLAN_DEFAULT_FUNNEL_COVERAGE: PlanFunnelCoverage = 'bofu_mofu';
export const PLAN_DEFAULT_BUILD_MODE: PlanBuildMode = 'test_only';
