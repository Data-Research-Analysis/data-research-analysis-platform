<script setup>
</script>
<template>
    <div>
        <div class="bg-primary-blue-100 w-full h-full py-10 px-6">
            <div class="max-w-7xl mx-auto flex flex-col items-center">
                <h2 class="font-bold text-white text-center text-4xl mb-16 pt-5">
                    Turn Your Data into Your Competitive Advantage
                </h2>

                <!-- Feature Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full mb-16">
                    <!-- Feature 1 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-laptop-code" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">No-Code Data Platform</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Stop wrestling with complex tools. Build meaningful reports without writing a single line of SQL.
                        </p>
                    </div>

                    <!-- Feature 2 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-layer-group" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Unified Marketing Analytics</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Connect Google Ads, GA4, and Ad Manager in one view. Break down data silos instantly.
                        </p>
                    </div>

                    <!-- Feature 3 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-stopwatch" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Real-Time ROI Tracking</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Monitor campaign performance as it happens. Pivot budget instantly to maximize ROAS.
                        </p>
                    </div>

                    <!-- Feature 4 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                         <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-robot" />
                         </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI-Driven Data Insights</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Ask your data questions in plain English. Get instant, CEO-ready answers from our specific AI agents.
                        </p>
                    </div>

                    <!-- Feature 5 -->
                     <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-globe" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Market Intelligence</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Layer public datasets over your private data. Spot trends before your competitors do.
                        </p>
                    </div>

                    <!-- Feature 6 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-bolt" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Instant Onboarding</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Skip the expensive certifications. Our intuitive interface is built for marketers, not data scientists.
                        </p>
                    </div>
                </div>

                 <div class="flex flex-col w-full md:w-1/3 mb-5 pb-5">
                    <combo-button label="Join Our Private Beta" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="gotoJoinPrivateBeta()"/>
                </div>
            </div>
        </div>
    </div>
</template>