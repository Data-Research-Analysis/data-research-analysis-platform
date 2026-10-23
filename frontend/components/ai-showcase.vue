<script setup lang="ts">
</script>
<template>
    <div class="bg-white w-full h-full py-10">
        <div class="flex flex-col w-3/4 m-auto">
            <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-5">
                Your AI Campaign Strategist
            </h2>
            <div class="text-xl text-primary-blue-100 text-center mb-16 max-w-2xl m-auto">
                Point it at your website. It builds the plan.
            </div>

            <div class="flex flex-col lg:flex-row gap-10 items-center">
                <!-- Left: Copy -->
                <div class="lg:w-1/2 flex flex-col gap-6 text-lg text-primary-blue-100">
                    <p class="font-bold text-2xl">
                        "Where should we spend? The AI builds the plan."
                    </p>
                    <p>
                        Imagine a strategist who knows your website, your market, and every channel — ready to build a channel-by-channel plan in minutes. That's the AI Paid Media Plan Builder.
                    </p>
                    <ul class="list-disc ml-5 gap-2 flex flex-col">
                        <li><b>No more</b> guessing where the budget goes.</li>
                        <li><b>No more</b> starting from a blank spreadsheet.</li>
                        <li><b>Just point</b> it at your website and get where to spend, how much, and what to create.</li>
                    </ul>
                </div>

                <!-- Right: Chat Simulator -->
                <div class="lg:w-1/2 w-full bg-gray-50 rounded-xl shadow-xl border border-gray-200 p-6 flex flex-col gap-4">
                    <!-- User Message -->
                    <div class="flex flex-row justify-end">
                        <div class="bg-primary-blue-100 text-white p-4 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl max-w-[90%]">
                            Here's our website: acme.com. We want to grow online sales without wasting ad spend.
                        </div>
                    </div>

                    <!-- AI Processing -->
                    <div class="flex flex-row text-sm text-gray-500 italic ml-2">
                        Analyzing your website and market...
                    </div>

                    <!-- AI Response -->
                    <div class="flex flex-row justify-start">
                        <div class="bg-white border border-gray-200 text-primary-blue-100 p-4 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl max-w-[100%] shadow-sm">
                            <p class="mb-3 font-semibold">Here's your channel-by-channel plan.</p>

                            <!-- Mock Plan Table -->
                            <div class="overflow-x-auto">
                                <table class="min-w-full text-left text-sm">
                                    <thead class="bg-gray-100 border-b">
                                        <tr>
                                            <th class="p-2">Channel</th>
                                            <th class="p-2">Monthly spend</th>
                                            <th class="p-2">Goal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr class="border-b">
                                            <td class="p-2 font-medium">Google Ads (Search)</td>
                                            <td class="p-2">$8,000</td>
                                            <td class="p-2 text-green-600">4.0x ROAS</td>
                                        </tr>
                                        <tr class="border-b">
                                            <td class="p-2 font-medium">Meta (Prospecting)</td>
                                            <td class="p-2">$6,000</td>
                                            <td class="p-2 text-green-600">3.5x ROAS</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <p class="mt-3 text-sm">
                                Insights: Search captures high-intent buyers now and Meta builds the audience. You'll track each against the plan in Campaign Intelligence.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="flex flex-col w-3/5 lg:w-1/5 m-auto mt-16">
                <combo-button label="Build Your Free Paid Media Plan" color="primary" class="w-full mr-2 shadow-lg cursor-pointer" @click="scrollToPlanBuilder()"/>
            </div>
        </div>
    </div>
</template>
