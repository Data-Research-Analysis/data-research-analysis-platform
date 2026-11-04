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

        test('marks briefing-form facts as already answered so the model does not re-ask them', () => {
            const state: any = {
                client_brief: 'Company: Acme\nProduct/service: Payroll SaaS',
                core_facts: {
                    website: 'https://acme.example',
                    industry: 'B2B SaaS',
                    markets: ['USA'],
                    platforms: ['google_search'],
                    budget: { total: 5000, currency: 'USD' },
                    dates: { start: '2026-01-01', end: '2026-01-31' },
                    competitors: [{ name: 'Rival', website: 'https://rival.example' }],
                    notes: 'Launch in Q1',
                    company: { product_service: 'Payroll SaaS', team_size: 4, channels: ['https://linkedin.com/company/acme'] },
                },
                funnel_and_scale: { coverage: 'bofu_mofu', build_mode: 'test_only' },
            };
            const markdown = service.stateToMarkdown('Acme Plan', state, false);
            expect(markdown).toContain('## Client briefing form — already answered (DO NOT ASK AGAIN)');
            expect(markdown).toContain('**Product or service:** Payroll SaaS');
            expect(markdown).toContain('**Industry / category:** B2B SaaS');
            expect(markdown).toContain('**Media budget and currency:** 5000 USD');
            expect(markdown).toContain('**Campaign dates / test window:** 2026-01-01 → 2026-01-31');
            expect(markdown).toContain('**Funnel coverage:** bofu_mofu');
            expect(markdown).toContain('**Build mode:** test_only');
            expect(markdown).toContain('**Competitors:** Rival');
            expect(markdown).toContain('**Existing channels / social profiles:** https://linkedin.com/company/acme');
            expect(markdown).toContain('**Team size:** 4');
            expect(markdown).toContain('**Additional notes:** Launch in Q1');
        });

        test('does not render the already-answered list for basic-mode plans without a client brief', () => {
            const state: any = {
                core_facts: { website: 'https://example.com', platforms: ['google_search'] },
                funnel_and_scale: { coverage: 'bofu', build_mode: 'test_only' },
            };
            const markdown = service.stateToMarkdown('Basic', state, false);
            expect(markdown).not.toContain('already answered (DO NOT ASK AGAIN)');
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
