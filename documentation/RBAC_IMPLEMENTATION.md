# Role-Based Access Control (RBAC) Implementation Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Roles and Permissions](#roles-and-permissions)
4. [Database Schema](#database-schema)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Security Model](#security-model)
8. [API Endpoints](#api-endpoints)
9. [Usage Examples](#usage-examples)
10. [Testing](#testing)
11. [Migration Guide](#migration-guide)

---

## Overview

The Data Research Analysis platform implements a comprehensive Role-Based Access Control (RBAC) system that enables secure collaborative project management. The system provides four hierarchical roles with 19 granular permissions across four resource types.

### Key Features

- **4 Hierarchical Roles**: Owner, Admin, Editor, Viewer
- **19 Granular Permissions**: Fine-grained control over resources
- **4 Resource Types**: Projects, Data Sources, Data Models, Dashboards
- **Email Invitations**: Invite-by-email workflow with expiring tokens
- **Automatic Ownership**: Project creators automatically become owners
- **Transaction Safety**: All member operations use database transactions
- **Middleware-Based Authorization**: Express middleware with automatic project ID extraction

### Design Principles

1. **Principle of Least Privilege**: Users default to 'viewer' role if unspecified
2. **Owner Protection**: Owner role cannot be removed or changed
3. **Explicit Permissions**: All resource actions require explicit permission checks
4. **Fail Secure**: Missing permissions deny access by default
5. **Single Source of Truth**: RBAC data stored in PostgreSQL, cached in frontend stores

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                         │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                │
│  - ProjectMembersDialog.vue (Team management UI)            │
│  - Project cards with role badges                           │
│                                                             │
│  Stores:                                                    │
│  - projects.ts (RBAC data validation & normalization)       │
│                                                             │
│  Types:                                                     │
│  - IProject (with is_owner, user_role, members[])          │
│  - IProjectMember (id, role, user, added_at)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/REST API
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Backend Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Middleware:                                                │
│  - authenticate (JWT validation)                            │
│  - authorize() (Permission checking)                        │
│                                                             │
│  Services:                                                  │
│  - RBACService (Permission checks, member management)       │
│  - PermissionService (Final DELETE enforcement)             │
│  - EmailService (Invitation emails)                         │
│                                                             │
│  Routes:                                                    │
│  - /project/:projectId/members (CRUD operations)            │
│  - /project/:projectId/my-role (Role retrieval)             │
│                                                             │
│  Processors:                                                │
│  - ProjectProcessor (Business logic with RBAC data)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ TypeORM
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Tables:                                                    │
│  - dra_project_members (user-project-role mapping)          │
│  - dra_project_invitations (pending invites)                │
│  - dra_projects (project metadata)                          │
│  - dra_users_platform (user accounts)                       │
│  - dra_verification_codes (invitation tokens)               │
│                                                             │
│  Models:                                                    │
│  - DRAProjectMember                                         │
│  - DRAProjectInvitation                                     │
│  - DRAProject                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Permission Check Flow
```
User Action → authenticate middleware → authorize middleware
                                              ↓
                                    Extract project_id
                                              ↓
                                    RBACService.hasPermission()
                                              ↓
                                    Query DRAProjectMember
                                              ↓
                                    Check ROLE_PERMISSIONS
                                              ↓
                            Allow (200) or Deny (403)
```

#### Invitation Flow
```
Admin invites user → POST /project/:id/members
                                ↓
                    Create DRAProjectInvitation
                                ↓
                    EmailService.sendProjectInvitation()
                                ↓
                    User clicks email link
                                ↓
                    Accept invitation endpoint
                                ↓
                    Create DRAProjectMember
                                ↓
                    Update invitation status
```

---

## Roles and Permissions

### Role Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ OWNER                                                   │
│ - All 19 permissions                                    │
│ - Cannot be removed or changed                          │
│ - Automatically assigned to project creator             │
│ - Can delete project and all resources                  │
├─────────────────────────────────────────────────────────┤
│ ADMIN                                                   │
│ - 18 permissions (all except PROJECT_DELETE)            │
│ - Can manage team members (invite/remove/change roles)  │
│ - Can create/edit all resources                         │
│ - CANNOT delete data sources, models, or dashboards     │
├─────────────────────────────────────────────────────────┤
│ EDITOR                                                  │
│ - 11 permissions (create/edit content)                  │
│ - Can create and edit data models and dashboards        │
│ - Can execute data models                               │
│ - CANNOT manage team or delete anything                 │
├─────────────────────────────────────────────────────────┤
│ VIEWER                                                  │
│ - 4 permissions (read-only)                             │
│ - Can view all project resources                        │
│ - Can execute data models                               │
│ - CANNOT create, edit, or delete anything               │
└─────────────────────────────────────────────────────────┘
```

### Permission Matrix

| Permission                  | Owner | Admin | Editor | Viewer |
|----------------------------|-------|-------|--------|--------|
| **PROJECT**                |       |       |        |        |
| PROJECT_VIEW               | ✅    | ✅    | ✅     | ✅     |
| PROJECT_EDIT               | ✅    | ✅    | ❌     | ❌     |
| PROJECT_DELETE             | ✅    | ❌    | ❌     | ❌     |
| PROJECT_MANAGE_MEMBERS     | ✅    | ✅    | ❌     | ❌     |
| **DATA SOURCE**            |       |       |        |        |
| DATA_SOURCE_VIEW           | ✅    | ✅    | ✅     | ✅     |
| DATA_SOURCE_CREATE         | ✅    | ✅    | ❌     | ❌     |
| DATA_SOURCE_EDIT           | ✅    | ✅    | ❌     | ❌     |
| DATA_SOURCE_DELETE         | ✅    | ❌    | ❌     | ❌     |
| **DATA MODEL**             |       |       |        |        |
| DATA_MODEL_VIEW            | ✅    | ✅    | ✅     | ✅     |
| DATA_MODEL_CREATE          | ✅    | ✅    | ✅     | ❌     |
| DATA_MODEL_EDIT            | ✅    | ✅    | ✅     | ❌     |
| DATA_MODEL_DELETE          | ✅    | ❌    | ❌     | ❌     |
| DATA_MODEL_EXECUTE         | ✅    | ✅    | ✅     | ✅     |
| **DASHBOARD**              |       |       |        |        |
| DASHBOARD_VIEW             | ✅    | ✅    | ✅     | ✅     |
| DASHBOARD_CREATE           | ✅    | ✅    | ✅     | ❌     |
| DASHBOARD_EDIT             | ✅    | ✅    | ✅     | ❌     |
| DASHBOARD_DELETE           | ✅    | ❌    | ❌     | ❌     |
| DASHBOARD_SHARE            | ✅    | ✅    | ✅     | ❌     |

### Permission Constants

Defined in [`backend/src/constants/permissions.ts`](../backend/src/constants/permissions.ts):

```typescript
export enum Permission {
    // Project permissions
    PROJECT_VIEW = 'project:view',
    PROJECT_EDIT = 'project:edit',
    PROJECT_DELETE = 'project:delete',
    PROJECT_MANAGE_MEMBERS = 'project:manage_members',
    
    // Data source permissions
    DATA_SOURCE_VIEW = 'data_source:view',
    DATA_SOURCE_CREATE = 'data_source:create',
    DATA_SOURCE_EDIT = 'data_source:edit',
    DATA_SOURCE_DELETE = 'data_source:delete',
    
    // Data model permissions
    DATA_MODEL_VIEW = 'data_model:view',
    DATA_MODEL_CREATE = 'data_model:create',
    DATA_MODEL_EDIT = 'data_model:edit',
    DATA_MODEL_DELETE = 'data_model:delete',
    DATA_MODEL_EXECUTE = 'data_model:execute',
    
    // Dashboard permissions
    DASHBOARD_VIEW = 'dashboard:view',
    DASHBOARD_CREATE = 'dashboard:create',
    DASHBOARD_EDIT = 'dashboard:edit',
    DASHBOARD_DELETE = 'dashboard:delete',
    DASHBOARD_SHARE = 'dashboard:share',
}

export const ROLE_PERMISSIONS: Record<EProjectRole, Permission[]> = {
    [EProjectRole.OWNER]: [...Object.values(Permission)],
    [EProjectRole.ADMIN]: [/* 18 permissions */],
    [EProjectRole.EDITOR]: [/* 11 permissions */],
    [EProjectRole.VIEWER]: [/* 4 permissions */]
};
```

---

## Database Schema

### Tables

#### `dra_project_members`
Tracks project membership and roles.

```sql
CREATE TABLE dra_project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES dra_projects(id) ON DELETE CASCADE,
    users_platform_id INTEGER NOT NULL REFERENCES dra_users_platform(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP,
    invited_by_user_id INTEGER REFERENCES dra_users_platform(id),
    UNIQUE(project_id, users_platform_id)  -- One role per user per project
);

CREATE INDEX idx_project_members_project ON dra_project_members(project_id);
CREATE INDEX idx_project_members_user ON dra_project_members(users_platform_id);
```

**Columns:**
- `id`: Primary key
- `project_id`: Foreign key to dra_projects (CASCADE DELETE)
- `users_platform_id`: Foreign key to dra_users_platform (CASCADE DELETE)
- `role`: Enum ('owner', 'admin', 'editor', 'viewer')
- `added_at`: Timestamp when member was added
- `last_accessed_at`: Last time member accessed project (nullable)
- `invited_by_user_id`: Who invited this member (nullable for owners)

**Constraints:**
- Unique constraint on (project_id, users_platform_id) prevents duplicate memberships
- Cascade delete ensures cleanup when project or user is deleted

#### `dra_project_invitations`
Tracks pending email invitations.

```sql
CREATE TABLE dra_project_invitations (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES dra_projects(id) ON DELETE CASCADE,
    invited_email VARCHAR(320) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    verification_code_id INTEGER NOT NULL REFERENCES dra_verification_codes(id) ON DELETE CASCADE,
    invited_by_user_id INTEGER NOT NULL REFERENCES dra_users_platform(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    accepted_at TIMESTAMP
);

CREATE INDEX idx_project_invitations_project ON dra_project_invitations(project_id);
CREATE INDEX idx_project_invitations_email ON dra_project_invitations(invited_email);
CREATE INDEX idx_project_invitations_status ON dra_project_invitations(status);
```

**Columns:**
- `id`: Primary key
- `project_id`: Foreign key to dra_projects
- `invited_email`: Email address of invitee
- `role`: Role to assign when accepted (cannot be 'owner')
- `verification_code_id`: Foreign key to centralized token table
- `invited_by_user_id`: Who sent the invitation
- `created_at`: Invitation timestamp
- `expires_at`: Expiration timestamp (7 days default)
- `status`: Enum ('pending', 'accepted', 'expired', 'cancelled')
- `accepted_at`: Timestamp when invitation was accepted

**Relationships:**
- Uses centralized `dra_verification_codes` table for token management
- Tokens expire after 7 days
- Cascade delete when project is deleted

### TypeORM Models

#### DRAProjectMember
[`backend/src/models/DRAProjectMember.ts`](../backend/src/models/DRAProjectMember.ts)

```typescript
@Entity('dra_project_members')
@Unique(['project', 'user'])
export class DRAProjectMember {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Relation<DRAProject>;

    @ManyToOne(() => DRAUsersPlatform, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'users_platform_id' })
    user!: Relation<DRAUsersPlatform>;

    @Column({ type: 'enum', enum: EProjectRole })
    role!: EProjectRole;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    added_at!: Date;

    @Column({ type: 'timestamp', nullable: true })
    last_accessed_at!: Date | null;

    @ManyToOne(() => DRAUsersPlatform, { nullable: true })
    @JoinColumn({ name: 'invited_by_user_id' })
    invited_by!: Relation<DRAUsersPlatform> | null;
}
```

#### DRAProjectInvitation
[`backend/src/models/DRAProjectInvitation.ts`](../backend/src/models/DRAProjectInvitation.ts)

```typescript
@Entity('dra_project_invitations')
export class DRAProjectInvitation {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => DRAProject, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project!: Relation<DRAProject>;

    @Column({ type: 'varchar', length: 320 })
    invited_email!: string;

    @Column({ type: 'enum', enum: EProjectRole })
    role!: EProjectRole;

    @OneToOne(() => DRAVerificationCode, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'verification_code_id' })
    verification_code!: Relation<DRAVerificationCode>;

    @ManyToOne(() => DRAUsersPlatform)
    @JoinColumn({ name: 'invited_by_user_id' })
    invited_by!: Relation<DRAUsersPlatform>;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at!: Date;

    @Column({ type: 'timestamp' })
    expires_at!: Date;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status!: 'pending' | 'accepted' | 'expired' | 'cancelled';

    @Column({ type: 'timestamp', nullable: true })
    accepted_at!: Date | null;
}
```

---

## Backend Implementation

### RBACService

Singleton service managing all permission checks and member operations.

**Location:** [`backend/src/services/RBACService.ts`](../backend/src/services/RBACService.ts)

#### Key Methods

##### `getUserRole(userId, projectId)`
Retrieves user's role in a project.

```typescript
async getUserRole(userId: number, projectId: number): Promise<EProjectRole | null>
```

Returns: User's role or `null` if not a member.

##### `hasPermission(userId, projectId, permission)`
Checks if user has a specific permission.

```typescript
async hasPermission(
    userId: number,
    projectId: number,
    permission: Permission
): Promise<boolean>
```

**Flow:**
1. Query `dra_project_members` for user's role
2. Look up role's permissions in `ROLE_PERMISSIONS`
3. Return whether permission is included

##### `hasAnyPermission(userId, projectId, permissions[])`
Checks if user has any of the specified permissions (OR logic).

```typescript
async hasAnyPermission(
    userId: number,
    projectId: number,
    permissions: Permission[]
): Promise<boolean>
```

##### `hasAllPermissions(userId, projectId, permissions[])`
Checks if user has all of the specified permissions (AND logic).

```typescript
async hasAllPermissions(
    userId: number,
    projectId: number,
    permissions: Permission[]
): Promise<boolean>
```

##### `addMember(projectId, userId, role, invitedByUserId)`
Adds a member to a project.

```typescript
async addMember(
    projectId: number,
    userId: number,
    role: EProjectRole,
    invitedByUserId: number
): Promise<DRAProjectMember>
```

**Validations:**
- Requires `PROJECT_MANAGE_MEMBERS` permission
- Cannot add duplicate members (unique constraint)
- Creates member record with `invited_by` tracking

##### `updateMemberRole(projectId, memberUserId, newRole, updatedByUserId)`
Changes a member's role.

```typescript
async updateMemberRole(
    projectId: number,
    memberUserId: number,
    newRole: EProjectRole,
    updatedByUserId: number
): Promise<boolean>
```

**Validations:**
- Requires `PROJECT_MANAGE_MEMBERS` permission
- Cannot change owner role (protection)

##### `removeMember(projectId, memberUserId, removedByUserId)`
Removes a member from a project.

```typescript
async removeMember(
    projectId: number,
    memberUserId: number,
    removedByUserId: number
): Promise<boolean>
```

**Validations:**
- Requires `PROJECT_MANAGE_MEMBERS` permission
- Cannot remove owner (protection)

##### `getProjectMembers(projectId)`
Lists all members of a project.

```typescript
async getProjectMembers(projectId: number): Promise<DRAProjectMember[]>
```

Returns: Array of members with user and inviter details.

### Authorization Middleware

**Location:** [`backend/src/middleware/authorize.ts`](../backend/src/middleware/authorize.ts)

#### `authorize(...permissions)`
Express middleware factory for permission checking.

```typescript
function authorize(...permissions: Permission[]): RequestHandler
```

**Usage:**
```typescript
router.delete('/project/:projectId',
    validateJWT,
    authorize(Permission.PROJECT_DELETE),
    deleteProjectHandler
);

router.post('/data-model',
    validateJWT,
    authorize(Permission.DATA_MODEL_CREATE),
    createDataModelHandler
);
```

**Flow:**
1. Extract user ID from JWT (`req.body.tokenDetails.user_id`)
2. Extract project ID from request (see Project ID Extraction)
3. Check if user has any of the required permissions
4. If yes: continue to next middleware
5. If no: return `403 Forbidden`

#### Project ID Extraction

The middleware automatically extracts `project_id` from multiple sources:

1. **Direct parameters:** `req.params.projectId`, `req.params.project_id`
2. **Request body:** `req.body.projectId`, `req.body.project_id`
3. **Query string:** `req.query.projectId`, `req.query.project_id`
4. **Resource relations:**
   - From `data_model_id` → data_source → project
   - From `data_source_id` → project
   - From `dashboard_id` → project

This allows protecting routes like:
```typescript
// Direct project ID
DELETE /project/:projectId

// Resource ID (extracts project via relation)
DELETE /data-model/:data_model_id
DELETE /data-source/:data_source_id
DELETE /dashboard/:dashboard_id
```

### PermissionService (DELETE Enforcement)

**Location:** [`backend/src/services/PermissionService.ts`](../backend/src/services/PermissionService.ts)

**Purpose:** Provides the final enforcement layer for DELETE operations.

While `authorize()` middleware checks `ROLE_PERMISSIONS`, `PermissionService` provides an authoritative permission matrix that enforces owner-only deletion:

```typescript
private permissionMatrix: PermissionMatrix = {
    [EProjectRole.OWNER]: {
        [EAction.DELETE]: true,  // Only owners can delete
    },
    [EProjectRole.ADMIN]: {
        [EAction.DELETE]: false, // Admins CANNOT delete
    },
    [EProjectRole.EDITOR]: {
        [EAction.DELETE]: false,
    },
    [EProjectRole.VIEWER]: {
        [EAction.DELETE]: false,
    },
};
```

Routes use both layers:
1. `authorize()` middleware checks general permissions
2. `requireResourcePermission()` middleware enforces this matrix

---

## Frontend Implementation

### Project Store with RBAC

**Location:** [`frontend/stores/projects.ts`](../frontend/stores/projects.ts)

#### RBAC Data Validation

The store normalizes and validates RBAC data from API responses:

```typescript
function setProjects(projectsList: IProject[]) {
    // Normalize RBAC data
    projects.value = projectsList.map(project => ({
        ...project,
        is_owner: project.is_owner === true,  // Ensure boolean
        user_role: project.user_role || 'viewer',  // Default to least privilege
        members: project.members || []  // Initialize empty array
    }));
    
    if (import.meta.client) {
        localStorage.setItem('projects', JSON.stringify(projects.value));
        enableRefreshDataFlag('setProjects');
    }
}
```

**Key Validations:**
- `is_owner`: Normalized to boolean (prevents truthy values)
- `user_role`: Defaults to 'viewer' (principle of least privilege)
- `members`: Initialized to empty array if undefined

#### Data Access

Components should use the reactive ref directly:

```typescript
// ✅ CORRECT - Reactive data
const projectsList = projectsStore.projects;

// ❌ WRONG - Stale localStorage data
const projectsList = projectsStore.getProjects();
```

### TypeScript Interfaces

**Location:** [`frontend/types/`](../frontend/types/)

```typescript
interface IProject {
    id: number;
    name: string;
    description: string;
    creator_id: number;
    is_owner: boolean;  // Is current user the owner?
    user_role: 'owner' | 'admin' | 'editor' | 'viewer';  // Current user's role
    members?: IProjectMember[];  // All project members
    created_at: string;
    updated_at: string;
}

interface IProjectMember {
    id: number;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
    user: {
        id: number;
        first_name: string;
        last_name: string;
        email: string;
    };
    added_at: string;
    invited_by?: {
        id: number;
        first_name: string;
        last_name: string;
    };
}
```

### ProjectMembersDialog Component

**Location:** [`frontend/components/ProjectMembersDialog.vue`](../frontend/components/ProjectMembersDialog.vue)

Full-featured team management dialog with:

#### Features

1. **Member Invitation (Admin/Owner only)**
   - Email input with role selection
   - Sends invitation via API
   - Real-time success/error feedback

2. **Member List**
   - Shows all current members
   - Role badges with color coding:
     - 👑 Owner (red badge)
     - 👤 Admin (orange badge)
     - ✏️ Editor (blue badge)
     - 👁️ Viewer (teal badge)
   - Inline role editing (dropdown for non-owners)
   - Remove button (cannot remove owner)

3. **Pending Invitations (Admin/Owner only)**
   - Lists all pending invitations
   - Shows expiration date
   - Resend button (re-sends email)
   - Cancel button (revokes invitation)

4. **Real-time Updates**
   - Emits events on member changes
   - Parent component can refresh data
   - Optimistic UI updates

#### Props & Events

```typescript
interface Props {
    isOpen: boolean;
    projectId: number;
    members: IProjectMember[];
    userRole: 'owner' | 'admin' | 'editor' | 'viewer';
}

// Events
emit('close');
emit('member-added');
emit('member-removed');
emit('member-updated');
```

#### Computed Properties

```typescript
const canManageMembers = computed(() => 
    props.userRole === 'owner' || props.userRole === 'admin'
);
```

Only owners and admins see invitation and management controls.

### Project List with RBAC Controls

**Location:** [`frontend/pages/projects/index.vue`](../frontend/pages/projects/index.vue)

#### Role Badges

Each project card displays the user's role:

```vue
<span v-if="project.user_role === 'owner'" 
      class="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
    👑 Owner
</span>
<span v-else-if="project.user_role === 'admin'"
      class="text-xs bg-orange-100 text-orange-900 px-2 py-1 rounded">
    👤 Admin
</span>
<span v-else-if="project.user_role === 'editor'"
      class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
    ✏️ Editor
</span>
<span v-else
      class="text-xs bg-teal-50 text-teal-800 px-2 py-1 rounded">
    👁️ Viewer
</span>
```

#### Team Button

Only owners and admins see the team management button:

```vue
<button v-if="project.user_role === 'owner' || project.user_role === 'admin'"
        @click="openTeamDialog(project)"
        class="text-sm text-blue-600 hover:underline">
    👥 Team ({{ project.members?.length || 0 }})
</button>
```

#### Delete Button

Only owners can delete projects:

```vue
<button v-if="project.is_owner"
        @click="deleteProject(project.id)"
        class="text-red-600 hover:text-red-800">
    ❌ Delete
</button>
```

---

## Security Model

### Defense in Depth

The RBAC system uses multiple layers of security:

1. **Database Constraints**
   - Unique constraint prevents duplicate memberships
   - Cascade deletes maintain referential integrity
   - Role enum validates only allowed values
   - Foreign key constraints prevent orphaned records

2. **Service Layer Validation**
   - RBACService validates all operations
   - Cannot remove or change owner role
   - Permission checks before every operation
   - Transaction safety for atomic operations

3. **Middleware Authorization**
   - `authorize()` checks permissions on every route
   - Automatic project ID extraction
   - JWT validation via `validateJWT` middleware
   - Returns 403 for unauthorized access

4. **Dual Permission Enforcement**
   - `authorize()` middleware: General permission checks
   - `PermissionService`: Final DELETE enforcement
   - Owner-only deletion enforced at service layer

5. **Frontend Validation**
   - Store normalization prevents invalid data
   - UI hides controls based on role
   - Default to 'viewer' role (least privilege)
   - Reactive data prevents stale state

### Threat Model

#### Protected Against

✅ **Unauthorized Access**
- Non-members cannot access project resources
- Permission checks on every route
- JWT authentication required

✅ **Privilege Escalation**
- Cannot self-assign higher roles
- Cannot change owner role
- Cannot remove owner
- Member management requires admin/owner

✅ **Data Manipulation**
- Viewers cannot create/edit/delete
- Editors cannot delete or manage team
- Admins cannot delete resources
- Only owners can delete

✅ **Invitation Abuse**
- Tokens expire after 7 days
- One-time use tokens
- Email verification required
- Cannot invite as owner

✅ **Owner Lock-out**
- Owner cannot be removed
- Owner role cannot be changed
- Project always has exactly one owner

#### Not Protected Against

⚠️ **Owner Malice**
- Owner can delete entire project
- Owner can remove all members
- No audit log for owner actions

⚠️ **Email Spoofing**
- Invitation emails not signed
- Relies on SMTP security

⚠️ **Session Hijacking**
- JWT tokens not rotated
- No session invalidation on role change

### Best Practices

1. **Always Check Permissions**
   ```typescript
   router.post('/resource',
       validateJWT,
       authorize(Permission.RESOURCE_CREATE),  // Always use authorize()
       handler
   );
   ```

2. **Use Transactions for Multi-Step Operations**
   ```typescript
   await manager.transaction(async (transactionalManager) => {
       await transactionalManager.save(project);
       await transactionalManager.save(member);
   });
   ```

3. **Validate Frontend Data**
   ```typescript
   // Always normalize RBAC data
   is_owner: project.is_owner === true,  // Not ?? true
   user_role: project.user_role || 'viewer',  // Not || 'owner'
   ```

4. **Use Reactive Store Data**
   ```typescript
   // ✅ Reactive
   const projects = projectsStore.projects;
   
   // ❌ Stale
   const projects = projectsStore.getProjects();
   ```

5. **Hide UI Based on Permissions**
   ```vue
   <button v-if="canManageMembers" @click="invite">
       Invite Member
   </button>
   ```

---

## API Endpoints

### Project Members API

Base path: `/project/:projectId/members`

#### GET /project/:projectId/members
List all project members.

**Authorization:** Requires `PROJECT_VIEW` permission (all roles).

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "role": "owner",
            "added_at": "2025-01-01T00:00:00Z",
            "last_accessed_at": null,
            "user": {
                "id": 1,
                "first_name": "John",
                "last_name": "Doe",
                "email": "john@example.com"
            },
            "invited_by": null
        },
        {
            "id": 2,
            "role": "editor",
            "added_at": "2025-01-02T10:30:00Z",
            "user": {
                "id": 2,
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@example.com"
            },
            "invited_by": {
                "id": 1,
                "first_name": "John",
                "last_name": "Doe"
            }
        }
    ]
}
```

#### POST /project/:projectId/members
Add a member to the project.

**Authorization:** Requires `PROJECT_MANAGE_MEMBERS` permission (owner, admin).

**Request Body:**
```json
{
    "userId": 2,
    "role": "editor"
}
```

**Validations:**
- `userId` must be an integer
- `role` must be one of: 'viewer', 'editor', 'admin'
- User cannot already be a member (409 Conflict)

**Response:**
```json
{
    "success": true,
    "message": "Member added successfully",
    "data": {
        "id": 2,
        "role": "editor",
        "added_at": "2025-01-02T10:30:00Z",
        "user": { /* user object */ },
        "invited_by": { /* inviter object */ }
    }
}
```

#### PUT /project/:projectId/members/:userId
Update a member's role.

**Authorization:** Requires `PROJECT_MANAGE_MEMBERS` permission (owner, admin).

**Request Body:**
```json
{
    "role": "admin"
}
```

**Validations:**
- `role` must be one of: 'viewer', 'editor', 'admin'
- Cannot change owner role (400 Bad Request)

**Response:**
```json
{
    "success": true,
    "message": "Member role updated successfully"
}
```

#### DELETE /project/:projectId/members/:userId
Remove a member from the project.

**Authorization:** Requires `PROJECT_MANAGE_MEMBERS` permission (owner, admin).

**Validations:**
- Cannot remove owner (400 Bad Request)

**Response:**
```json
{
    "success": true,
    "message": "Member removed successfully"
}
```

#### GET /project/:projectId/my-role
Get current user's role in the project.

**Authorization:** Requires valid JWT.

**Response:**
```json
{
    "success": true,
    "data": {
        "role": "editor",
        "is_owner": false,
        "permissions": [
            "project:view",
            "data_model:view",
            "data_model:create",
            "data_model:edit",
            "data_model:execute",
            "dashboard:view",
            "dashboard:create",
            "dashboard:edit",
            "dashboard:share"
        ]
    }
}
```

### User Lookup API

#### POST /user/lookup-by-email
Find user by email address (for invitations).

**Authorization:** Requires valid JWT.

**Request Body:**
```json
{
    "email": "jane@example.com"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 2,
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@example.com",
        "is_verified": true
    }
}
```

If user not found:
```json
{
    "success": false,
    "message": "User not found"
}
```

---

## Usage Examples

### Backend: Protecting a Route

```typescript
import { Router } from 'express';
import { validateJWT } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { Permission } from '../constants/permissions.js';

const router = Router();

// Only owners can delete data sources
router.delete('/data-source/:data_source_id',
    validateJWT,
    authorize(Permission.DATA_SOURCE_DELETE),
    async (req, res) => {
        // User has permission, proceed with deletion
        const { data_source_id } = req.params;
        // ... deletion logic
    }
);

// Editors and above can create data models
router.post('/data-model',
    validateJWT,
    authorize(Permission.DATA_MODEL_CREATE),
    async (req, res) => {
        // User can create data models
        // ... creation logic
    }
);
```

### Backend: Manual Permission Check

```typescript
import { RBACService } from '../services/RBACService.js';
import { Permission } from '../constants/permissions.js';

async function canUserEditDashboard(userId: number, dashboardId: number) {
    const rbacService = RBACService.getInstance();
    
    // Get project ID from dashboard
    const dashboard = await getDashboard(dashboardId);
    const projectId = dashboard.project.id;
    
    // Check permission
    const hasPermission = await rbacService.hasPermission(
        userId,
        projectId,
        Permission.DASHBOARD_EDIT
    );
    
    return hasPermission;
}
```

### Backend: Adding Member with Transaction

```typescript
import { RBACService } from '../services/RBACService.js';
import { EProjectRole } from '../types/EProjectRole.js';

async function addProjectMember(
    projectId: number,
    newUserId: number,
    role: EProjectRole,
    invitedByUserId: number
) {
    const rbacService = RBACService.getInstance();
    
    try {
        const member = await rbacService.addMember(
            projectId,
            newUserId,
            role,
            invitedByUserId
        );
        
        console.log(`Added ${member.user.email} as ${role}`);
        return member;
    } catch (error) {
        console.error('Failed to add member:', error.message);
        throw error;
    }
}
```

### Frontend: Role-Based UI

```vue
<template>
    <div>
        <!-- All roles can view -->
        <h2>{{ project.name }}</h2>
        
        <!-- Editors and above can edit -->
        <button v-if="canEdit" @click="editProject">
            Edit Project
        </button>
        
        <!-- Admins and owners can manage team -->
        <button v-if="canManageTeam" @click="openTeamDialog">
            Manage Team
        </button>
        
        <!-- Only owners can delete -->
        <button v-if="isOwner" @click="deleteProject">
            Delete Project
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
    project: IProject
}>();

const isOwner = computed(() => props.project.is_owner);

const canEdit = computed(() => 
    ['owner', 'admin', 'editor'].includes(props.project.user_role)
);

const canManageTeam = computed(() => 
    ['owner', 'admin'].includes(props.project.user_role)
);
</script>
```

### Frontend: API Call with Error Handling

```typescript
import { useProjectsStore } from '~/stores/projects';

async function inviteMember(
    projectId: number,
    email: string,
    role: 'viewer' | 'editor' | 'admin'
) {
    try {
        const response = await $fetch(`/project/${projectId}/members`, {
            method: 'POST',
            body: { email, role },
            headers: {
                Authorization: `Bearer ${getToken()}`
            }
        });
        
        if (response.success) {
            // Refresh projects to get updated member list
            const projectsStore = useProjectsStore();
            await projectsStore.retrieveProjects();
            
            return { success: true, message: 'Invitation sent!' };
        }
    } catch (error: any) {
        if (error.statusCode === 403) {
            return { success: false, message: 'You do not have permission to invite members' };
        } else if (error.statusCode === 409) {
            return { success: false, message: 'User is already a member' };
        }
        return { success: false, message: 'Failed to send invitation' };
    }
}
```

---

## Testing

### Backend Tests

#### Unit Tests

**ProjectProcessor RBAC Tests** ([`backend/src/__tests__/processors/ProjectProcessor.rbac.test.ts`](../backend/src/__tests__/processors/ProjectProcessor.rbac.test.ts))

21 tests covering:
- Owner/admin/editor/viewer differentiation
- Multiple projects with different roles
- Data type validation for RBAC fields
- Edge cases (null/undefined handling)

**RBACService Tests**
- Permission checking logic
- Role hierarchy enforcement
- Member management operations
- Edge cases (missing users, invalid roles)

**Authorization Middleware Tests** ([`backend/src/__tests__/middleware/authorize.integration.test.ts`](../backend/src/__tests__/middleware/authorize.integration.test.ts))

11 integration tests covering:
- Permission checking with real database
- Project ID extraction from various sources
- 403 response on insufficient permissions
- Multiple permission checks (ANY/ALL logic)

#### Running Backend Tests

```bash
cd backend

# Run all RBAC tests
npm test -- ProjectProcessor.rbac
npm test -- RBACService
npm test -- authorize.integration

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- -t "should return is_owner true for project owner"
```

### Frontend Tests

**Projects Store RBAC Tests** ([`frontend/tests/stores/projects.rbac.test.ts`](../frontend/tests/stores/projects.rbac.test.ts))

12 tests covering:
- `is_owner` normalization to boolean
- `user_role` default to 'viewer'
- `members` array initialization
- Edge cases (missing fields, invalid data)

#### Running Frontend Tests

```bash
cd frontend

# Run RBAC tests
npm test -- projects.rbac

# Run all tests
npm test

# Run with UI
npm test -- --ui
```

### Manual Testing Checklist

#### Project Creation
- [ ] New project creates owner member entry
- [ ] Owner role assigned to creator
- [ ] Owner can see all controls

#### Member Invitation
- [ ] Admin can invite members
- [ ] Editor cannot invite members
- [ ] Invitation email sent
- [ ] Token expires after 7 days
- [ ] Accepted invitation creates member record

#### Permission Enforcement
- [ ] Viewer cannot create/edit/delete
- [ ] Editor can create/edit but not delete
- [ ] Admin can manage team but not delete resources
- [ ] Owner can do everything

#### Role Management
- [ ] Admin can change member roles
- [ ] Cannot change owner role
- [ ] Cannot remove owner
- [ ] Role changes reflected immediately

#### UI Controls
- [ ] Role badges display correctly
- [ ] Team button shows for admin/owner only
- [ ] Delete button shows for owner only
- [ ] Invitation form shows for admin/owner only

---

## Migration Guide

### Upgrading Existing Projects

If you have existing projects without RBAC data:

#### Step 1: Run Migrations

```bash
cd backend
npm run migration:run
```

This creates the `dra_project_members` and `dra_project_invitations` tables.

#### Step 2: Backfill Member Entries

Run the migration that creates member entries for existing projects:

```bash
npm run migration:run  # Runs AddMissingProjectMembers
```

This automatically:
- Finds all projects without member entries
- Creates owner member entry for project creator
- Sets role to 'owner'
- Timestamps with current date

#### Step 3: Verify Migration

```bash
docker-compose exec database.dataresearchanalysis.test psql -U postgres -d postgres_dra_db -c \
  "SELECT p.id, p.name, pm.role, u.email 
   FROM dra_projects p 
   LEFT JOIN dra_project_members pm ON p.id = pm.project_id 
   LEFT JOIN dra_users_platform u ON pm.users_platform_id = u.id 
   ORDER BY p.id;"
```

All projects should have at least one owner member.

#### Step 4: Restart Services

```bash
docker-compose restart backend.dataresearchanalysis.test
docker-compose restart frontend.dataresearchanalysis.test
```

### Rollback Procedure

If you need to rollback the RBAC implementation:

```bash
cd backend

# Revert migrations
npm run migration:revert  # Revert AddMissingProjectMembers
npm run migration:revert  # Revert AddProjectRBAC

# Restart services
docker-compose restart backend.dataresearchanalysis.test
```

**Note:** Rollback will delete all member and invitation data. Project data is preserved.

### Data Integrity

The migration ensures:
- ✅ No data loss (existing projects unchanged)
- ✅ All projects have owner entries
- ✅ Referential integrity maintained
- ✅ Backward compatible (API still works)

---

## Troubleshooting

### Common Issues

#### 403 Forbidden Errors

**Symptom:** API returns 403 even though user should have access.

**Causes:**
1. User not a member of project
2. User has insufficient role
3. Missing JWT token

**Solution:**
```bash
# Check user's membership
SELECT pm.role, u.email, p.name 
FROM dra_project_members pm
JOIN dra_users_platform u ON pm.users_platform_id = u.id
JOIN dra_projects p ON pm.project_id = p.id
WHERE u.id = <user_id> AND p.id = <project_id>;
```

#### RBAC Controls Not Showing

**Symptom:** Role badges or team button not displayed in frontend.

**Causes:**
1. Frontend using stale localStorage data
2. API not returning RBAC data
3. Store validation issues

**Solution:**
```typescript
// Clear localStorage and refresh
localStorage.removeItem('projects');
location.reload();

// Check API response
const projects = await $fetch('/project/list');
console.log(projects[0].is_owner, projects[0].user_role, projects[0].members);
```

#### Cannot Remove Member

**Symptom:** 400 error when trying to remove member.

**Causes:**
1. Trying to remove owner (protected)
2. Insufficient permissions

**Solution:**
```sql
-- Check member's role
SELECT role FROM dra_project_members 
WHERE project_id = <project_id> AND users_platform_id = <user_id>;

-- If owner, cannot remove
```

#### Invitation Not Received

**Symptom:** User doesn't receive invitation email.

**Causes:**
1. SMTP not configured
2. Email in spam folder
3. Token expired

**Solution:**
```bash
# Check SMTP configuration
env | grep EMAIL

# Check invitation record
SELECT * FROM dra_project_invitations 
WHERE invited_email = '<email>' 
ORDER BY created_at DESC LIMIT 1;
```

---

## Future Enhancements

### Planned Features

1. **Custom Roles**
   - Allow creating custom roles with selected permissions
   - Save role templates
   - Share role definitions across projects

2. **Bulk Operations**
   - Invite multiple users via CSV import
   - Bulk role changes
   - Bulk member removal

3. **Audit Log**
   - Track all permission changes
   - Log member additions/removals
   - Export audit trail

4. **Advanced Invitations**
   - Public invite links
   - Link expiration customization
   - Limit number of uses per link

5. **Team Management**
   - Sub-teams within projects
   - Resource-level permissions (per dashboard/model)
   - Temporary access grants

6. **Notifications**
   - Email on role change
   - Email on member removal
   - Activity digest emails

### API Extensions

Potential new endpoints:

```
POST   /project/:id/members/bulk          # Bulk add members
POST   /project/:id/invite-link           # Generate public link
GET    /project/:id/audit-log             # Get permission changes
POST   /project/:id/transfer-ownership    # Transfer owner role
GET    /user/projects/shared-with-me      # Projects where I'm not owner
```

---

## References

### Key Files

**Backend:**
- [`backend/src/constants/permissions.ts`](../backend/src/constants/permissions.ts) - Permission definitions
- [`backend/src/services/RBACService.ts`](../backend/src/services/RBACService.ts) - Core RBAC logic
- [`backend/src/middleware/authorize.ts`](../backend/src/middleware/authorize.ts) - Authorization middleware
- [`backend/src/services/PermissionService.ts`](../backend/src/services/PermissionService.ts) - DELETE enforcement
- [`backend/src/routes/project_members.ts`](../backend/src/routes/project_members.ts) - Member API routes
- [`backend/src/models/DRAProjectMember.ts`](../backend/src/models/DRAProjectMember.ts) - Member model
- [`backend/src/models/DRAProjectInvitation.ts`](../backend/src/models/DRAProjectInvitation.ts) - Invitation model

**Frontend:**
- [`frontend/stores/projects.ts`](../frontend/stores/projects.ts) - Project store with RBAC
- [`frontend/components/ProjectMembersDialog.vue`](../frontend/components/ProjectMembersDialog.vue) - Team management UI
- [`frontend/pages/projects/index.vue`](../frontend/pages/projects/index.vue) - Project list with RBAC controls

**Tests:**
- [`backend/src/__tests__/processors/ProjectProcessor.rbac.test.ts`](../backend/src/__tests__/processors/ProjectProcessor.rbac.test.ts) - 21 backend tests
- [`frontend/tests/stores/projects.rbac.test.ts`](../frontend/tests/stores/projects.rbac.test.ts) - 12 frontend tests

### Related Documentation

- [Comprehensive Architecture Documentation](comprehensive-architecture-documentation.md)
- [SSR Quick Reference](ssr-quick-reference.md)
- [Security Implementation](../SECURITY.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

**Document Version:** 1.0  
**Last Updated:** January 17, 2026  
**Maintained By:** Data Research Analysis Team
