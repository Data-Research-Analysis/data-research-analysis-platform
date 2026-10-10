<script setup lang="ts">
/**
 * Catch-all route for unmatched URLs.
 *
 * Without this, the global authorization middleware treated every unknown path
 * as a protected route and redirected anonymous visitors to /login (a soft-404
 * that wastes crawl budget and creates near-duplicate signals). This page throws
 * a real HTTP 404 so search engines see an honest status code.
 *
 * Note: the auth middleware returns early for the catch-all route so it renders
 * instead of redirecting to /login.
 */
throw createError({
    statusCode: 404,
    statusMessage: 'Page Not Found',
    fatal: true,
})
</script>

<template>
    <div />
</template>
