<script setup lang="ts">
</script>
<template>
    <div class="bg-white w-full h-full py-10">
        <div class="max-w-7xl mx-auto px-6">
            <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">
                From Plan to Performance
            </h2>
            <p class="text-primary-blue-100/70 text-center text-lg mb-16 max-w-2xl mx-auto">
                Two halves of one engine: build the plan, then track how every channel performs.
            </p>

            <div class="flex flex-col lg:flex-row gap-10 mb-20">
                <!-- Paid Media Plan Builder Panel -->
                <div class="lg:w-1/2 bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-lg border border-blue-100 p-8 transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                    <div class="w-14 h-14 bg-primary-blue-100 rounded-xl flex items-center justify-center mb-6">
                        <font-awesome icon="fas fa-wand-magic-sparkles" class="text-white text-2xl" />
                    </div>
                    <h3 class="text-2xl font-bold text-primary-blue-100 mb-4">Paid Media Plan Builder</h3>
                    <p class="text-gray-600 leading-relaxed mb-6">
                        Point Data Research Analysis at your website and get a channel-by-channel plan — where to spend, how much, and what to create.
                    </p>
                    <ul class="space-y-4 mb-8">
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Website to plan in minutes</span>
                                <p class="text-sm text-gray-500">The AI reads your site and goals and builds the plan automatically.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Budget, targets, and a playbook</span>
                                <p class="text-sm text-gray-500">Each channel gets recommended spend, goals, and what to create.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">A plan you can defend</span>
                                <p class="text-sm text-gray-500">Every recommendation ties back to your site and goals — no guesswork.</p>
                            </div>
                        </li>
                    </ul>
                    <div class="bg-white rounded-xl border border-blue-100 p-5 mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm font-semibold text-gray-700">Your plan preview</span>
                            <span class="text-xs text-gray-400">Channel-by-channel</span>
                        </div>
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-gray-600">Google Ads (Search)</span>
                                <span class="font-semibold text-green-600">$8,000/mo · 4.0x ROAS</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div class="bg-primary-blue-100 h-2 rounded-full w-[85%]"></div>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-gray-600">Meta (Prospecting)</span>
                                <span class="font-semibold text-blue-600">$6,000/mo · 3.5x ROAS</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div class="bg-blue-500 h-2 rounded-full w-[62%]"></div>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col">
                        <combo-button label="Build Your Paid Media Plan" color="primary" class="w-full h-12 shadow-lg cursor-pointer text-sm" @click="scrollToPlanBuilder()"/>
                    </div>
                </div>

                <!-- Campaign Intelligence Panel -->
                <div class="lg:w-1/2 bg-gradient-to-br from-teal-50 to-white rounded-2xl shadow-lg border border-teal-100 p-8 transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                    <div class="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-6">
                        <font-awesome icon="fas fa-chart-line" class="text-white text-2xl" />
                    </div>
                    <h3 class="text-2xl font-bold text-primary-blue-100 mb-4">Campaign Intelligence</h3>
                    <p class="text-gray-600 leading-relaxed mb-6">
                        Connect your channels and watch how your plan's campaigns actually perform — spend, results, and waste.
                    </p>
                    <ul class="space-y-4 mb-8">
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Live performance per channel</span>
                                <p class="text-sm text-gray-500">Spend, conversions, and ROAS for every plan campaign, updated as data syncs.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Plan vs. actuals</span>
                                <p class="text-sm text-gray-500">Compare what you planned with what each channel actually delivered.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Alerts that catch waste early</span>
                                <p class="text-sm text-gray-500">Get flagged when spend spikes or a channel underperforms its target.</p>
                            </div>
                        </li>
                    </ul>
                    <div class="bg-white rounded-xl border border-teal-100 p-5 mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm font-semibold text-gray-700">Plan vs. actuals</span>
                            <div class="flex gap-1">
                                <div class="w-3 h-3 rounded-full bg-red-400"></div>
                                <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                                <div class="w-3 h-3 rounded-full bg-green-400"></div>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 mb-3">
                            <div class="bg-blue-50 rounded-lg p-3 text-center">
                                <div class="text-xs text-gray-500">Planned spend</div>
                                <div class="text-sm font-bold text-primary-blue-100">$18.0k</div>
                            </div>
                            <div class="bg-green-50 rounded-lg p-3 text-center">
                                <div class="text-xs text-gray-500">Revenue</div>
                                <div class="text-sm font-bold text-green-600">$54.0k</div>
                            </div>
                            <div class="bg-purple-50 rounded-lg p-3 text-center">
                                <div class="text-xs text-gray-500">ROAS</div>
                                <div class="text-sm font-bold text-purple-600">3.0x</div>
                            </div>
                        </div>
                        <div class="w-full bg-gray-100 rounded-lg p-3">
                            <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <font-awesome icon="fas fa-triangle-exclamation" class="text-amber-500" />
                                Meta is 12% under its plan target — shift budget to Google Ads Search
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col">
                        <combo-button label="Track Your Campaigns" color="primary" class="w-full h-12 shadow-lg cursor-pointer text-sm" @click="gotoJoinPricing()"/>
                    </div>
                </div>
            </div>

            <!-- How It Works Flow -->
            <div class="bg-gray-50 rounded-2xl p-10 max-w-5xl mx-auto">
                <h3 class="text-center text-xl font-bold text-primary-blue-100 mb-10">How It Works</h3>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div class="text-center">
                        <div class="w-12 h-12 bg-primary-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white font-bold text-lg">1</span>
                        </div>
                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <font-awesome icon="fas fa-globe" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Enter your website</h4>
                        <p class="text-sm text-gray-500">The engine reads your site and your goals.</p>
                    </div>
                    <div class="text-center">
                        <div class="w-12 h-12 bg-primary-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white font-bold text-lg">2</span>
                        </div>
                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <font-awesome icon="fas fa-wand-magic-sparkles" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Get your plan</h4>
                        <p class="text-sm text-gray-500">Channel-by-channel budget, targets, and a creative playbook.</p>
                    </div>
                    <div class="text-center">
                        <div class="w-12 h-12 bg-primary-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white font-bold text-lg">3</span>
                        </div>
                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <font-awesome icon="fas fa-plug" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Connect channels</h4>
                        <p class="text-sm text-gray-500">Google Ads, Meta, and Analytics in one click.</p>
                    </div>
                    <div class="text-center">
                        <div class="w-12 h-12 bg-primary-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white font-bold text-lg">4</span>
                        </div>
                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <font-awesome icon="fas fa-arrow-trend-up" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Track and improve</h4>
                        <p class="text-sm text-gray-500">See plan vs. actuals and shift budget to what works.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
