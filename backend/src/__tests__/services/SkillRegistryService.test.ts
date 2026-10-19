import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SkillRegistryService } from '../../services/SkillRegistryService.js';

describe('SkillRegistryService', () => {
    let fixtureRoot: string;
    let registry: SkillRegistryService;

    beforeAll(() => {
        fixtureRoot = mkdtempSync(join(tmpdir(), 'skill-registry-test-'));
        mkdirSync(join(fixtureRoot, '01-pm-brief'), { recursive: true });
        mkdirSync(join(fixtureRoot, '99-invalid'), { recursive: true });

        writeFileSync(
            join(fixtureRoot, '01-pm-brief', 'manifest.json'),
            JSON.stringify({
                id: 'pm-brief',
                stepNumber: 1,
                stepKey: 'pm-brief',
                title: 'Creative brief',
                version: '1.0.0',
                skillFile: 'SKILL.md',
                requires: ['intake'],
                inputs: ['mode', 'website'],
                tools: ['web_fetch', 'write_artifact', 'write_state', 'ask_user'],
                gate: { afterRun: true, type: 'confirm_brief' },
                artifacts: [{ key: '01-creative-brief', kind: 'markdown', path: '01-creative-brief.md', title: 'Creative brief' }],
                stateWrites: ['core_facts'],
                systemPromptRef: 'SKILL.md#workflow',
                outputContract: { type: 'markdown', requiredSections: ['Core facts'] },
                model: { name: 'gemini-2.5-flash', temperature: 0.3 },
                maxToolCalls: 40,
            })
        );
        writeFileSync(join(fixtureRoot, '01-pm-brief', 'SKILL.md'), '# Step 1 — Creative Brief\n\nBuild the brief.');

        writeFileSync(
            join(fixtureRoot, '99-invalid', 'manifest.json'),
            JSON.stringify({
                id: 'invalid',
                stepNumber: 99,
                stepKey: 'invalid',
                skillFile: 'MISSING.md',
                tools: ['web_search', 'not_a_tool'],
                artifacts: [],
            })
        );

        SkillRegistryService.resetInstance();
        registry = SkillRegistryService.getInstance(fixtureRoot);
    });

    afterAll(() => {
        rmSync(fixtureRoot, { recursive: true, force: true });
        SkillRegistryService.resetInstance();
    });

    test('loads valid packs and skips invalid ones', () => {
        expect(registry.list()).toHaveLength(1);
        expect(registry.get('pm-brief').title).toBe('Creative brief');
    });

    test('reports validation errors for invalid packs', () => {
        const errors = registry.getValidationErrors();
        expect(errors.some((e) => e.includes('invalid'))).toBe(true);
        expect(errors.some((e) => e.includes('unknown tool'))).toBe(true);
    });

    test('ordered() sorts by stepNumber', () => {
        const packs = registry.ordered();
        expect(packs[0].stepNumber).toBe(1);
    });

    test('get() throws for unknown step key', () => {
        expect(() => registry.get('does-not-exist')).toThrow();
    });

    test('skill content is loaded from disk', () => {
        const pack = registry.get('pm-brief');
        expect(pack.content).toContain('Creative Brief');
    });

    test('real vendored skills load without errors', () => {
        SkillRegistryService.resetInstance();
        const real = SkillRegistryService.getInstance();
        expect(real.hasErrors()).toBe(false);
        expect(real.ordered().length).toBe(18);
        const brief = real.get('pm-brief');
        expect(brief.artifacts[0].key).toBe('01-creative-brief');
        expect(real.get('pm-company-paid-audit').stepNumber).toBe(31);
    });
});
