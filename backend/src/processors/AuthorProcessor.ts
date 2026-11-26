import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAAuthor } from "../models/DRAAuthor.js";
import _ from "lodash";

export interface IAuthorInput {
    name: string;
    slug?: string | null;
    picture?: string | null;
    linkedin_url?: string | null;
    website_url?: string | null;
    bio?: string | null;
}

export class AuthorProcessor {
    private static instance: AuthorProcessor;
    private constructor() {}

    public static getInstance(): AuthorProcessor {
        if (!AuthorProcessor.instance) {
            AuthorProcessor.instance = new AuthorProcessor();
        }
        return AuthorProcessor.instance;
    }

    private async getManager() {
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        if (!driver) {
            return null;
        }
        return (await driver.getConcreteDriver()).manager;
    }

    private slugify(name: string): string {
        const base = _.kebabCase(name).substring(0, 200);
        return base || 'author';
    }

    private async generateUniqueSlug(manager: any, rawSlug: string, excludeId?: number): Promise<string> {
        const base = this.slugify(rawSlug);
        let candidate = base;
        let suffix = 2;
        while (true) {
            const existing = await manager.findOne(DRAAuthor, { where: { slug: candidate } });
            if (!existing || existing.id === excludeId) {
                return candidate;
            }
            candidate = `${base}-${suffix}`;
            suffix += 1;
        }
    }

    async getAuthors(): Promise<DRAAuthor[]> {
        const manager = await this.getManager();
        if (!manager) {
            return [];
        }
        try {
            return await manager.find(DRAAuthor, { order: { name: 'ASC' } });
        } catch (error) {
            console.log('getAuthors error', error);
            return [];
        }
    }

    async getAuthor(authorId: number): Promise<DRAAuthor | null> {
        const manager = await this.getManager();
        if (!manager) {
            return null;
        }
        try {
            return await manager.findOne(DRAAuthor, { where: { id: authorId } });
        } catch (error) {
            console.log('getAuthor error', error);
            return null;
        }
    }

    async getAuthorBySlug(slug: string): Promise<DRAAuthor | null> {
        const manager = await this.getManager();
        if (!manager) {
            return null;
        }
        try {
            return await manager.findOne(DRAAuthor, { where: { slug } });
        } catch (error) {
            console.log('getAuthorBySlug error', error);
            return null;
        }
    }

    async addAuthor(input: IAuthorInput): Promise<DRAAuthor | null> {
        const manager = await this.getManager();
        if (!manager) {
            return null;
        }
        try {
            const author = new DRAAuthor();
            author.name = input.name;
            const desiredSlug = input.slug?.trim() ? input.slug : input.name;
            author.slug = await this.generateUniqueSlug(manager, desiredSlug);
            author.picture = input.picture ?? null;
            author.linkedin_url = input.linkedin_url ?? null;
            author.website_url = input.website_url ?? null;
            author.bio = input.bio ?? null;
            return await manager.save(author);
        } catch (error) {
            console.log('addAuthor error', error);
            return null;
        }
    }

    async editAuthor(authorId: number, input: IAuthorInput): Promise<boolean> {
        const manager = await this.getManager();
        if (!manager) {
            return false;
        }
        try {
            const author = await manager.findOne(DRAAuthor, { where: { id: authorId } });
            if (!author) {
                return false;
            }
            author.name = input.name;
            if (input.slug !== undefined && input.slug !== null) {
                const desiredSlug = input.slug.trim() || input.name;
                author.slug = await this.generateUniqueSlug(manager, desiredSlug, author.id);
            }
            author.picture = input.picture ?? null;
            author.linkedin_url = input.linkedin_url ?? null;
            author.website_url = input.website_url ?? null;
            author.bio = input.bio ?? null;
            await manager.save(author);
            return true;
        } catch (error) {
            console.log('editAuthor error', error);
            return false;
        }
    }

    async deleteAuthor(authorId: number): Promise<boolean> {
        const manager = await this.getManager();
        if (!manager) {
            return false;
        }
        try {
            const result = await manager.delete(DRAAuthor, { id: authorId });
            return (result.affected ?? 0) > 0;
        } catch (error) {
            console.log('deleteAuthor error', error);
            return false;
        }
    }
}
