<script setup>
</script>
<template>
    <div class="bg-white w-full h-full py-10">
        <div class="flex flex-col w-3/4 m-auto">
            <h1 class="font-bold text-primary-blue-100 text-center text-4xl mb-5">
                Talk To Your Own Private Data Analyst
            </h1>
            <div class="text-xl text-primary-blue-100 text-center mb-16 max-w-2xl m-auto">
                Your Personal Data Analyst, Available 24/7. No more waiting queries. Just ask.
            </div>

            <div class="flex flex-col lg:flex-row gap-10 items-center">
                <!-- Left: Copy -->
                <div class="lg:w-1/2 flex flex-col gap-6 text-lg text-primary-blue-100">
                    <p class="font-bold text-2xl">
                        "Speak to Your Data. Get Answers Instantly."
                    </p>
                    <p>
                        Imagine having a senior data analyst sitting next to you, ready to answer any question instantly. That’s the AI Data Modeler.
                    </p>
                    <ul class="list-disc ml-5 gap-2 flex flex-col">
                        <li><b>No more</b> "I'll get back to you on that."</li>
                        <li><b>No more</b> "I need to run a new query."</li>
                        <li><b>Just ask</b>, and lead your team with real-time facts.</li>
                    </ul>
                </div>

                <!-- Right: Chat Calc Simulator -->
                <div class="lg:w-1/2 w-full bg-gray-50 rounded-xl shadow-xl border border-gray-200 p-6 flex flex-col gap-4">
                    <!-- User Message -->
                    <div class="flex flex-row justify-end">
                        <div class="bg-primary-blue-100 text-white p-4 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl max-w-[90%]">
                            I want to see which Google Ads keywords led to the most high-value sales in our PostgreSQL database trying to target Gen Z.
                        </div>
                    </div>

                    <!-- AI Processing -->
                    <div class="flex flex-row text-sm text-gray-500 italic ml-2">
                        AI is analyzing your schema...
                    </div>

                    <!-- AI Response -->
                    <div class="flex flex-row justify-start">
                        <div class="bg-white border border-gray-200 text-primary-blue-100 p-4 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl max-w-[100%] shadow-sm">
                            <p class="mb-3 font-semibold">I've joined `GoogleAds_Keywords` with `Sales_Transactions` using `ClickID`.</p>
                            
                            <!-- Mock Data Table -->
                            <div class="overflow-x-auto">
                                <table class="min-w-full text-left text-sm">
                                    <thead class="bg-gray-100 border-b">
                                        <tr>
                                            <th class="p-2">Keyword</th>
                                            <th class="p-2">Avg Order Value</th>
                                            <th class="p-2">ROI</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr class="border-b">
                                            <td class="p-2 font-medium">"best gaming monitor"</td>
                                            <td class="p-2">$450</td>
                                            <td class="p-2 text-green-600">+320%</td>
                                        </tr>
                                        <tr class="border-b">
                                            <td class="p-2 font-medium">"cheap led lights"</td>
                                            <td class="p-2">$25</td>
                                            <td class="p-2 text-red-500">-15%</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            
                            <p class="mt-3 text-sm">
                                Insights: Broad keywords generated traffic, but specific 'long-tail' keywords resulted in <b>2x higher Average Order Value</b> for the Gen Z demographic.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col w-3/5 lg:w-1/5 m-auto mt-16">
                <combo-button label="Join Our Private Beta" color="primary" class="w-full h-10 mr-2 shadow-lg cursor-pointer" @click="gotoJoinPrivateBeta()"/>
            </div>
        </div>
    </div>
</template>
