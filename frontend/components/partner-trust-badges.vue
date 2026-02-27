<script setup>
</script>
<template>
    <div class="bg-primary-blue-100 w-full py-10 px-6">
        <div class="max-w-5xl mx-auto flex flex-col items-center">

            <!-- Heading -->
            <p class="text-sm font-semibold uppercase tracking-widest text-white mb-3">
                Official Partnerships & Verifications
            </p>
            <h2 class="text-3xl font-bold text-white text-center mb-3">
                Recognised by the World's Leading Platforms
            </h2>
            <p class="text-white text-center text-base max-w-xl mb-12">
                Data Research Analysis is an officially recognised technology provider with Meta and a verified business on LinkedIn, meeting their strict compliance and quality standards.
            </p>

            <!-- Badge Cards -->
            <div class="flex flex-col sm:flex-row gap-6 w-full justify-center items-center sm:items-stretch">

                <!-- Meta Technology Provider -->
                <div class="flex-1 max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8 flex flex-col items-center text-center hover:shadow-lg transition duration-300">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5" style="background-color: #0866FF;">
                        <font-awesome-icon :icon="['fab', 'meta']" class="text-white text-2xl" />
                    </div>
                    <span class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Meta</span>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Technology Provider</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">
                        Officially listed as a Meta Technology Provider, enabling verified access to the Meta Marketing API and advertising ecosystem.
                    </p>
                    <div class="mt-5 flex items-center gap-2 text-xs font-semibold text-green-600">
                        <font-awesome-icon :icon="['fas', 'circle-check']" class="text-green-500" />
                        Verified Partner
                    </div>
                </div>

                <!-- LinkedIn Verified Business -->
                <div class="flex-1 max-w-sm bg-white rounded-2xl shadow-md border border-gray-100 p-8 flex flex-col items-center text-center hover:shadow-lg transition duration-300">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center mb-5" style="background-color: #0A66C2;">
                        <font-awesome-icon :icon="['fab', 'linkedin-in']" class="text-white text-2xl" />
                    </div>
                    <span class="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">LinkedIn</span>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Verified Business</h3>
                    <p class="text-gray-500 text-sm leading-relaxed">
                        Recognised as a LinkedIn Verified Business, granting authorised access to the LinkedIn Marketing API and Ads platform.
                    </p>
                    <div class="mt-5 flex items-center gap-2 text-xs font-semibold text-green-600">
                        <font-awesome-icon :icon="['fas', 'circle-check']" class="text-green-500" />
                        Verified Business
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
