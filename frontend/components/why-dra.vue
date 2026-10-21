<script setup lang="ts">
</script>
<template>
    <div>
        <div class="bg-primary-blue-100 w-full h-full py-10 px-6">
            <div class="max-w-7xl mx-auto flex flex-col items-center">
                <h2 class="font-bold text-white text-center text-4xl mb-16 pt-5">
                    From guesswork to a channel-by-channel plan
                </h2>

                <!-- Feature Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full mb-16">
                    <!-- Feature 1 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-wand-magic-sparkles" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">AI Paid Media Plan Builder</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Point the AI at your website and it builds a channel-by-channel plan: where to spend, how much, and what to create.
                        </p>
                    </div>

                    <!-- Feature 2 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-scale-balanced" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Channel-by-Channel Budgets</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Every channel gets a recommended budget and targets, so spend follows the plan — not last month's gut feel.
                        </p>
                    </div>

                    <!-- Feature 3 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-clipboard-list" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Campaign Playbook</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Know what to create before you launch — offers, audiences, and formats for each channel.
                        </p>
                    </div>

                    <!-- Feature 4 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                         <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-chart-line" />
                         </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Live Campaign Tracking</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Connect Google Ads, Meta, and Analytics — then watch your plan's campaigns perform in real time.
                        </p>
                    </div>

                    <!-- Feature 5 -->
                     <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-triangle-exclamation" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Wasted-Spend Signals</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            AI flags underperforming campaigns and channels so you shift budget to what actually works.
                        </p>
                    </div>

                    <!-- Feature 6 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition duration-300 transform hover:-translate-y-1">
                        <div class="text-3xl text-primary-blue-100 mb-4">
                            <font-awesome icon="fas fa-users" />
                        </div>
                        <h3 class="text-xl font-bold text-primary-blue-100 mb-2">Built for Marketing Teams</h3>
                        <p class="text-primary-blue-100/80 leading-relaxed font-medium">
                            Made for CMOs and digital marketing teams. No spreadsheets, no guesswork — a defensible plan in minutes.
                        </p>
                    </div>
                </div>

                 <div class="flex flex-col w-full md:w-1/3 mb-5 pb-5">
                    <combo-button label="See Plans & Pricing" color="white" class="w-full h-12 shadow-lg cursor-pointer" @click="gotoJoinPricing()"/>
                </div>
            </div>
        </div>
    </div>
</template>
