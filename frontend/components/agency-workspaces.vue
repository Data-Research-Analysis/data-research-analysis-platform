<template>
    <section class="bg-white w-full py-20 px-6">
        <div class="max-w-6xl mx-auto">
            <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">
                Run every client from one workspace
            </h2>
            <p class="text-primary-blue-100/70 text-center text-lg mb-16 max-w-2xl mx-auto">
                Multi-client structure built for agency teams — not a single-brand tool with clients bolted on.
            </p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="bg-gray-50 rounded-xl p-8 border border-gray-100">
                    <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-building" /></div>
                    <h3 class="text-xl font-bold text-primary-blue-100 mb-2">One workspace per agency, one project per client</h3>
                    <p class="text-gray-600">Keep each client's plans, connections, dashboards, and reports in their own project, while your team shares one workspace and one credit pool.</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-8 border border-gray-100">
                    <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-palette" /></div>
                    <h3 class="text-xl font-bold text-primary-blue-100 mb-2">White-labeled client reporting</h3>
                    <p class="text-gray-600">Put your agency's brand on public dashboards and reports, share a live link with the client, and skip the screenshot trail at renewal time.</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-8 border border-gray-100">
                    <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-users-gear" /></div>
                    <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Roles for the whole team</h3>
                    <p class="text-gray-600">Owner, admin, editor, and viewer roles at the workspace level, plus project analyst, manager, and CMO roles — so account managers and specialists each see what they need.</p>
                </div>
                <div class="bg-gray-50 rounded-xl p-8 border border-gray-100">
                    <div class="text-3xl text-primary-blue-100 mb-4"><font-awesome icon="fas fa-arrow-right-arrow-left" /></div>
                    <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Clean client handoff</h3>
                    <p class="text-gray-600">Export the deck and plan pack, share a live dashboard, and hand the client a versioned record of what was planned versus what was delivered.</p>
                </div>
            </div>
            <div class="flex justify-center mt-12">
                <div class="w-64">
                    <combo-button label="Build a free client plan" color="primary" class="w-full h-12 shadow-lg cursor-pointer" @click="scrollToPlanBuilder()" />
                </div>
            </div>
        </div>
    </section>
</template>
