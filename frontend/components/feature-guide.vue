<script setup lang="ts">
</script>
<template>
    <div class="bg-white w-full h-full py-10">
        <div class="max-w-7xl mx-auto px-6">
            <h2 class="font-bold text-primary-blue-100 text-center text-4xl mb-4">
                From Unified Data to Actionable Reports
            </h2>
            <p class="text-primary-blue-100/70 text-center text-lg mb-16 max-w-2xl mx-auto">
                Two powerful tools that turn your connected data into decisions — no SQL required.
            </p>

            <div class="flex flex-col lg:flex-row gap-10 mb-20">
                <!-- Marketing Intelligence Panel -->
                <div class="lg:w-1/2 bg-gradient-to-br from-blue-50 to-white rounded-2xl shadow-lg border border-blue-100 p-8 transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                    <div class="w-14 h-14 bg-primary-blue-100 rounded-xl flex items-center justify-center mb-6">
                        <font-awesome icon="fas fa-brain" class="text-white text-2xl" />
                    </div>
                    <h3 class="text-2xl font-bold text-primary-blue-100 mb-4">Marketing Intelligence Hub</h3>
                    <p class="text-gray-600 leading-relaxed mb-6">
                        Your command center for cross-channel performance. Track every campaign, channel, and dollar in one unified view.
                    </p>
                    <ul class="space-y-4 mb-8">
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Live KPI Dashboard</span>
                                <p class="text-sm text-gray-500">Spend, impressions, clicks, conversions, CPL, pipeline value — updated in real time.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Campaign Drill-Downs</span>
                                <p class="text-sm text-gray-500">Click into any campaign to see granular performance by channel, platform, and creative.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">AI-Powered Alerts</span>
                                <p class="text-sm text-gray-500">Get notified when spend spikes, conversions drop, or anomalies are detected.</p>
                            </div>
                        </li>
                    </ul>
                    <div class="bg-white rounded-xl border border-blue-100 p-5 mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm font-semibold text-gray-700">Campaignsnapshot</span>
                            <span class="text-xs text-gray-400">Last 30 days</span>
                        </div>
                        <div class="space-y-2">
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-gray-600">Google Ads</span>
                                <span class="font-semibold text-green-600">+24.5% ROAS</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div class="bg-primary-blue-100 h-2 rounded-full" style="width: 85%"></div>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-gray-600">LinkedIn Ads</span>
                                <span class="font-semibold text-blue-600">$45 CPL</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div class="bg-blue-500 h-2 rounded-full" style="width: 62%"></div>
                            </div>
                            <div class="flex items-center justify-between text-sm">
                                <span class="text-gray-600">Meta Ads</span>
                                <span class="font-semibold text-amber-600">-3.2% Conv</span>
                            </div>
                            <div class="w-full bg-gray-100 rounded-full h-2">
                                <div class="bg-amber-500 h-2 rounded-full" style="width: 48%"></div>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col">
                        <combo-button label="Explore Intelligence Hub" color="primary" class="w-full h-12 shadow-lg cursor-pointer text-sm" @click="gotoJoinPricing()"/>
                    </div>
                </div>

                <!-- Reports Panel -->
                <div class="lg:w-1/2 bg-gradient-to-br from-teal-50 to-white rounded-2xl shadow-lg border border-teal-100 p-8 transform transition duration-300 hover:-translate-y-2 hover:shadow-xl">
                    <div class="w-14 h-14 bg-teal-500 rounded-xl flex items-center justify-center mb-6">
                        <font-awesome icon="fas fa-file-pen" class="text-white text-2xl" />
                    </div>
                    <h3 class="text-2xl font-bold text-primary-blue-100 mb-4">Custom Report Builder</h3>
                    <p class="text-gray-600 leading-relaxed mb-6">
                        Drag, drop, and design CEO-ready reports in minutes. Combine charts, tables, and AI insights on one canvas.
                    </p>
                    <ul class="space-y-4 mb-8">
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Drag-and-Drop Canvas</span>
                                <p class="text-sm text-gray-500">Add KPI cards, data tables, charts, text blocks, and dashboards to any layout.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Pre-Built Templates</span>
                                <p class="text-sm text-gray-500">Start fast with templates for weekly performance, executive summaries, and more.</p>
                            </div>
                        </li>
                        <li class="flex items-start gap-3">
                            <div class="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <font-awesome icon="fas fa-check" class="text-green-600 text-xs" />
                            </div>
                            <div>
                                <span class="font-semibold text-primary-blue-100">Export & Share</span>
                                <p class="text-sm text-gray-500">Export to PDF, share with stakeholders, or embed live dashboards anywhere.</p>
                            </div>
                        </li>
                    </ul>
                    <div class="bg-white rounded-xl border border-teal-100 p-5 mb-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-sm font-semibold text-gray-700">Report preview</span>
                            <div class="flex gap-1">
                                <div class="w-3 h-3 rounded-full bg-red-400"></div>
                                <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
                                <div class="w-3 h-3 rounded-full bg-green-400"></div>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 mb-3">
                            <div class="bg-blue-50 rounded-lg p-3 text-center">
                                <div class="text-xs text-gray-500">Spend</div>
                                <div class="text-sm font-bold text-primary-blue-100">$48.2k</div>
                            </div>
                            <div class="bg-green-50 rounded-lg p-3 text-center">
                                <div class="text-xs text-gray-500">Revenue</div>
                                <div class="text-sm font-bold text-green-600">$142.8k</div>
                            </div>
                            <div class="bg-purple-50 rounded-lg p-3 text-center">
                                <div class="text-xs text-gray-500">ROAS</div>
                                <div class="text-sm font-bold text-purple-600">3.0x</div>
                            </div>
                        </div>
                        <div class="w-full bg-gray-100 rounded-lg p-3">
                            <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <font-awesome icon="fas fa-arrow-trend-up" class="text-green-500" />
                                Weekly trend — conversions up 18% vs last period
                            </div>
                            <div class="flex items-center justify-between text-xs text-gray-400">
                                <span>---</span>
                                <span>+---</span>
                                <span>--+</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex flex-col">
                        <combo-button label="Start Building Reports" color="primary" class="w-full h-12 shadow-lg cursor-pointer text-sm" @click="gotoJoinPricing()"/>
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
                            <font-awesome icon="fas fa-plug" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Connect Sources</h4>
                        <p class="text-sm text-gray-500">Sync Google Ads, Analytics, SQL, CSVs in one click.</p>
                    </div>
                    <div class="text-center">
                        <div class="w-12 h-12 bg-primary-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white font-bold text-lg">2</span>
                        </div>
                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <font-awesome icon="fas fa-brain" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Analyze</h4>
                        <p class="text-sm text-gray-500">Track KPIs, drill into campaigns, catch anomalies with AI.</p>
                    </div>
                    <div class="text-center">
                        <div class="w-12 h-12 bg-primary-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white font-bold text-lg">3</span>
                        </div>
                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <font-awesome icon="fas fa-file-pen" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Report</h4>
                        <p class="text-sm text-gray-500">Drag and drop custom reports with charts and tables.</p>
                    </div>
                    <div class="text-center">
                        <div class="w-12 h-12 bg-primary-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="text-white font-bold text-lg">4</span>
                        </div>
                        <div class="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <font-awesome icon="fas fa-chart-line" class="text-primary-blue-100 text-xl" />
                        </div>
                        <h4 class="font-semibold text-primary-blue-100 mb-1">Scale</h4>
                        <p class="text-sm text-gray-500">Share insights, pivot budget, grow your brand faster.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
