<script setup lang="ts">
/**
 * Stub page for deprecated /marketing/campaigns route.
 *
 * This route is intercepted by `00a-redirectOldRoutes.global.ts` middleware
 * and redirected to /intelligence#campaigns. The page exists only so Nuxt
 * generates a route entry that the middleware can match against.
 *
 * TICKET NAV-003: Kill Orphaned Pages — Redirect & Deprecate
 * Deprecation schedule: delete 2 sprints after deployment.
 */
definePageMeta({ layout: 'project' });
</script>

<template>
    <!-- Intentionally empty — the middleware redirects before this renders. -->
    <div />
</template>