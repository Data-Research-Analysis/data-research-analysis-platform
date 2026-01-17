/**
 * Migration script to add project owner entries for existing projects
 * Run this once to fix projects that were created before RBAC was implemented
 */
import { PostgresDSMigrations } from '../src/datasources/PostgresDSMigrations.js';
import { DRAProject } from '../src/models/DRAProject.js';
import { DRAProjectMember } from '../src/models/DRAProjectMember.js';
import { EProjectRole } from '../src/types/EProjectRole.js';

async function addProjectOwners() {
    console.log('Starting project owners migration...');
    
    try {
        // Initialize database connection
        await PostgresDSMigrations.initialize();
        const manager = PostgresDSMigrations.manager;
        
        // Find all projects
        const projects = await manager.find(DRAProject, {
            relations: ['users_platform', 'members']
        });
        
        console.log(`Found ${projects.length} projects`);
        
        let addedCount = 0;
        let skippedCount = 0;
        
        for (const project of projects) {
            // Check if project already has members
            if (project.members && project.members.length > 0) {
                console.log(`Project "${project.name}" (ID: ${project.id}) already has members, skipping`);
                skippedCount++;
                continue;
            }
            
            // Create owner member entry
            const projectMember = new DRAProjectMember();
            projectMember.project = project;
            projectMember.user = project.users_platform;
            projectMember.role = EProjectRole.OWNER;
            projectMember.added_at = project.created_at || new Date();
            
            await manager.save(projectMember);
            console.log(`✅ Added owner for project "${project.name}" (ID: ${project.id})`);
            addedCount++;
        }
        
        console.log('\n=== Migration Complete ===');
        console.log(`Added: ${addedCount} project owners`);
        console.log(`Skipped: ${skippedCount} projects (already have members)`);
        
        await PostgresDSMigrations.destroy();
        process.exit(0);
        
    } catch (error) {
        console.error('Migration failed:', error);
        await PostgresDSMigrations.destroy();
        process.exit(1);
    }
}

// Run migration
addProjectOwners();
