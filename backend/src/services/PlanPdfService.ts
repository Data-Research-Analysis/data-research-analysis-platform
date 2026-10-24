import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT_PATH = join(__dirname, '..', '..', 'scripts', 'md_to_pdf.py');
const PYTHON_BIN = process.env.PLAN_PDF_PYTHON ?? 'python3';

export class PlanPdfService {
    private static instance: PlanPdfService;

    private constructor() {}

    public static getInstance(): PlanPdfService {
        if (!PlanPdfService.instance) {
            PlanPdfService.instance = new PlanPdfService();
        }
        return PlanPdfService.instance;
    }

    public static resetInstance(): void {
        PlanPdfService.instance = null as any;
    }

    public async renderMarkdownToPdf(markdown: string, title: string): Promise<Buffer> {
        const workDir = mkdtempSync(join(tmpdir(), 'plan-pdf-'));
        const inputPath = join(workDir, 'input.md');
        const outputPath = join(workDir, 'output.pdf');

        try {
            writeFileSync(inputPath, markdown ?? '', 'utf-8');
            await execFileAsync(PYTHON_BIN, [SCRIPT_PATH, inputPath, outputPath, title], {
                timeout: 120_000,
                maxBuffer: 10 * 1024 * 1024,
            });

            if (!existsSync(outputPath)) {
                throw new Error('PDF renderer did not produce an output file');
            }

            return readFileSync(outputPath);
        } finally {
            rmSync(workDir, { recursive: true, force: true });
        }
    }
}
