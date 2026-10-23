import { PLAN_STEP_DEFINITIONS, PLAN_DEFAULT_AUTONOMY } from '../../constants/planSteps.js';

describe('Plan step definitions', () => {
    test('defines all 18 loop steps in order', () => {
        expect(PLAN_STEP_DEFINITIONS).toHaveLength(18);
        const keys = PLAN_STEP_DEFINITIONS.map((d) => d.stepKey);
        expect(keys[0]).toBe('intake');
        expect(keys).toContain('pm-brief');
        expect(keys).toContain('pm-company-paid-audit');
        expect(keys[keys.length - 1]).toBe('plan-index');
    });

    test('step keys are unique', () => {
        const keys = PLAN_STEP_DEFINITIONS.map((d) => d.stepKey);
        expect(new Set(keys).size).toBe(keys.length);
    });

    test('step numbers are unique', () => {
        const numbers = PLAN_STEP_DEFINITIONS.map((d) => d.stepNumber);
        expect(new Set(numbers).size).toBe(numbers.length);
    });

    test('3A step runs between competitor research and audience analysis', () => {
        const audit = PLAN_STEP_DEFINITIONS.find((d) => d.stepKey === 'pm-company-paid-audit');
        expect(audit?.stepNumber).toBe(4);
        expect(audit?.artifactKeys).toContain('03a-company-paid-media-audit');
        const competitor = PLAN_STEP_DEFINITIONS.find((d) => d.stepKey === 'pm-competitor-research');
        const audience = PLAN_STEP_DEFINITIONS.find((d) => d.stepKey === 'pm-audience-analysis');
        expect(competitor?.stepNumber).toBeLessThan(audit!.stepNumber);
        expect(audit!.stepNumber).toBeLessThan(audience!.stepNumber);
    });

    test('phase grouping matches the marketing-first flow', () => {
        const phaseOf = (key: string) => PLAN_STEP_DEFINITIONS.find((d) => d.stepKey === key)?.phase;
        expect(phaseOf('pm-brief')).toBe('discover');
        expect(phaseOf('pm-keyword-research')).toBe('define');
        expect(phaseOf('pm-media-plan')).toBe('build');
        expect(phaseOf('pm-setup-checklist')).toBe('launch');
        expect(phaseOf('plan-index')).toBe('present');
    });

    test('every artifact key is unique across steps', () => {
        const artifactKeys = PLAN_STEP_DEFINITIONS.flatMap((d) => d.artifactKeys);
        expect(new Set(artifactKeys).size).toBe(artifactKeys.length);
    });

    test('gated steps carry a gate type and question', () => {
        const gated = PLAN_STEP_DEFINITIONS.filter((d) => d.gateAfter);
        expect(gated.map((d) => d.stepKey)).toEqual(['intake', 'pm-brief', 'pm-keyword-research', 'pm-tracking-setup', 'pm-setup-checklist']);
        for (const step of gated) {
            expect(step.gateType).toBeTruthy();
            expect(step.gateQuestion).toBeTruthy();
        }
    });

    test('default autonomy is assisted', () => {
        expect(PLAN_DEFAULT_AUTONOMY).toBe('assisted');
    });
});
