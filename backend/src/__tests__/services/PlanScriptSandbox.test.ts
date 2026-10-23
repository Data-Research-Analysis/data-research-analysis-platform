import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PlanScriptSandbox } from '../../services/PlanScriptSandbox.js';

describe('PlanScriptSandbox', () => {
    const sandbox = PlanScriptSandbox.getInstance();

    test('rejects unknown script ids', async () => {
        const result = await sandbox.run(1, null, 'eval-rm-rf', {});
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Unknown script id');
    });

    test('generates an xlsx for media-plan-xlsx from rows', async () => {
        const result = await sandbox.run(1, null, 'media-plan-xlsx', {
            rows: [
                { platform: 'Google Search', market: 'USA', budget: 1000, cpc: 1.5 },
                { platform: 'Meta Ads', market: 'USA', budget: 1000, cpc: 0.8 },
            ],
        });
        expect(result.ok).toBe(true);
        expect(result.storagePath).toBeTruthy();
        expect(result.byteSize).toBeGreaterThan(0);
        expect(existsSync(result.storagePath!)).toBe(true);
        rmSync(join(result.storagePath!, '..', '..', '1'), { recursive: true, force: true });
    });

    test('generates an xlsx from a markdown table', async () => {
        const markdown = [
            '| Platform | Market | Budget |',
            '| --- | --- | --- |',
            '| Google Search | USA | 1000 |',
        ].join('\n');
        const result = await sandbox.run(2, null, 'setup-checklist-xlsx', { content: markdown });
        expect(result.ok).toBe(true);
        expect(result.byteSize).toBeGreaterThan(0);
        rmSync(join(result.storagePath!, '..', '..', '2'), { recursive: true, force: true });
    });

    test('errors when no rows and no content', async () => {
        const result = await sandbox.run(3, null, 'media-plan-xlsx', {});
        expect(result.ok).toBe(false);
        expect(result.error).toContain('No rows provided');
    });
});
