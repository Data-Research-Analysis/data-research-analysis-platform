#!/usr/bin/env tsx
/**
 * Multi-Tenant Setup Verification Script
 * 
 * Checks the health of the multi-tenant organization implementation:
 * - Verifies tables exist
 * - Checks organization count
 * - Validates subscription assignments
 * - Reports on project linkage status
 * - Lists workspaces and members
 * 
 * Usage:
 *   npm run verify-multi-tenant
 *   npm run verify-multi-tenant -- --detailed
 */

import { DRAOrganization } from '../src/models/DRAOrganization.js';
import { DRAWorkspace } from '../src/models/DRAWorkspace.js';
import { DRAOrganizationMember } from '../src/models/DRAOrganizationMember.js';
import { DRAOrganizationSubscription } from '../src/models/DRAOrganizationSubscription.js';
import { DRAProject } from '../src/models/DRAProject.js';
import { PostgresDataSource } from '../src/datasources/PostgresDataSource.js';
import dotenv from 'dotenv';
dotenv.config();

interface VerificationResult {
    status: 'PASS' | 'FAIL' | 'WARNING';
    message: string;
    details?: any;
}

const results: VerificationResult[] = [];
const args = process.argv.slice(2);
const detailed = args.includes('--detailed');

function addResult(status: 'PASS' | 'FAIL' | 'WARNING', message: string, details?: any) {
    results.push({ status, message, details });
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${message}`);
    if (detailed && details) {
        console.log(`   Details:`, JSON.stringify(details, null, 2));
    }
}

async function main() {
    console.log('\n=== Multi-Tenant Organization Verification ===\n');
    console.log(`Running in ${detailed ? 'DETAILED' : 'SUMMARY'} mode\n`);

    let dataSource: any = null;

    try {
        // Initialize database connection using PostgresDataSource
        const postgresDataSource = PostgresDataSource.getInstance();
        dataSource = await postgresDataSource.getDataSource();
        
        if (!dataSource || !dataSource.isInitialized) {
            throw new Error('Database connection not initialized');
        }
        
        const manager = dataSource.manager;

        // 1. Check Organizations Table
        console.log('📊 Checking Organizations...');
        const orgCount = await manager.count(DRAOrganization);
        if (orgCount === 0) {
            addResult('FAIL', `No organizations found - run migration or seeder`, { orgCount });
        } else {
            addResult('PASS', `Found ${orgCount} organizations`, { orgCount });
        }

        // 2. Check Workspaces
        console.log('\n📂 Checking Workspaces...');
        const workspaceCount = await manager.count(DRAWorkspace);
        if (workspaceCount === 0) {
            addResult('WARNING', 'No workspaces found', { workspaceCount });
        } else {
            addResult('PASS', `Found ${workspaceCount} workspaces`, { workspaceCount });
        }

        // 3. Check Organization Members
        console.log('\n👥 Checking Organization Members...');
        const memberCount = await manager.count(DRAOrganizationMember);
        if (memberCount === 0) {
            addResult('FAIL', 'No organization members found - migration may be incomplete', { memberCount });
        } else {
            addResult('PASS', `Found ${memberCount} organization members`, { memberCount });
        }

        // 4. Check Subscriptions
        console.log('\n💳 Checking Organization Subscriptions...');
        const subscriptionCount = await manager.count(DRAOrganizationSubscription);
        if (subscriptionCount === 0) {
            addResult('WARNING', 'No organization subscriptions found', { subscriptionCount });
        } else {
            addResult('PASS', `Found ${subscriptionCount} organization subscriptions`, { subscriptionCount });
            
            // Check subscription distribution
            const subscriptions = await manager.find(DRAOrganizationSubscription, {
                relations: ['subscription_tier']
            });
            const tierDistribution: Record<string, number> = {};
            for (const sub of subscriptions) {
                const tierName = sub.subscription_tier?.tier_name || 'unknown';
                tierDistribution[tierName] = (tierDistribution[tierName] || 0) + 1;
            }
            console.log(`   Tier Distribution:`, tierDistribution);
        }

        // 5. Check Project Linkage
        console.log('\n🔗 Checking Project Linkage...');
        const totalProjects = await manager.count(DRAProject);
        const linkedProjects = await manager.count(DRAProject, {
            where: { organization_id: { $ne: null } as any }
        });
        const orphanProjects = totalProjects - linkedProjects;
        
        if (orphanProjects > 0) {
            addResult('WARNING', `${orphanProjects} projects not linked to organizations`, {
                totalProjects,
                linkedProjects,
                orphanProjects
            });
        } else {
            addResult('PASS', `All ${totalProjects} projects linked to organizations`, {
                totalProjects,
                linkedProjects
            });
        }

        // 6. Check for Personal Organizations
        console.log('\n🏠 Checking Personal Organizations...');
        const orgs = await manager.find(DRAOrganization, {
            relations: ['members', 'subscription']
        });
        
        let soloOrgs = 0;
        let teamOrgs = 0;
        let maxMembersDistribution: Record<string, number> = {
            '1': 0,
            '5': 0,
            '100': 0,
            'unlimited': 0
        };
        
        for (const org of orgs) {
            const memberCount = await manager.count(DRAOrganizationMember, {
                where: { organization: { id: org.id }, is_active: true }
            });
            
            if (memberCount === 1) soloOrgs++;
            else if (memberCount > 1) teamOrgs++;
            
            const subscription = await manager.findOne(DRAOrganizationSubscription, {
                where: { organization: { id: org.id } }
            });
            
            if (subscription) {
                const maxMembers = subscription.max_members;
                if (maxMembers === 1) maxMembersDistribution['1']++;
                else if (maxMembers === 5) maxMembersDistribution['5']++;
                else if (maxMembers === 100) maxMembersDistribution['100']++;
                else if (maxMembers === null) maxMembersDistribution['unlimited']++;
            }
        }
        
        console.log(`   Solo Organizations (1 member): ${soloOrgs}`);
        console.log(`   Team Organizations (2+ members): ${teamOrgs}`);
        console.log(`   Max Members Limits:`, maxMembersDistribution);
        
        if (soloOrgs > 0) {
            addResult('PASS', `Personal organization strategy working (${soloOrgs} solo orgs)`, {
                soloOrgs,
                teamOrgs
            });
        }

        // 7. Detailed Org Breakdown
        if (detailed) {
            console.log('\n📋 Detailed Organization Breakdown:');
            for (const org of orgs.slice(0, 5)) { // Show first 5
                const members = await manager.find(DRAOrganizationMember, {
                    where: { organization: { id: org.id } },
                    relations: ['user']
                });
                const projects = await manager.count(DRAProject, {
                    where: { organization_id: org.id }
                });
                
                console.log(`\n   Organization: ${org.name}`);
                console.log(`   - Members: ${members.length}`);
                console.log(`   - Projects: ${projects}`);
                console.log(`   - Created: ${org.created_at}`);
            }
        }

        // Summary
        console.log('\n\n=== Verification Summary ===\n');
        const passCount = results.filter(r => r.status === 'PASS').length;
        const failCount = results.filter(r => r.status === 'FAIL').length;
        const warnCount = results.filter(r => r.status === 'WARNING').length;
        
        console.log(`✅ PASS:    ${passCount}`);
        console.log(`⚠️  WARNING: ${warnCount}`);
        console.log(`❌ FAIL:    ${failCount}`);
        
        if (failCount > 0) {
            console.log('\n⚠️  Some critical checks failed. Review the issues above.');
            process.exit(1);
        } else if (warnCount > 0) {
            console.log('\n⚠️  Some warnings detected. System is functional but review recommended.');
            process.exit(0);
        } else {
            console.log('\n✅ All checks passed! Multi-tenant system is healthy.');
            process.exit(0);
        }
        
    } catch (error) {
        console.error('\n❌ Verification failed with error:', error);
        process.exit(1);
    } finally {
        // Close connection if open
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    }
}

main();
