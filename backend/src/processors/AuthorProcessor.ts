import { DBDriver } from "../drivers/DBDriver.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAAuthor } from "../models/DRAAuthor.js";

export interface IAuthorInput {
    name: string;
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

    async addAuthor(input: IAuthorInput): Promise<DRAAuthor | null> {
        const manager = await this.getManager();
        if (!manager) {
            return null;
        }
        try {
            const author = new DRAAuthor();
            author.name = input.name;
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
