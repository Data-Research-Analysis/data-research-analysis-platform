import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, '..', '..', 'scripts', 'md_to_checklist_xlsx.py');
const PYTHON_BIN = process.env.PLAN_CHECKLIST_PYTHON ?? 'python3';

export class PlanChecklistExcelService {
    private static instance: PlanChecklistExcelService;

    private constructor() {}

    public static getInstance(): PlanChecklistExcelService {
        if (!PlanChecklistExcelService.instance) {
            PlanChecklistExcelService.instance = new PlanChecklistExcelService();
        }
        return PlanChecklistExcelService.instance;
    }

    public static resetInstance(): void {
        PlanChecklistExcelService.instance = null as any;
    }

    public async renderChecklistXlsx(markdown: string, title: string): Promise<Buffer> {
        const workDir = mkdtempSync(join(tmpdir(), 'plan-checklist-xlsx-'));
        const inputPath = join(workDir, 'input.md');
        const outputPath = join(workDir, 'output.xlsx');

        try {
            writeFileSync(inputPath, markdown ?? '', 'utf-8');
            await execFileAsync(PYTHON_BIN, [SCRIPT_PATH, inputPath, outputPath, title], {
                timeout: 120_000,
                maxBuffer: 10 * 1024 * 1024,
            });

            if (!existsSync(outputPath)) {
                throw new Error('Checklist renderer did not produce an output file');
            }

            return readFileSync(outputPath);
        } finally {
            rmSync(workDir, { recursive: true, force: true });
        }
    }
}
