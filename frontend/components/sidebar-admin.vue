<script setup lang="ts">
const route = useRoute();
const router = useRouter();

interface SubMenu {
    id: number
    name: string
    path: string
}
interface MenuItem {
    id: number
    menu_name: string
    show_menu: boolean
    sub_menus: SubMenu[]
}
interface State {
    menu_items: MenuItem[]
}
const state = reactive<State>({
    menu_items: [
        {
            id: 1,
            menu_name: 'Subscription Tiers',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Manage Tiers', path: '/admin/subscription-tiers' },
            ],
        },
        {
            id: 2,
            menu_name: 'Subscription Management',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Downgrade Requests', path: '/admin/downgrade-requests' },
                { id: 2, name: 'Promo Codes', path: '/admin/promo-codes' },
            ],
        },
        {
            id: 3,
            menu_name: 'Organizations',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'List Organizations', path: '/admin/organizations' },
            ],
        },
        {
            id: 4,
            menu_name: 'Enterprise Inquiries',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'List Enterprise Inquiries', path: '/admin/enterprise-queries' },
                { id: 2, name: 'Contact Requests', path: '/admin/enterprise-contact-requests' },
            ],
        },
        {
            id: 5,
            menu_name: 'User Management',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Add User', path: '/admin/users/create' },
                { id: 2, name: 'List Users', path: '/admin/users' },
            ],
        },
        {
            id: 6,
            menu_name: 'Articles Management',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Add Article', path: '/admin/articles/create' },
                { id: 2, name: 'List Articles', path: '/admin/articles' },
                { id: 3, name: 'List Categories', path: '/admin/articles/categories' },
            ],
        },
        {
            id: 11,
            menu_name: 'Lead Generators',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Add Lead Generator', path: '/admin/lead-generators/create' },
                { id: 2, name: 'List Lead Generators', path: '/admin/lead-generators' },
            ],
        },
        {
            id: 7,
            menu_name: 'Sitemap Manager',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Add New URL', path: '/admin/sitemap/create' },
                { id: 2, name: 'List Sitemap Entries', path: '/admin/sitemap' },
            ],
        },
        {
            id: 8,
            menu_name: 'Database Management',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Database Dashboard', path: '/admin/database' },
                { id: 2, name: 'Create Backup', path: '/admin/database/backup' },
                { id: 3, name: 'Restore Database', path: '/admin/database/restore' },
                { id: 4, name: 'Scheduled Backups', path: '/admin/database/scheduled-backups' },
            ],
        },
        {
            id: 9,
            menu_name: 'Platform Settings',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'Manage Settings', path: '/admin/platform-settings' },
            ],
        },
        {
            id: 10,
            menu_name: 'Account Cancellations',
            show_menu: true,
            sub_menus: [
                { id: 1, name: 'View Cancellations', path: '/admin/account-cancellations' },
            ],
        },
    ],
})
const props = defineProps<Record<string, never>>();
function toggleMenuItem(menuItem: MenuItem): void {
    menuItem.show_menu = !menuItem.show_menu;
}
</script>
<template>
    <aside class="flex flex-col bg-primary-blue-300 text-white shrink-0 transition-all duration-300 overflow-hidden w-64 min-h-150">
        <!-- Header -->
        <div class="border-b border-primary-blue-400 flex items-center px-4 py-5 justify-between">
            <div class="min-w-0 flex-1">
                <p class="text-xs uppercase tracking-widest text-blue-200 mb-1">Admin</p>
                <h2 class="text-sm font-semibold text-white">Admin Panel</h2>
            </div>
            <div class="flex items-center justify-center w-7 h-7 rounded bg-primary-blue-400 shrink-0">
                <font-awesome-icon :icon="['fas', 'user-shield']" class="w-3.5 h-3.5" />
            </div>
        </div>
        
        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto py-3">
            <div v-for="menu in state.menu_items" :key="menu.id" class="mb-1">
                <!-- Expandable Section Header -->
                <button
                    @click="toggleMenuItem(menu)"
                    type="button"
                    class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-blue-100 hover:bg-primary-blue-400 hover:text-white transition-colors cursor-pointer"
                >
                    <font-awesome-icon 
                        :icon="['fas', menu.show_menu ? 'chevron-down' : 'chevron-right']" 
                        class="w-3 h-3 shrink-0" 
                    />
                    <span class="flex-1 text-left truncate" v-tippy="{ content: menu.menu_name, placement: 'right' }">
                        {{ menu.menu_name }}
                    </span>
                </button>
                
                <!-- Submenu Items -->
                <div v-if="menu.show_menu" class="ml-9 mt-0.5">
                    <NuxtLink
                        v-for="subMenu in menu.sub_menus"
                        :key="subMenu.path"
                        :to="subMenu.path"
                        class="block py-2 px-4 text-sm text-blue-100 hover:bg-primary-blue-400 hover:text-white transition-colors"
                    >
                        <span class="truncate" v-tippy="{ content: subMenu.name }">
                            {{ subMenu.name }}
                        </span>
                    </NuxtLink>
                </div>
            </div>
        </nav>
    </aside>
</template>