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
const PUBLIC_DIR = join(__dirname, '..', '..', 'public');
const DEFAULT_LOGO_PATH = join(PUBLIC_DIR, 'logo-header.png');
const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];

export interface IPdfBrandingOptions {
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    orgName?: string | null;
}

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

    /**
     * Resolve the branding logo to a local file so the renderer never needs
     * network access. Falls back to the DRA default logo when the org logo
     * cannot be downloaded or does not exist locally.
     */
    private async resolveLogoFile(logoUrl: string | null | undefined, workDir: string): Promise<string> {
        if (!logoUrl) return DEFAULT_LOGO_PATH;

        const local = this.toLocalPath(logoUrl);
        if (local && existsSync(local)) return local;

        if (!/^https?:\/\//i.test(logoUrl)) {
            // Not a resolvable local path and not a remote URL — use the default.
            return DEFAULT_LOGO_PATH;
        }

        try {
            const response = await fetch(logoUrl, { signal: AbortSignal.timeout(10_000) });
            if (!response.ok) return DEFAULT_LOGO_PATH;

            const data = Buffer.from(await response.arrayBuffer());
            const ext = (logoUrl.split(/[?#]/)[0].match(/\.(\w+)$/)?.[1] ?? 'png').toLowerCase();
            const safeExt = LOGO_EXTENSIONS.includes(ext) ? ext : 'png';
            const logoPath = join(workDir, `brand-logo.${safeExt}`);
            writeFileSync(logoPath, data);
            return logoPath;
        } catch (error) {
            console.warn('[PlanPdfService] Logo fetch failed, falling back to default:', (error as Error)?.message);
            return DEFAULT_LOGO_PATH;
        }
    }

    private toLocalPath(logoUrl: string): string | null {
        const clean = logoUrl.split(/[?#]/)[0].replace(/^\/+/, '');
        if (!clean || /^https?:\/\//i.test(clean)) return null;
        return join(PUBLIC_DIR, clean);
    }

    public async renderMarkdownToPdf(
        markdown: string,
        title: string,
        branding?: IPdfBrandingOptions,
    ): Promise<Buffer> {
        const workDir = mkdtempSync(join(tmpdir(), 'plan-pdf-'));
        const inputPath = join(workDir, 'input.md');
        const outputPath = join(workDir, 'output.pdf');
        const brandingPath = join(workDir, 'branding.json');

        try {
            writeFileSync(inputPath, markdown ?? '', 'utf-8');

            const args = [SCRIPT_PATH, inputPath, outputPath, title];
            if (branding) {
                const logoPath = await this.resolveLogoFile(branding.logoUrl ?? null, workDir);
                writeFileSync(
                    brandingPath,
                    JSON.stringify({
                        logoPath,
                        primaryColor: branding.primaryColor ?? null,
                        secondaryColor: branding.secondaryColor ?? null,
                        orgName: branding.orgName ?? null,
                    }),
                    'utf-8',
                );
                args.push(brandingPath);
            }

            await execFileAsync(PYTHON_BIN, args, {
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
