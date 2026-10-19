import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ISkillArtifactContract {
    key: string;
    kind: string;
    path: string;
    title: string;
    script?: string;
}

export interface ISkillGateContract {
    afterRun: boolean;
    type: string;
    question?: string;
}

export interface ISkillManifest {
    id: string;
    stepNumber: number;
    stepKey: string;
    title: string;
    version: string;
    skillFile: string;
    requires: string[];
    inputs: string[];
    tools: string[];
    gate: ISkillGateContract | null;
    artifacts: ISkillArtifactContract[];
    stateWrites: string[];
    systemPromptRef: string;
    outputContract: { type: string; requiredSections?: string[]; requiredFields?: string[] };
    model?: { name: string; temperature?: number; maxOutputTokens?: number };
    maxToolCalls?: number;
}

export interface ISkillPack extends ISkillManifest {
    dir: string;
    content: string;
}

const ALLOWED_TOOLS = [
    'web_search',
    'web_fetch',
    'write_artifact',
    'read_artifact',
    'read_state',
    'write_state',
    'ask_user',
    'run_script',
    'query_marketing_metrics',
    'list_connected_accounts',
    'read_benchmarks',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..', '..');

export function resolveSkillsRoot(): string {
    const fromEnv = process.env.PLAN_SKILLS_DIR;
    if (fromEnv && existsSync(fromEnv)) {
        return fromEnv;
    }
    const candidates = [
        join(process.cwd(), 'skills', 'paid-media'),
        join(REPO_ROOT, 'skills', 'paid-media'),
        join(process.cwd(), '..', 'skills', 'paid-media'),
        '/skills/paid-media',
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    return join(process.cwd(), 'skills', 'paid-media');
}

export class SkillRegistryService {
    private static instance: SkillRegistryService;
    private packs: Map<string, ISkillPack> = new Map();
    private validationErrors: string[] = [];
    private skillsRoot: string;

    private constructor(skillsRoot?: string) {
        this.skillsRoot = skillsRoot ?? resolveSkillsRoot();
        this.load();
    }

    public static getInstance(skillsRoot?: string): SkillRegistryService {
        if (!SkillRegistryService.instance) {
            SkillRegistryService.instance = new SkillRegistryService(skillsRoot);
        }
        return SkillRegistryService.instance;
    }

    public static resetInstance(): void {
        SkillRegistryService.instance = null as any;
    }

    private load(): void {
        this.packs.clear();
        this.validationErrors = [];
        if (!existsSync(this.skillsRoot)) {
            this.validationErrors.push(`Skills root not found: ${this.skillsRoot}`);
            return;
        }
        const entries = readdirSync(this.skillsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
            const dir = join(this.skillsRoot, entry.name);
            const manifestPath = join(dir, 'manifest.json');
            if (!existsSync(manifestPath)) {
                this.validationErrors.push(`Missing manifest.json in ${entry.name}`);
                continue;
            }
            try {
                const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ISkillManifest;
                const errors = this.validateManifest(manifest, dir);
                if (errors.length > 0) {
                    this.validationErrors.push(...errors.map((e) => `[${manifest.stepKey}] ${e}`));
                    continue;
                }
                const content = readFileSync(join(dir, manifest.skillFile), 'utf-8');
                this.packs.set(manifest.stepKey, { ...manifest, dir, content });
            } catch (error: any) {
                this.validationErrors.push(`Failed to load ${entry.name}: ${error.message}`);
            }
        }
    }

    private validateManifest(manifest: ISkillManifest, dir: string): string[] {
        const errors: string[] = [];
        if (!manifest.id) errors.push('missing id');
        if (!manifest.stepKey) errors.push('missing stepKey');
        if (typeof manifest.stepNumber !== 'number') errors.push('missing stepNumber');
        if (!manifest.skillFile) errors.push('missing skillFile');
        if (!existsSync(join(dir, manifest.skillFile))) errors.push(`skillFile not found: ${manifest.skillFile}`);
        if (!Array.isArray(manifest.requires)) errors.push('requires must be an array');
        if (!Array.isArray(manifest.tools) || manifest.tools.some((t) => !ALLOWED_TOOLS.includes(t))) {
            errors.push(`tools contain an unknown tool; allowed: ${ALLOWED_TOOLS.join(', ')}`);
        }
        if (!Array.isArray(manifest.artifacts)) errors.push('artifacts must be an array');
        if (manifest.artifacts && manifest.artifacts.length > 0) {
            const keys = new Set<string>();
            for (const artifact of manifest.artifacts) {
                if (!artifact.key || !artifact.kind || !artifact.path) {
                    errors.push(`artifact ${artifact.key || '?'} must have key, kind and path`);
                }
                if (keys.has(artifact.key)) errors.push(`duplicate artifact key ${artifact.key}`);
                keys.add(artifact.key);
            }
        }
        return errors;
    }

    public list(): ISkillPack[] {
        return Array.from(this.packs.values());
    }

    public get(stepKey: string): ISkillPack {
        const pack = this.packs.get(stepKey);
        if (!pack) {
            throw new Error(`Skill not found for step key: ${stepKey}`);
        }
        return pack;
    }

    public tryGet(stepKey: string): ISkillPack | null {
        return this.packs.get(stepKey) ?? null;
    }

    public ordered(): ISkillPack[] {
        return this.list().sort((a, b) => a.stepNumber - b.stepNumber);
    }

    public getByStepNumber(stepNumber: number): ISkillPack | null {
        return this.list().find((pack) => pack.stepNumber === stepNumber) ?? null;
    }

    public getValidationErrors(): string[] {
        return [...this.validationErrors];
    }

    public hasErrors(): boolean {
        return this.validationErrors.length > 0;
    }
}
