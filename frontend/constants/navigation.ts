/**
 * Navigation structure definitions for the project sidebar.
 * Centralises labels, icons, routes and role gates so both the sidebar
 * component and any programmatic navigation helpers share one source of truth.
 */

export type NavRole = 'owner' | 'manager' | 'analyst' | 'viewer';

export interface NavLeafItem {
    /** Unique id – also used as the localStorage expand key */
    id: string;
    /** Display label */
    label: string;
    /** Font-Awesome icon name (fas family) */
    icon: string;
    /**
     * Either a route suffix appended to `/projects/:projectid` **or**
     * a function receiving `projectId` and returning a full path.
     */
    route: string | ((projectId: number) => string);
    /** If true the item is only visible when the section is expanded. */
    child?: boolean;
    /** Minimum role required. Omit ⇒ visible to everyone. */
    role?: NavRole;
    /** Tooltip shown when sidebar is collapsed (icon-only mode) */
    collapsedTip?: string;
}

export interface NavSection {
    id: string;
    label: string;
    icon: string;
    /** Sections with `collapsible: true` render an expand/collapse chevron */
    collapsible: boolean;
    /** Whether the section is expanded by default on first visit */
    defaultExpanded: boolean;
    /** The children of this section. Empty array ⇒ single top-level link */
    children: NavLeafItem[];
    /** Minimum role required for the whole section */
    role?: NavRole;
    /** Tooltip shown when sidebar is collapsed */
    collapsedTip?: string;
    /** Route suffix for sections that also serve as a direct link */
    route?: string | ((projectId: number) => string);
}

// ─── Intelligence Hub sub-items ──────────────────────────────────────────

const intelligenceHubChildren: NavLeafItem[] = [
    {
        id: 'ih-overview',
        label: 'Overview',
        icon: 'chart-pie',
        route: (pid) => `/projects/${pid}/intelligence`,
        child: true,
    },
    {
        id: 'ih-campaigns',
        label: 'Campaigns',
        icon: 'bullhorn',
        route: (pid) => `/projects/${pid}/intelligence#campaigns`,
        child: true,
    },
    {
        id: 'ih-attribution',
        label: 'Attribution',
        icon: 'route',
        route: (pid) => `/projects/${pid}/intelligence#attribution`,
        child: true,
    },
    {
        id: 'ih-reports',
        label: 'Reports',
        icon: 'file-lines',
        route: (pid) => `/projects/${pid}/intelligence#reports`,
        child: true,
    },
    {
        id: 'ih-insights',
        label: 'AI Insights',
        icon: 'robot',
        route: (pid) => `/projects/${pid}/intelligence#insights`,
        child: true,
    },
];

// ─── Data sub-items ─────────────────────────────────────────────────────

const dataChildren: NavLeafItem[] = [
    {
        id: 'data-connections',
        label: 'Connections',
        icon: 'plug',
        route: (pid) => `/projects/${pid}/data-sources`,
        child: true,
        role: 'analyst',
    },
    {
        id: 'data-models',
        label: 'Models',
        icon: 'diagram-project',
        route: (pid) => `/projects/${pid}/data-models`,
        child: true,
        role: 'analyst',
    },
    {
        id: 'data-quality',
        label: 'Quality',
        icon: 'shield-check',
        route: (pid) => `/projects/${pid}/data-models`,
        child: true,
        role: 'analyst',
    },
];

// ─── Full sidebar navigation definition ─────────────────────────────────

export const SIDEBAR_NAV: NavSection[] = [
    {
        id: 'intelligence-hub',
        label: 'Intelligence Hub',
        icon: 'brain',
        collapsible: true,
        defaultExpanded: true,
        role: 'manager',
        collapsedTip: 'Intelligence Hub',
        route: (pid) => `/projects/${pid}/intelligence`,
        children: intelligenceHubChildren,
    },
    {
        id: 'dashboards',
        label: 'Dashboards',
        icon: 'table-columns',
        collapsible: false,
        defaultExpanded: false,
        collapsedTip: 'Dashboards',
        route: (pid) => `/projects/${pid}/dashboards`,
        children: [],
    },
    {
        id: 'data',
        label: 'Data',
        icon: 'database',
        collapsible: true,
        defaultExpanded: false,
        role: 'analyst',
        collapsedTip: 'Data',
        children: dataChildren,
    },
    {
        id: 'settings',
        label: 'Project Settings',
        icon: 'gear',
        collapsible: false,
        defaultExpanded: false,
        role: 'owner',
        collapsedTip: 'Project Settings',
        route: (pid) => `/projects/${pid}/settings`,
        children: [],
    },
];