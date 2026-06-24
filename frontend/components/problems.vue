<script setup lang="ts">
</script>
<template>
    <div>
        <div class="bg-white w-full h-full">
            <div class="flex flex-col h-full py-10 max-w-7xl mx-auto px-6">
                <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-16 px-4">
                    7 Problems Holding Your Marketing Back
                </h2>

                <!-- Problems Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 w-full mb-16">
                    <!-- Problem 1: MarTech Stack Mess -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-primary-blue-100 text-3xl">
                            <font-awesome icon="fas fa-database" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">The MarTech Stack Mess</h3>
                        <p class="text-gray-600 leading-relaxed">
                            53% of marketing leaders see their tools as a barrier to alignment. You have no way to see the full picture without opening 10 tabs.
                        </p>
                    </div>

                    <!-- Problem 2: ROI Proof Gap -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500 text-3xl">
                            <font-awesome icon="fas fa-chart-pie" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">The ROI Proof Gap</h3>
                        <p class="text-gray-600 leading-relaxed">
                            You can't connect spend to revenue because the infrastructure is missing. Your dashboards show success but the bank account is flat.
                        </p>
                    </div>

                    <!-- Problem 3: Strategic Velocity Gap -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-6 text-purple-500 text-3xl">
                            <font-awesome icon="fas fa-gauge-high" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">The Strategic Velocity Gap</h3>
                        <p class="text-gray-600 leading-relaxed">
                            Legacy tools carry a 48-hour reporting lag. By the time you see the data, your competitors have already pivoted.
                        </p>
                    </div>

                    <!-- Problem 4: Executive Trust Gap -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mb-6 text-amber-500 text-3xl">
                            <font-awesome icon="fas fa-handshake" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">The Executive Trust Gap</h3>
                        <p class="text-gray-600 leading-relaxed">
                            The CEO sees a dashboard full of green arrows but the bank account tells a different story. Trust erodes fast.
                        </p>
                    </div>

                    <!-- Problem 5: Invisible Drain -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-6 text-orange-500 text-3xl">
                            <font-awesome icon="fas fa-hourglass-half" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">The Invisible Drain</h3>
                        <p class="text-gray-600 leading-relaxed">
                            Your team spends 80% of their time <i>finding</i> data and manual reporting instead of optimizing campaigns. That is 400 hours a year lost.
                        </p>
                    </div>

                    <!-- Problem 6: Technical Translation Trap -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-6 text-teal-500 text-3xl">
                            <font-awesome icon="fas fa-headset" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">The Technical Translation Trap</h3>
                        <p class="text-gray-600 leading-relaxed">
                            CMOs are playing IT support for broken dashboards instead of driving strategy. You should not need a data scientist to get a report.
                        </p>
                    </div>

                    <!-- Problem 7: Exhaustion Wall -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-500 text-3xl">
                            <font-awesome icon="fas fa-bolt" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">The Exhaustion Wall</h3>
                        <p class="text-gray-600 leading-relaxed">
                            Talent burnout is caused by data drudgery, not workload. Your best people leave because they are drowning in spreadsheets, not strategy.
                        </p>
                    </div>
                </div>
                
                <!-- The Cost (Agitation) -->
                <div class="bg-primary-blue-100 rounded-2xl p-10 text-center text-white shadow-2xl max-w-4xl mx-auto">
                    <h2 class="font-bold text-3xl mb-4">The Cost of Guessing</h2>
                    <p class="text-lg opacity-90 max-w-2xl mx-auto mb-8">
                        In a cut-throat market, guessing is expensive. It costs you market share, budget, and your peace of mind.
                    </p>
                    <div class="w-full md:w-1/3 mx-auto">
                         <combo-button label="Solve These Problems" color="white" class="w-full h-12 shadow-lg cursor-pointer text-primary-blue-100" @click="gotoJoinPricing()"/>
                    </div>
                </div>
            </div> 
        </div>
    </div>
</template>