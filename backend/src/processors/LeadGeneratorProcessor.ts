import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { DBDriver } from '../drivers/DBDriver.js';
import { EDataSourceType } from '../types/EDataSourceType.js';
import { DRALeadGenerator } from '../models/DRALeadGenerator.js';
import { DRALeadGeneratorLead } from '../models/DRALeadGeneratorLead.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LeadGeneratorProcessor {
    private static instance: LeadGeneratorProcessor;

    private constructor() {}

    public static getInstance(): LeadGeneratorProcessor {
        if (!LeadGeneratorProcessor.instance) {
            LeadGeneratorProcessor.instance = new LeadGeneratorProcessor();
        }
        return LeadGeneratorProcessor.instance;
    }

    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------

    private getFilePath(fileName: string): string {
        // Sanitise to basename to prevent path traversal (CodeQL CWE-022)
        const safeName = path.basename(fileName);
        return path.join(__dirname, '../../private/lead-generators', safeName);
    }

    private generateSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/[\s]+/g, '-')
            .replace(/-{2,}/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) throw new Error('Database driver not available');
        return (await driver.getConcreteDriver()).manager;
    }

    // ----------------------------------------------------------------
    // Admin CRUD
    // ----------------------------------------------------------------

    async createLeadGenerator(params: {
        title: string;
        slug?: string;
        description?: string;
        fileName: string;
        originalFileName: string;
        isGated: boolean;
    }): Promise<DRALeadGenerator> {
        const manager = await this.getManager();
        const lg = manager.create(DRALeadGenerator, {
            title: params.title,
            slug: params.slug || this.generateSlug(params.title),
            description: params.description || null,
            file_name: params.fileName,
            original_file_name: params.originalFileName,
            is_gated: params.isGated,
            is_active: true,
            view_count: 0,
            download_count: 0,
        });
        return manager.save(lg);
    }

    async updateLeadGenerator(
        id: number,
        params: Partial<{
            title: string;
            slug: string;
            description: string | null;
            isGated: boolean;
            isActive: boolean;
            fileName: string;
            originalFileName: string;
        }>
    ): Promise<DRALeadGenerator> {
        const manager = await this.getManager();
        const lg = await manager.findOneOrFail(DRALeadGenerator, { where: { id } });

        if (params.title !== undefined) lg.title = params.title;
        if (params.slug !== undefined) lg.slug = params.slug;
        if (params.description !== undefined) lg.description = params.description;
        if (params.isGated !== undefined) lg.is_gated = params.isGated;
        if (params.isActive !== undefined) lg.is_active = params.isActive;
        if (params.fileName !== undefined) {
            // Delete old file from disk before replacing
            const oldPath = this.getFilePath(lg.file_name);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) { console.warn('[LeadGeneratorProcessor] Could not delete old PDF:', e); }
            }
            lg.file_name = params.fileName;
            lg.original_file_name = params.originalFileName ?? lg.original_file_name;
        }

        return manager.save(lg);
    }

    async deleteLeadGenerator(id: number): Promise<void> {
        const manager = await this.getManager();
        const lg = await manager.findOneOrFail(DRALeadGenerator, { where: { id } });

        // Delete physical file from disk
        const filePath = this.getFilePath(lg.file_name);
        if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { console.warn('[LeadGeneratorProcessor] Could not delete PDF file:', e); }
        }

        await manager.remove(lg);
    }

    async getAllLeadGenerators(): Promise<(DRALeadGenerator & { lead_count: number })[]> {
        const manager = await this.getManager();
        const results = await manager
            .createQueryBuilder(DRALeadGenerator, 'lg')
            .loadRelationCountAndMap('lg.lead_count', 'lg.leads')
            .orderBy('lg.created_at', 'DESC')
            .getMany();
        return results as (DRALeadGenerator & { lead_count: number })[];
    }

    async getLeadGeneratorById(id: number): Promise<DRALeadGenerator> {
        const manager = await this.getManager();
        return manager.findOneOrFail(DRALeadGenerator, { where: { id } });
    }

    async getLeadsForGenerator(
        id: number,
        page = 1,
        limit = 50
    ): Promise<{ leads: DRALeadGeneratorLead[]; total: number }> {
        const manager = await this.getManager();
        const [leads, total] = await manager.findAndCount(DRALeadGeneratorLead, {
            where: { lead_generator_id: id },
            order: { created_at: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });
        return { leads, total };
    }

    // ----------------------------------------------------------------
    // Public-facing
    // ----------------------------------------------------------------

    async getBySlug(slug: string): Promise<DRALeadGenerator | null> {
        const manager = await this.getManager();
        return manager.findOne(DRALeadGenerator, { where: { slug, is_active: true } });
    }

    async incrementViewCount(id: number): Promise<void> {
        const manager = await this.getManager();
        await manager
            .createQueryBuilder()
            .update(DRALeadGenerator)
            .set({ view_count: () => 'view_count + 1' })
            .where('id = :id', { id })
            .execute();
    }

    async incrementDownloadCount(id: number): Promise<void> {
        const manager = await this.getManager();
        await manager
            .createQueryBuilder()
            .update(DRALeadGenerator)
            .set({ download_count: () => 'download_count + 1' })
            .where('id = :id', { id })
            .execute();
    }

    async recordLead(params: {
        leadGeneratorId: number;
        email: string;
        fullName?: string;
        company?: string;
        phone?: string;
        jobTitle?: string;
        ipAddress?: string;
    }): Promise<DRALeadGeneratorLead> {
        const manager = await this.getManager();
        const lead = manager.create(DRALeadGeneratorLead, {
            lead_generator_id: params.leadGeneratorId,
            email: params.email,
            full_name: params.fullName || null,
            company: params.company || null,
            phone: params.phone || null,
            job_title: params.jobTitle || null,
            ip_address: params.ipAddress || null,
        });
        return manager.save(lead);
    }

    // ----------------------------------------------------------------
    // Utility
    // ----------------------------------------------------------------

    getFilePathPublic(fileName: string): string {
        return this.getFilePath(fileName);
    }
}
