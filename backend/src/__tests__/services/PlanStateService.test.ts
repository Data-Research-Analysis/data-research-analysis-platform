import { PlanStateService } from '../../services/PlanStateService.js';

describe('PlanStateService', () => {
    let service: PlanStateService;

    beforeAll(() => {
        PlanStateService.resetInstance();
        service = PlanStateService.getInstance();
    });

    describe('stateToMarkdown', () => {
        test('renders core facts, funnel, verification and step outputs', () => {
            const state: any = {
                core_facts: {
                    company: { name: 'DRA', industry: 'SaaS' },
                    platforms: ['google_search', 'meta_ads'],
                    markets: ['USA', 'UAE'],
                    website: 'https://example.com',
                },
                funnel_and_scale: { coverage: 'full_funnel', build_mode: 'test_only' },
                verification: { budget: 'VERIFIED', cpc: 'ESTIMATE' },
                step_outputs: { 'pm-brief': { artifact: '01-creative-brief' } },
            };
            const markdown = service.stateToMarkdown('DRA Plan', state, true);
            expect(markdown).toContain('# Plan state — DRA Plan');
            expect(markdown).toContain('**company:** name: DRA · industry: SaaS');
            expect(markdown).toContain('google_search, meta_ads');
            expect(markdown).toContain('**budget:** VERIFIED');
            expect(markdown).toContain('artifact=01-creative-brief');
        });

        test('omits empty core facts', () => {
            const state: any = { core_facts: { website: '', platforms: [] } };
            const markdown = service.stateToMarkdown('Empty', state, false);
            expect(markdown).not.toContain('website:');
        });
    });

    describe('validate', () => {
        test('accepts valid verification statuses', () => {
            const state: any = { verification: { budget: 'VERIFIED', cpc: 'NOT VERIFIED' } };
            expect(service.validate(state)).toHaveLength(0);
        });

        test('rejects invalid verification status', () => {
            const state: any = { verification: { cpc: 'GUESSED' } };
            const errors = service.validate(state);
            expect(errors).toHaveLength(1);
            expect(errors[0]).toContain('must be VERIFIED');
        });

        test('rejects a non-positive budget', () => {
            const state: any = { core_facts: { budget: { total: 0 } } };
            const errors = service.validate(state);
            expect(errors.some((e) => e.includes('budget'))).toBe(true);
        });
    });
});
