<script setup lang="ts">
useHead({
    title: 'Scheduled Backups - Database Management - Admin | Data Research Analysis',
    meta: [
        { name: 'robots', content: 'noindex, nofollow' }
    ]
});
</script>

<template>
    <div class="flex flex-row">
        <sidebar-admin
            class="w-1/6"
            :activeLink="10"
        />
        <div class="w-5/6">
            <div class="min-h-100 flex flex-col ml-4 mr-4 mb-10 md:ml-10 md:mr-10 mt-5">
                <!-- Page Header -->
                <div class="mb-6">
                    <h1 class="text-3xl font-bold text-gray-900">Scheduled Database Backups</h1>
                    <p class="mt-2 text-gray-600">
                        Manage automated database backup schedules and view backup history
                    </p>
                </div>

                <!-- Scheduled Backup Control Component -->
                <ScheduledBackupControl />
            </div>
        </div>
    </div>
</template>
