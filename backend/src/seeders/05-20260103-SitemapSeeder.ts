import { DataSource } from "typeorm";
import { Seeder } from "@jorgebodega/typeorm-seeding";
import { DRASitemapEntry } from "../models/DRASitemapEntry.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { EPublishStatus } from "../types/EPublishStatus.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SitemapSeeder extends Seeder {
    public async run(dataSource: DataSource): Promise<any> {
        const sitemapRepo = dataSource.getRepository(DRASitemapEntry);
        const userRepo = dataSource.getRepository(DRAUsersPlatform);

        // Find admin user (assuming first admin user or create logic)
        let adminUser = await userRepo.findOne({ where: { user_type: 'admin' } });
        
        if (!adminUser) {
            console.log('No admin user found. Skipping sitemap seeding.');
            return;
        }

        // Check if sitemap entries already exist
        const existingCount = await sitemapRepo.count();
        if (existingCount > 0) {
            console.log(`${existingCount} sitemap entries already exist. Skipping seeding.`);
            return;
        }

        // Read the existing sitemap.txt file
        const sitemapPath = path.join(__dirname, '../../public/sitemap_backup.txt');
        
        if (!fs.existsSync(sitemapPath)) {
            console.log('sitemap_backup.txt file not found. Skipping seeding.');
            return;
        }

        const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
        const urls = sitemapContent.split('\n').filter(line => line.trim() !== '');

        console.log(`Found ${urls.length} URLs in sitemap_backup.txt`);

        // Create entries for each URL
        const entries: DRASitemapEntry[] = [];
        for (let i = 0; i < urls.length; i++) {
            const entry = new DRASitemapEntry();
            entry.url = urls[i].trim();
            entry.publish_status = EPublishStatus.PUBLISHED;
            entry.priority = i; // Maintain original order
            entry.users_platform = adminUser;
            entries.push(entry);
        }

        // Save all entries
        await sitemapRepo.save(entries);
        console.log(`Successfully seeded ${entries.length} sitemap entries`);

        // Backup the original file
        const backupPath = path.join(__dirname, '../../public/sitemap_backup.txt.bak');
        fs.copyFileSync(sitemapPath, backupPath);
        console.log(`Backed up original sitemap_backup.txt to sitemap_backup.txt.bak`);
    }
}
