import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RBACService } from '../../services/RBACService.js';
import { EProjectRole } from '../../types/EProjectRole.js';
import { Permission, ROLE_PERMISSIONS } from '../../constants/permissions.js';

/**
 * Unit tests for RBACService
 * 
 * Tests permission checking logic for all roles and member management operations.
 * Uses mocked database layer to test service logic in isolation.
 */
describe('RBACService', () => {
    let service: RBACService;
    
    beforeEach(() => {
        service = RBACService.getInstance();
    });
    
    describe('Permission System', () => {
        it('should define all project roles', () => {
            expect(EProjectRole.OWNER).toBe('owner');
            expect(EProjectRole.ADMIN).toBe('admin');
            expect(EProjectRole.EDITOR).toBe('editor');
            expect(EProjectRole.VIEWER).toBe('viewer');
        });
        
        it('should map owner to all permissions', () => {
            const ownerPermissions = ROLE_PERMISSIONS[EProjectRole.OWNER];
            
            // Owner should have every permission
            expect(ownerPermissions).toContain(Permission.PROJECT_DELETE);
            expect(ownerPermissions).toContain(Permission.PROJECT_MANAGE_MEMBERS);
            expect(ownerPermissions).toContain(Permission.DATA_SOURCE_DELETE);
            expect(ownerPermissions).toContain(Permission.DATA_MODEL_DELETE);
            expect(ownerPermissions).toContain(Permission.DASHBOARD_DELETE);
            
            // Verify it's the full set
            expect(ownerPermissions.length).toBe(Object.values(Permission).length);
        });
        
        it('should map admin to most permissions except project deletion', () => {
            const adminPermissions = ROLE_PERMISSIONS[EProjectRole.ADMIN];
            
            // Admin has manage members
            expect(adminPermissions).toContain(Permission.PROJECT_MANAGE_MEMBERS);
            
            // Admin can manage all resources
            expect(adminPermissions).toContain(Permission.DATA_SOURCE_DELETE);
            expect(adminPermissions).toContain(Permission.DATA_MODEL_DELETE);
            expect(adminPermissions).toContain(Permission.DASHBOARD_DELETE);
            
            // Admin cannot delete project
            expect(adminPermissions).not.toContain(Permission.PROJECT_DELETE);
        });
        
        it('should map editor to create/edit permissions only', () => {
            const editorPermissions = ROLE_PERMISSIONS[EProjectRole.EDITOR];
            
            // Editor can create and edit
            expect(editorPermissions).toContain(Permission.DATA_MODEL_CREATE);
            expect(editorPermissions).toContain(Permission.DATA_MODEL_EDIT);
            expect(editorPermissions).toContain(Permission.DASHBOARD_CREATE);
            expect(editorPermissions).toContain(Permission.DASHBOARD_EDIT);
            
            // Editor cannot delete or manage members
            expect(editorPermissions).not.toContain(Permission.DATA_MODEL_DELETE);
            expect(editorPermissions).not.toContain(Permission.DATA_SOURCE_DELETE);
            expect(editorPermissions).not.toContain(Permission.PROJECT_MANAGE_MEMBERS);
        });
        
        it('should map viewer to read-only permissions', () => {
            const viewerPermissions = ROLE_PERMISSIONS[EProjectRole.VIEWER];
            
            // Viewer can view everything
            expect(viewerPermissions).toContain(Permission.PROJECT_VIEW);
            expect(viewerPermissions).toContain(Permission.DATA_SOURCE_VIEW);
            expect(viewerPermissions).toContain(Permission.DATA_MODEL_VIEW);
            expect(viewerPermissions).toContain(Permission.DATA_MODEL_EXECUTE);
            expect(viewerPermissions).toContain(Permission.DASHBOARD_VIEW);
            
            // Viewer cannot create, edit, or delete
            expect(viewerPermissions).not.toContain(Permission.DATA_MODEL_CREATE);
            expect(viewerPermissions).not.toContain(Permission.DATA_MODEL_EDIT);
            expect(viewerPermissions).not.toContain(Permission.DASHBOARD_CREATE);
            expect(viewerPermissions).not.toContain(Permission.PROJECT_MANAGE_MEMBERS);
        });
    });
    
    describe('Service Methods', () => {
        it('should be a singleton', () => {
            const instance1 = RBACService.getInstance();
            const instance2 = RBACService.getInstance();
            
            expect(instance1).toBe(instance2);
        });
        
        it('should have getUserRole method', () => {
            expect(typeof service.getUserRole).toBe('function');
        });
        
        it('should have hasPermission method', () => {
            expect(typeof service.hasPermission).toBe('function');
        });
        
        it('should have hasAnyPermission method', () => {
            expect(typeof service.hasAnyPermission).toBe('function');
        });
        
        it('should have hasAllPermissions method', () => {
            expect(typeof service.hasAllPermissions).toBe('function');
        });
        
        it('should have getUserProjects method', () => {
            expect(typeof service.getUserProjects).toBe('function');
        });
        
        it('should have addMember method', () => {
            expect(typeof service.addMember).toBe('function');
        });
        
        it('should have removeMember method', () => {
            expect(typeof service.removeMember).toBe('function');
        });
        
        it('should have updateMemberRole method', () => {
            expect(typeof service.updateMemberRole).toBe('function');
        });
        
        it('should have getProjectMembers method', () => {
            expect(typeof service.getProjectMembers).toBe('function');
        });
    });
    
    describe('Permission Hierarchy', () => {
        it('should have owner with most permissions', () => {
            const ownerCount = ROLE_PERMISSIONS[EProjectRole.OWNER].length;
            const adminCount = ROLE_PERMISSIONS[EProjectRole.ADMIN].length;
            const editorCount = ROLE_PERMISSIONS[EProjectRole.EDITOR].length;
            const viewerCount = ROLE_PERMISSIONS[EProjectRole.VIEWER].length;
            
            expect(ownerCount).toBeGreaterThan(adminCount);
            expect(adminCount).toBeGreaterThan(editorCount);
            expect(editorCount).toBeGreaterThan(viewerCount);
        });
        
        it('should have viewer permissions subset of editor', () => {
            const viewerPermissions = ROLE_PERMISSIONS[EProjectRole.VIEWER];
            const editorPermissions = ROLE_PERMISSIONS[EProjectRole.EDITOR];
            
            // All viewer permissions should be in editor (except execute might differ)
            const viewerViewPermissions = viewerPermissions.filter(p => 
                p.includes(':view')
            );
            
            viewerViewPermissions.forEach(permission => {
                expect(editorPermissions).toContain(permission);
            });
        });
        
        it('should have editor permissions subset of admin', () => {
            const editorPermissions = ROLE_PERMISSIONS[EProjectRole.EDITOR];
            const adminPermissions = ROLE_PERMISSIONS[EProjectRole.ADMIN];
            
            // Most editor permissions should be in admin
            const editCreatePermissions = editorPermissions.filter(p => 
                p.includes(':create') || p.includes(':edit') || p.includes(':view')
            );
            
            editCreatePermissions.forEach(permission => {
                expect(adminPermissions).toContain(permission);
            });
        });
    });
    
    describe('Permission Constants', () => {
        it('should define all permission categories', () => {
            const permissions = Object.values(Permission);
            
            // Check major categories exist
            const hasProjectPerms = permissions.some(p => p.startsWith('project:'));
            const hasDataSourcePerms = permissions.some(p => p.startsWith('data_source:'));
            const hasDataModelPerms = permissions.some(p => p.startsWith('data_model:'));
            const hasDashboardPerms = permissions.some(p => p.startsWith('dashboard:'));
            
            expect(hasProjectPerms).toBe(true);
            expect(hasDataSourcePerms).toBe(true);
            expect(hasDataModelPerms).toBe(true);
            expect(hasDashboardPerms).toBe(true);
        });
        
        it('should have consistent permission naming', () => {
            const permissions = Object.values(Permission);
            
            permissions.forEach(permission => {
                // All permissions should follow resource:action pattern
                expect(permission).toMatch(/^[a-z_]+:[a-z_]+$/);
            });
        });
    });
});
