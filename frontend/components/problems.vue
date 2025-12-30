<script setup>
</script>
<template>
    <div>
        <div class="bg-white w-full h-full">
            <div class="flex flex-col h-full pt-16 pb-20 max-w-7xl mx-auto px-6">
                <h1 class="font-bold text-primary-blue-100 text-center text-4xl mb-16 px-4">
                    The 3 Bottlenecks Killing Your Campaign Performance
                </h1>

                <!-- Problems Grid -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 w-full mb-16">
                    <!-- Problem 1 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-primary-blue-100 text-3xl">
                            <font-awesome icon="fas fa-database" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">Data Trapped in Silos</h3>
                        <p class="text-gray-600 leading-relaxed">
                            Data scattered across Google Ads, Analytics, and SQL. You have no way to see the full picture without opening 10 tabs.
                        </p>
                    </div>

                    <!-- Problem 2 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                        <div class="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mb-6 text-orange-500 text-3xl">
                             <font-awesome icon="fas fa-hourglass-half" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">Team Is Exhausted</h3>
                        <p class="text-gray-600 leading-relaxed">
                            Your team spends 80% of their time <i>finding</i> data and manual reporting, instead of strategizing and optimizing campaigns.
                        </p>
                    </div>

                    <!-- Problem 3 -->
                    <div class="bg-white p-8 rounded-xl shadow-lg border border-gray-100 flex flex-col items-center text-center transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                         <div class="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500 text-3xl">
                            <font-awesome icon="fas fa-chart-pie" />
                        </div>
                        <h3 class="font-bold text-xl text-primary-blue-100 mb-4">Unsure of True ROI</h3>
                        <p class="text-gray-600 leading-relaxed">
                            Can't prove the value of your campaigns to the CEO? You feel unsure because you can't connect ad spend to sales data.
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
                         <combo-button label="Join Our Private Beta" color="white" class="w-full h-12 shadow-lg cursor-pointer text-primary-blue-100" @click="gotoJoinPrivateBeta()"/>
                    </div>
                </div>
            </div> 
        </div>
    </div>
</template>