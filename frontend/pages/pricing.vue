<template>
    <div class="min-h-screen bg-gray-50">
        <!-- Page Header -->
        <div class="bg-gradient-to-r from-primary-blue-100 to-primary-blue-300 text-white py-12">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center">
                    <h1 class="text-4xl font-bold mb-3">
                        {{ orgId ? 'Organization Subscription' : 'Choose Your Plan' }}
                    </h1>
                    <p class="text-lg text-blue-100 max-w-2xl mx-auto">
                        {{ orgId && organization ? `Managing subscription for ${organization.name}` : 'Select the perfect plan for your data analytics needs' }}
                    </p>
                    <ClientOnly>
                        <div v-if="orgId" class="mt-4">
                            <NuxtLink
                                :to="`/admin/organizations/${orgId}/settings?tab=billing`"
                                class="inline-flex items-center text-blue-100 hover:text-white text-sm transition-colors"
                            >
                                <font-awesome-icon :icon="['fas', 'arrow-left']" class="mr-2" />
                                Back to Organization Settings
                            </NuxtLink>
                        </div>
                    </ClientOnly>
                </div>
                
                <!-- Billing Toggle -->
                <div class="mt-8 flex items-center justify-center gap-4">
                    <span :class="billingPeriod === 'monthly' ? 'text-white font-semibold' : 'text-blue-100'">
                        Monthly
                    </span>
                    <button
                        @click="billingPeriod = billingPeriod === 'monthly' ? 'annual' : 'monthly'"
                        :class="[
                            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
                            billingPeriod === 'monthly' ? 'bg-blue-800' : 'bg-white'
                        ]"
                    >
                        <span
                            :class="[
                                'inline-block h-4 w-4 transform rounded-full bg-primary-blue-100 transition-transform',
                                billingPeriod === 'monthly' ? 'translate-x-1' : 'translate-x-6'
                            ]"
                        />
                    </button>
                    <span :class="billingPeriod === 'annual' ? 'text-white font-semibold' : 'text-blue-100'">
                        Annual
                    </span>
                    <span v-if="billingPeriod === 'annual'" class="ml-2 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                        Save 20%
                    </span>
                </div>

                <!-- Promo Code Input -->
                <div class="mt-6 flex items-center justify-center">
                    <div class="bg-white bg-opacity-20 rounded-lg p-4 max-w-md w-full backdrop-blur-sm">
                        <div class="flex items-center gap-2">
                            <div class="flex-1">
                                <input
                                    v-model="promoCode.input"
                                    @input="clearPromoCodeValidation"
                                    type="text"
                                    placeholder="Have a promo code?"
                                    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-white text-gray-900 font-mono uppercase"
                                />
                            </div>
                            <button
                                @click="validatePromoCode"
                                :disabled="!promoCode.input.trim() || promoCode.validating"
                                class="px-4 py-2 bg-white text-primary-blue-300 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                <font-awesome-icon v-if="promoCode.validating" :icon="['fas', 'spinner']" class="animate-spin" />
                                <span v-else>Apply</span>
                            </button>
                        </div>
                        <!-- Validation Message -->
                        <div v-if="promoCode.validated" class="mt-2">
                            <div v-if="promoCode.valid" class="flex items-center text-green-500 text-sm font-medium">
                                <font-awesome-icon :icon="['fas', 'check-circle']" class="mr-2" />
                                <span>{{ promoCode.discountDescription }} - Code applied!</span>
                            </div>
                            <div v-else class="flex items-center text-red-500 text-sm font-medium">
                                <font-awesome-icon :icon="['fas', 'times-circle']" class="mr-2" />
                                <span>{{ promoCode.error }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Pricing Cards -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <!-- Permission Error Banner -->
            <ClientOnly>
                <div v-if="orgId && orgError" class="mb-8 bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <p class="text-red-800">
                        <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="mr-2" />
                        {{ orgError }}
                    </p>
                </div>
            </ClientOnly>
            
            <!-- Subscription Type Banner (Organization Mode Only) -->
            <ClientOnly>
                <div v-if="orgId && subscriptionType && !orgError" class="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div class="flex items-start">
                        <font-awesome-icon :icon="['fas', 'info-circle']" class="text-blue-600 mr-3 mt-0.5" />
                        <div class="text-sm text-blue-800">
                            <p class="font-medium mb-1">Billing Information</p>
                            <p v-if="subscriptionType === 'paddle'">
                                <font-awesome-icon :icon="['fas', 'credit-card']" class="mr-2" />
                                <strong>Active Paddle Subscription:</strong> Tier changes will update your Paddle subscription with automatic proration. You'll be charged or credited immediately based on the remaining billing cycle.
                            </p>
                            <p v-else-if="subscriptionType === 'manual'">
                                <font-awesome-icon :icon="['fas', 'file-invoice']" class="mr-2" />
                                <strong>Manual Billing:</strong> Tier changes apply immediately. Billing adjustments will be reflected in your next invoice.
                            </p>
                            <p v-else-if="subscriptionType === 'free'">
                                <font-awesome-icon :icon="['fas', 'gift']" class="mr-2" />
                                <strong>Free Tier:</strong> Upgrades to paid tiers will require setting up a payment method through Paddle checkout.
                            </p>
                        </div>
                    </div>
                </div>
            </ClientOnly>
            
            <!-- Current Plan Alert -->
            <ClientOnly>
                <div v-if="currentTier && !orgError" class="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <p class="text-blue-800">
                        <font-awesome-icon :icon="['fas', 'info-circle']" class="mr-2" />
                        You are currently on the <strong>{{ normalizedCurrentTier }}</strong> plan
                    </p>
                </div>
            </ClientOnly>

            <!-- Scheduled Cancellation Alert -->
            <ClientOnly>
                <div v-if="orgId && organization?.subscription?.scheduled_cancellation && !orgError" class="mb-8 bg-orange-50 border-2 border-orange-400 rounded-lg p-6">
                    <div class="flex items-start">
                        <font-awesome-icon :icon="['fas', 'calendar-xmark']" class="text-orange-500 mr-4 mt-1 flex-shrink-0 text-xl" />
                        <div class="flex-1">
                            <h3 class="text-lg font-semibold text-orange-900 mb-2">Subscription Scheduled to Cancel</h3>
                            <p class="text-sm text-orange-800 mb-3">
                                Your subscription will be cancelled on 
                                <strong>{{ formatDate(organization.subscription.scheduled_cancellation.effective_at) }}</strong>.
                                You will retain access to {{ normalizedCurrentTier }} features until that date.
                            </p>
                            <button
                                @click="handleResumeSubscription"
                                :disabled="state.resuming"
                                class="px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <font-awesome-icon v-if="state.resuming" :icon="['fas', 'spinner']" class="animate-spin mr-2" />
                                {{ state.resuming ? 'Resuming...' : isPlatformAdmin ? "Keep Organization's Subscription" : 'Keep My Subscription' }}
                            </button>
                        </div>
                    </div>
                </div>
            </ClientOnly>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <!-- FREE Plan -->
                <div class="bg-white rounded-lg shadow-sm border transition-all border-gray-200" data-plan-tier="FREE">
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Free</h3>
                        <div class="mb-4">
                            <span class="text-4xl font-bold text-gray-900">$0</span>
                            <span class="text-gray-600">/month</span>
                        </div>
                        <p class="text-sm text-gray-600 mb-6">Perfect for getting started</p>
                        
                        <ul class="space-y-3 mb-6">
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">3 Projects</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">5 Data Sources per project</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">5 Dashboards</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">10 AI Generations/month</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">50K rows per data model</span>
                            </li>
                        </ul>
                        
                        <ClientOnly>
                            <button
                                v-if="normalizedCurrentTier === 'FREE'"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Current Plan
                            </button>
                            <button
                                v-else-if="orgError"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Insufficient Permissions
                            </button>
                            <button
                                v-else-if="!isPlatformAdmin && isDowngrade('FREE')"
                                @click="handleContactSupport('downgrade to Free')"
                                class="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Contact Support
                            </button>
                            <button
                                v-else-if="isPlatformAdmin && orgId && isDowngrade('FREE')"
                                @click="handleSelectPlan('FREE', 11)"
                                class="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Select Plan
                            </button>
                            <button
                                v-else
                                disabled
                                class="w-full px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Not Available
                            </button>
                            <template #fallback>
                                <button disabled class="w-full px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium cursor-not-allowed">
                                    Loading...
                                </button>
                            </template>
                        </ClientOnly>
                    </div>
                </div>

                <!-- STARTER Plan -->
                <div class="bg-white rounded-lg shadow-sm border transition-all border-gray-200" data-plan-tier="STARTER">
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Starter</h3>
                        <div class="mb-4">
                            <span v-if="planPrices['STARTER'].hasDiscount" class="text-lg line-through text-gray-400 mr-1">${{ billingPeriod === 'monthly' ? planPrices['STARTER'].monthlyBase : planPrices['STARTER'].annualBase }}</span>
                            <span class="text-4xl font-bold" :class="planPrices['STARTER'].hasDiscount ? 'text-green-600' : 'text-gray-900'">
                                ${{ billingPeriod === 'monthly' ? planPrices['STARTER'].monthly : planPrices['STARTER'].annual }}
                            </span>
                            <span class="text-gray-600">/month</span>
                        </div>
                        <p class="text-sm mb-6" :class="planPrices['STARTER'].hasDiscount ? 'text-green-600 font-medium' : 'text-gray-600'">
                            <template v-if="planPrices['STARTER'].hasDiscount">
                                {{ promoCode.discountDescription }} applied!
                            </template>
                            <template v-else>
                                {{ billingPeriod === 'annual' ? 'Billed $276/year' : 'Billed monthly' }}
                            </template>
                        </p>
                        <p v-if="billingPeriod === 'annual'" class="text-xs text-green-600 font-medium -mt-4 mb-4">
                            Save ${{ getAnnualSavings('STARTER') }}/year ({{ getAnnualDiscountPercent('STARTER') }}% off monthly)
                        </p>
                        
                        <ul class="space-y-3 mb-6">
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">10 Projects</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">15 Data Sources per project</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">15 Dashboards</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">100 AI Generations/month</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">500K rows per data model</span>
                            </li>
                        </ul>
                        
                        <ClientOnly>
                            <button
                                v-if="normalizedCurrentTier === 'STARTER'"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Current Plan
                            </button>
                            <button
                                v-else-if="orgError"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Insufficient Permissions
                            </button>
                            <button
                                v-else-if="!isPlatformAdmin && isDowngrade('STARTER')"
                                @click="handleContactSupport('downgrade to Starter')"
                                class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Contact Support
                            </button>
                            <button
                                v-else
                                @click="handleSelectPlan('STARTER', 14)"
                                class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                {{ PADDLE_CHECKOUT_ENABLED ? 'Select Plan' : 'Coming Soon' }}
                            </button>
                            <template #fallback>
                                <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                                    Select Plan
                                </button>
                            </template>
                        </ClientOnly>
                    </div>
                </div>

                <!-- PROFESSIONAL Plan (Popular) -->
                <div class="bg-white rounded-lg shadow-sm border transition-all border-blue-300 border-2 transform scale-105" data-plan-tier="PROFESSIONAL">
                    <ClientOnly>
                        <div v-if="currentTier?.toUpperCase() !== 'PROFESSIONAL'" class="bg-blue-600 text-white text-xs font-bold text-center py-2 rounded-t-lg">
                            MOST POPULAR
                        </div>
                        <template #fallback>
                            <div class="bg-blue-600 text-white text-xs font-bold text-center py-2 rounded-t-lg">
                                MOST POPULAR
                            </div>
                        </template>
                    </ClientOnly>
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Professional</h3>
                        <div class="mb-4">
                            <span v-if="planPrices['PROFESSIONAL'].hasDiscount" class="text-lg line-through text-gray-400 mr-1">${{ billingPeriod === 'monthly' ? planPrices['PROFESSIONAL'].monthlyBase : planPrices['PROFESSIONAL'].annualBase }}</span>
                            <span class="text-4xl font-bold" :class="planPrices['PROFESSIONAL'].hasDiscount ? 'text-green-600' : 'text-gray-900'">
                                ${{ billingPeriod === 'monthly' ? planPrices['PROFESSIONAL'].monthly : planPrices['PROFESSIONAL'].annual }}
                            </span>
                            <span class="text-gray-600">/month</span>
                        </div>
                        <p class="text-sm mb-6" :class="planPrices['PROFESSIONAL'].hasDiscount ? 'text-green-600 font-medium' : 'text-gray-600'">
                            <template v-if="planPrices['PROFESSIONAL'].hasDiscount">
                                {{ promoCode.discountDescription }} applied!
                            </template>
                            <template v-else>
                                {{ billingPeriod === 'annual' ? 'Billed $1,236/year' : 'Billed monthly' }}
                            </template>
                        </p>
                        <p v-if="billingPeriod === 'annual'" class="text-xs text-green-600 font-medium -mt-4 mb-4">
                            Save ${{ getAnnualSavings('PROFESSIONAL') }}/year ({{ getAnnualDiscountPercent('PROFESSIONAL') }}% off monthly)
                        </p>
                        
                        <ul class="space-y-3 mb-6">
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Projects</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Data Sources</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Dashboards</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">500 AI Generations/month</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">5M rows per data model</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">2-5 Team Members</span>
                            </li>
                        </ul>
                        
                        <ClientOnly>
                            <button
                                v-if="normalizedCurrentTier === 'PROFESSIONAL'"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Current Plan
                            </button>
                            <button
                                v-else-if="orgError"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Insufficient Permissions
                            </button>
                            <button
                                v-else-if="!isPlatformAdmin && isDowngrade('PROFESSIONAL')"
                                @click="handleContactSupport('downgrade to Professional')"
                                class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Contact Support
                            </button>
                            <button
                                v-else
                                @click="handleSelectPlan('PROFESSIONAL', 12)"
                                class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                {{ PADDLE_CHECKOUT_ENABLED ? 'Select Plan' : 'Coming Soon' }}
                            </button>
                            <template #fallback>
                                <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                                    Select Plan
                                </button>
                            </template>
                        </ClientOnly>
                    </div>
                </div>

                <!-- PROFESSIONAL PLUS Plan -->
                <div class="bg-white rounded-lg shadow-sm border transition-all border-gray-200" data-plan-tier="PROFESSIONAL PLUS">
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Professional Plus</h3>
                        <div class="mb-4">
                            <span v-if="planPrices['PROFESSIONAL PLUS'].hasDiscount" class="text-lg line-through text-gray-400 mr-1">${{ billingPeriod === 'monthly' ? planPrices['PROFESSIONAL PLUS'].monthlyBase : planPrices['PROFESSIONAL PLUS'].annualBase }}</span>
                            <span class="text-4xl font-bold" :class="planPrices['PROFESSIONAL PLUS'].hasDiscount ? 'text-green-600' : 'text-gray-900'">
                                ${{ billingPeriod === 'monthly' ? planPrices['PROFESSIONAL PLUS'].monthly : planPrices['PROFESSIONAL PLUS'].annual }}
                            </span>
                            <span class="text-gray-600">/month</span>
                        </div>
                        <p class="text-sm mb-6" :class="planPrices['PROFESSIONAL PLUS'].hasDiscount ? 'text-green-600 font-medium' : 'text-gray-600'">
                            <template v-if="planPrices['PROFESSIONAL PLUS'].hasDiscount">
                                {{ promoCode.discountDescription }} applied!
                            </template>
                            <template v-else>
                                {{ billingPeriod === 'annual' ? 'Billed $3,828/year' : 'Billed monthly' }}
                            </template>
                        </p>
                        <p v-if="billingPeriod === 'annual'" class="text-xs text-green-600 font-medium -mt-4 mb-4">
                            Save ${{ getAnnualSavings('PROFESSIONAL PLUS') }}/year ({{ getAnnualDiscountPercent('PROFESSIONAL PLUS') }}% off monthly)
                        </p>
                        
                        <ul class="space-y-3 mb-6">
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Projects</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Data Sources</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Dashboards</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited AI Generations</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">100M rows per data model</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">6-100 Team Members</span>
                            </li>
                        </ul>
                        
                        <ClientOnly>
                            <button
                                v-if="normalizedCurrentTier === 'PROFESSIONAL PLUS'"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Current Plan
                            </button>
                            <button
                                v-else-if="orgError"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Insufficient Permissions
                            </button>
                            <button
                                v-else-if="!isPlatformAdmin && isDowngrade('PROFESSIONAL PLUS')"
                                @click="handleContactSupport('downgrade to Professional Plus')"
                                class="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Contact Support
                            </button>
                            <button
                                v-else
                                @click="handleSelectPlan('PROFESSIONAL PLUS', 15)"
                                class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                {{ PADDLE_CHECKOUT_ENABLED ? 'Select Plan' : 'Coming Soon' }}
                            </button>
                            <template #fallback>
                                <button class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                                    Select Plan
                                </button>
                            </template>
                        </ClientOnly>
                    </div>
                </div>

                <!-- ENTERPRISE Plan -->
                <div class="bg-white rounded-lg shadow-sm border transition-all border-gray-200" data-plan-tier="ENTERPRISE">
                    <div class="p-6">
                        <h3 class="text-xl font-bold text-gray-900 mb-2">Enterprise</h3>
                        <div class="mb-4">
                            <span class="text-4xl font-bold text-gray-900">
                                Custom Pricing
                            </span>
                        </div>
                        <p class="text-sm text-gray-600 mb-6">
                            Tailored to your needs
                        </p>
                        
                        <ul class="space-y-3 mb-6">
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Projects</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Data Sources</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited Dashboards</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited AI Generations</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">Unlimited rows</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <font-awesome-icon :icon="['fas', 'check']" class="text-green-600 mt-1 flex-shrink-0" />
                                <span class="text-sm text-gray-700">100+ Team Members</span>
                            </li>
                        </ul>
                        
                        <ClientOnly>
                            <button
                                v-if="normalizedCurrentTier === 'ENTERPRISE'"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Current Plan
                            </button>
                            <button
                                v-else-if="orgError"
                                disabled
                                class="w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm font-medium cursor-not-allowed"
                            >
                                Insufficient Permissions
                            </button>
                            <button
                                v-else-if="isPlatformAdmin && orgId"
                                @click="handleSelectPlan('ENTERPRISE', 13)"
                                class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Select Plan
                            </button>
                            <button
                                v-else
                                @click="handleContactSupport('Enterprise')"
                                class="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                            >
                                Contact Support
                            </button>
                            <template #fallback>
                                <button class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium">
                                    Contact Support
                                </button>
                            </template>
                        </ClientOnly>
                    </div>
                </div>
            </div>

            <!-- Features Comparison Table (Mobile Hidden) -->
            <div class="mt-16 hidden lg:block">
                <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">Compare All Features</h2>
                <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <table class="w-full">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="py-4 px-6 text-left text-sm font-semibold text-gray-900">Feature</th>
                                <th class="py-4 px-6 text-center text-sm font-semibold text-gray-900">Free</th>
                                <th class="py-4 px-6 text-center text-sm font-semibold text-gray-900">Starter</th>
                                <th class="py-4 px-6 text-center text-sm font-semibold text-gray-900 bg-blue-50">Professional</th>
                                <th class="py-4 px-6 text-center text-sm font-semibold text-gray-900">Professional Plus</th>
                                <th class="py-4 px-6 text-center text-sm font-semibold text-gray-900">Enterprise</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            <tr>
                                <td class="py-4 px-6 text-sm text-gray-700">Projects</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">3</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">10</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600 bg-blue-50">Unlimited</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                            </tr>
                            <tr>
                                <td class="py-4 px-6 text-sm text-gray-700">Data Sources</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">5</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">15</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600 bg-blue-50">Unlimited</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                            </tr>
                            <tr>
                                <td class="py-4 px-6 text-sm text-gray-700">Dashboards</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">5</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">15</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600 bg-blue-50">Unlimited</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                            </tr>
                            <tr>
                                <td class="py-4 px-6 text-sm text-gray-700">AI Generations/Month</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">10</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">100</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600 bg-blue-50">500</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                            </tr>
                            <tr>
                                <td class="py-4 px-6 text-sm text-gray-700">Rows per Data Model</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">50K</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">500K</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600 bg-blue-50">5M</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">100M</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Unlimited</td>
                            </tr>
                            <tr>
                                <td class="py-4 px-6 text-sm text-gray-700">Team Members</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Solo Only</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">Solo Only</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600 bg-blue-50">2-5</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">6-100</td>
                                <td class="py-4 px-6 text-center text-sm text-gray-600">100+</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- FAQ Section -->
            <div class="mt-16 max-w-3xl mx-auto">
                <h2 class="text-2xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h2>
                <div class="space-y-4">
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 class="font-semibold text-gray-900 mb-2">Can I change plans later?</h3>
                        <p class="text-sm text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Upgrades take effect immediately, while downgrades take effect at the end of your current billing period.</p>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 class="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
                        <p class="text-sm text-gray-600">We accept all major credit cards (Visa, MasterCard, American Express) through our secure payment processor, Paddle.</p>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 class="font-semibold text-gray-900 mb-2">Is there a free trial for paid plans?</h3>
                        <p class="text-sm text-gray-600">We offer a Free plan to get started. You can upgrade to a paid plan at any time to access more features and higher limits.</p>
                    </div>
                    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 class="font-semibold text-gray-900 mb-2">What happens if I exceed my plan limits?</h3>
                        <p class="text-sm text-gray-600">You'll receive notifications when approaching your limits. To continue using the platform without interruption, you can upgrade to a higher tier.</p>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Payment Method Warning Banner (Organization Context Only) -->
        <!-- Only show for expired payment methods, not canceled subscriptions -->
        <ClientOnly>
            <div v-if="orgId && !paymentMethodValid && paymentMethodValidated && paymentValidation?.reason?.includes('expired')" 
                 class="fixed bottom-6 right-6 max-w-md bg-red-50 border-2 border-red-400 rounded-lg shadow-lg p-4 z-50">
                <div class="flex items-start">
                    <font-awesome-icon :icon="['fas', 'exclamation-triangle']" class="text-red-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div>
                        <h4 class="font-semibold text-red-900 mb-1">Payment Method Update Required</h4>
                        <p class="text-sm text-red-800 mb-3">
                            {{ paymentValidation?.reason || 'Your payment method needs to be updated to upgrade your plan.' }}
                        </p>
                        <NuxtLink
                            :to="`/admin/organizations/${orgId}/settings?tab=billing`"
                            class="inline-flex items-center text-sm font-medium text-red-700 hover:text-red-900 underline"
                        >
                            Update Payment Method
                            <font-awesome-icon :icon="['fas', 'arrow-right']" class="ml-1" />
                        </NuxtLink>
                    </div>
                    <button
                        @click="paymentMethodValidated = false"
                        class="ml-3 text-red-600 hover:text-red-800"
                    >
                        <font-awesome-icon :icon="['fas', 'times']" />
                    </button>
                </div>
            </div>
        </ClientOnly>
        
        <!-- Upgrade Confirmation Modal -->
        <ClientOnly>
            <UpgradeConfirmationModal
                :isOpen="upgradeModalOpen"
                :organizationId="orgId!"
                :newTierId="upgradeModalTierId"
                :newTierName="upgradeModalTierName"
                :billingCycle="upgradeModalBillingCycle"
                :paddleDiscountId="upgradeModalPaddleDiscountId"
                @close="upgradeModalOpen = false"
                @success="handleUpgradeSuccess"
                @redirect-to-checkout="handleRedirectToCheckout"
            />
        </ClientOnly>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import { useTierLimits } from '~/composables/useTierLimits';
import { usePaddle } from '~/composables/usePaddle';
import { useOrganizationsStore } from '~/stores/organizations';
import { useLoggedInUserStore } from '~/stores/logged_in_user';
import { getAuthToken } from '~/composables/AuthToken';
import type { IOrganization } from '~/types/IOrganization';
import UpgradeConfirmationModal from '~/components/UpgradeConfirmationModal.vue';

definePageMeta({
    layout: 'default'
});

const route = useRoute();
const router = useRouter();
const { $swal } = useNuxtApp() as any;

const { currentTier: userCurrentTier } = useTierLimits();
const paddle = usePaddle();
const orgStore = useOrganizationsStore();
const loggedInUserStore = useLoggedInUserStore();
const config = useRuntimeConfig();
const orgSubscription = useOrganizationSubscription();

const PADDLE_CHECKOUT_ENABLED = config.public.paddleCheckoutEnabled;

const billingPeriod = ref<'monthly' | 'annual'>('annual');

// Payment validation state
const paymentMethodValid = ref(true);
const paymentMethodValidated = ref(false);
const paymentValidation = ref<any>(null);

// Upgrade modal state
const upgradeModalOpen = ref(false);
const upgradeModalTierId = ref<number>(0);
const upgradeModalTierName = ref<string>('');
const upgradeModalBillingCycle = ref<'monthly' | 'annual'>('annual');
const upgradeModalPaddleDiscountId = ref<string | undefined>(undefined);

// Promo code state
interface PromoCode {
    input: string;
    validating: boolean;
    validated: boolean;
    valid: boolean;
    error: string;
    discountAmount: number;
    finalPrice: number;
    discountDescription: string;
    discountType: string;
    discountValue: number;
    paddleDiscountId: string;
}
const promoCode = reactive<PromoCode>({
    input: '',
    validating: false,
    validated: false,
    valid: false,
    error: '',
    discountAmount: 0,
    finalPrice: 0,
    discountDescription: '',
    discountType: '',
    discountValue: 0,
    paddleDiscountId: ''
});

// Organization context
const orgId = computed(() => route.query.orgId ? parseInt(route.query.orgId as string) : null);
const organization = ref<IOrganization | null>(null);
const isLoadingOrg = ref(false);
const orgError = ref<string | null>(null);
const availableTiers = ref<any[]>([]);
const subscriptionType = ref<'paddle' | 'manual' | 'free' | null>(null);
const hasPaddleSubscription = ref(false);

// Resume subscription state
interface State {
    resuming: boolean;
}
const state = reactive<State>({
    resuming: false
});

// Determine current tier based on context (organization or user)
const currentTier = computed(() => {
    if (orgId.value && organization.value?.subscription) {
        return organization.value.subscription.subscription_tier?.tier_name || 'free';
    }
    return userCurrentTier.value;
});

// Normalized current tier name for comparisons (converts underscore to space and uppercase)
const normalizedCurrentTier = computed(() => {
    if (!currentTier.value) return null;
    
    // Remove "Data Research Analysis" prefix and "Plan" suffix
    let normalized = currentTier.value
        .replace(/^Data Research Analysis\s*/i, '')
        .replace(/\s*Plan$/i, '')
        .trim();
    
    // Convert to uppercase
    normalized = normalized.toUpperCase();
    
    // Handle "Professional Plus" specifically
    if (normalized === 'PROFESSIONAL PLUS') {
        return 'PROFESSIONAL PLUS';
    }
    
    return normalized;
});

// Check if logged-in user is a platform admin
const isPlatformAdmin = computed(() => {
    const loggedInUser = loggedInUserStore.getLoggedInUser();
    return loggedInUser?.user_type === 'admin';
});

const tierOrder = ['FREE', 'STARTER', 'PROFESSIONAL', 'PROFESSIONAL PLUS', 'ENTERPRISE'];

// Get tier ID by name
function getTierId(tierName: string): number {
    // Normalize both the search name and tier names for comparison
    // Handle both space and underscore formats (e.g., "PROFESSIONAL PLUS" vs "professional_plus")
    const normalizedSearch = tierName.toUpperCase().replace(/ /g, '_');
    
    const tier = availableTiers.value.find(t => {
        const normalizedTierName = t.tier_name.toUpperCase().replace(/ /g, '_');
        return normalizedTierName === normalizedSearch;
    });
    
    if (!tier) {
        console.error(`[getTierId] Could not find tier: ${tierName}. Available tiers:`, availableTiers.value);
    }
    
    return tier?.id || null;
}

// Load available tiers
async function loadTiers() {
    try {
        const result = await orgSubscription.getTiers();
        if (result.success && result.data) {
            availableTiers.value = result.data;
        }
    } catch (e) {
        console.error('[loadTiers] Error:', e);
    }
}

// Load organization data if orgId is present
async function loadOrganization() {
    if (!orgId.value) return;
    
    const token = getAuthToken();
    if (!token) {
        router.push('/login');
        return;
    }
    
    isLoadingOrg.value = true;
    orgError.value = null;
    
    try {
        // Add cache-busting timestamp to ensure fresh data
        const timestamp = Date.now();
        const response = await $fetch<{ success: boolean; data: IOrganization }>(
            `${config.public.apiBase}/organizations/${orgId.value}?t=${timestamp}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Authorization-Type': 'auth',
                    'Cache-Control': 'no-cache'
                }
            }
        );
        
        if (response.success && response.data) {
            organization.value = response.data;
            console.log('[loadOrganization] Loaded organization:', {
                id: response.data.id,
                name: response.data.name,
                subscription: response.data.subscription
            });
            
            // Load full subscription details (includes scheduled_cancellation from Paddle)
            try {
                console.log('[loadOrganization] Fetching subscription details for org:', orgId.value);
                const subscriptionResponse = await $fetch<{ success: boolean; data: any }>(
                    `${config.public.apiBase}/subscription/${orgId.value}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Authorization-Type': 'auth'
                        }
                    }
                );
                
                console.log('[loadOrganization] Subscription API response:', subscriptionResponse);
                
                if (subscriptionResponse.success) {
                    if (subscriptionResponse.data) {
                        // Replace entire subscription object to ensure all fields are synced
                        organization.value.subscription = {
                            ...organization.value.subscription,
                            ...subscriptionResponse.data
                        };
                        
                        console.log('[loadOrganization] Merged subscription data:', {
                            paddle_subscription_id: organization.value.subscription?.paddle_subscription_id,
                            scheduled_cancellation: organization.value.subscription?.scheduled_cancellation,
                            tier_name: organization.value.subscription?.tier_name
                        });
                    } else {
                        console.log('[loadOrganization] Subscription data is null - organization may not have a subscription');
                    }
                } else {
                    console.warn('[loadOrganization] Subscription API returned success: false');
                }
            } catch (subError: any) {
                console.error('[loadOrganization] Failed to load subscription details:', subError);
                // Don't fail the whole load if subscription fetch fails
            }
            
            // Load subscription type information
            const paymentMethodResult = await orgSubscription.getPaymentMethod(orgId.value);
            if (paymentMethodResult.success && paymentMethodResult.data) {
                subscriptionType.value = paymentMethodResult.data.billingType;
                hasPaddleSubscription.value = paymentMethodResult.data.hasPaddleSubscription;
            }
            
            // Check permissions (only set error state, don't show popup)
            // Platform admins can manage any organization, otherwise must be org owner/admin
            const loggedInUser = loggedInUserStore.getLoggedInUser();
            const isPlatformAdmin = loggedInUser?.user_type === 'admin';
            const userRole = organization.value.user_role;
            
            if (!isPlatformAdmin && userRole !== 'owner' && userRole !== 'admin') {
                orgError.value = 'You must be an owner or admin to manage the organization subscription.';
            }
        }
    } catch (e: any) {
        console.error('Failed to load organization:', e);
        orgError.value = e.message || 'Failed to load organization';
        $swal.fire({
            title: 'Error',
            text: e.message || 'Failed to load organization',
            icon: 'error',
            confirmButtonColor: '#ef4444',
        });
    } finally {
        isLoadingOrg.value = false;
    }
}

// Apply current plan styling to highlight the active tier
function applyCurrentPlanStyling() {
    if (!normalizedCurrentTier.value) return;
    
    // First, reset all plan cards to default styling
    const allCards = document.querySelectorAll('[data-plan-tier]');
    allCards.forEach(card => {
        card.classList.remove('border-blue-500', 'border-2');
        // Restore default borders except for Professional which has special styling
        if (card.getAttribute('data-plan-tier') === 'PROFESSIONAL') {
            card.classList.add('border-blue-300', 'border-2');
        } else {
            card.classList.add('border-gray-200');
        }
    });
    
    // Then apply current plan styling using normalized tier name
    const currentPlanCard = document.querySelector(`[data-plan-tier="${normalizedCurrentTier.value}"]`);
    if (currentPlanCard) {
        currentPlanCard.classList.remove('border-gray-200', 'border-blue-300');
        currentPlanCard.classList.add('border-blue-500', 'border-2');
        console.log(`✅ Applied current plan styling to: ${normalizedCurrentTier.value}`);
    } else {
        console.warn(`⚠️ Could not find plan card for: ${normalizedCurrentTier.value}`);
    }
}

// Apply current plan styling after hydration to avoid SSR mismatch
onMounted(async () => {
    // Load tiers list
    await loadTiers();
    
    // Load organization data if needed
    if (orgId.value) {
        await loadOrganization();
        
        // Validate payment method for paid plan organizations
        if (hasPaddleSubscription.value) {
            await validatePaymentMethod();
        }
    } else {
        // User mode: Check if they have an existing organization
        // If so, redirect to org-scoped pricing to prevent duplicate subscriptions
        const currentOrg = orgStore.currentOrganization;
        if (currentOrg?.id) {
            console.log('[Pricing] User has organization, redirecting to org-scoped pricing to prevent duplicate subscriptions');
            router.replace(`/pricing?orgId=${currentOrg.id}`);
            return;
        }
    }
    
    // Apply styling after data is loaded
    await nextTick();
    applyCurrentPlanStyling();
    
    // Check if we just completed a checkout (page was refreshed after payment)
    if (import.meta.client) {
        const completedTransaction = sessionStorage.getItem('paddle_checkout_completed');
        const completedAt = sessionStorage.getItem('paddle_checkout_completed_at');
        
        if (completedTransaction && completedAt) {
            // Check if this is recent (within last 10 seconds)
            const timeSinceCompletion = Date.now() - parseInt(completedAt);
            if (timeSinceCompletion < 10000) {
                console.log('🎉 Detected recent checkout completion:', completedTransaction);
                
                // Clear the flags
                sessionStorage.removeItem('paddle_checkout_completed');
                sessionStorage.removeItem('paddle_checkout_completed_at');
                
                // Show success message
                $swal.fire({
                    title: 'Subscription Activated!',
                    html: `<p>Your subscription has been successfully activated.</p>
                           <p class="mt-2 text-sm text-gray-600">You now have access to all features of your new ${normalizedCurrentTier.value || ''} plan.</p>`,
                    icon: 'success',
                    confirmButtonColor: '#10b981',
                });
            } else {
                // Too old, clear it
                sessionStorage.removeItem('paddle_checkout_completed');
                sessionStorage.removeItem('paddle_checkout_completed_at');
            }
        }
    }
});

// Validate payment method on file
async function validatePaymentMethod() {
    if (!orgId.value) return;
    
    try {
        const validation = await orgSubscription.validatePaymentMethod(orgId.value);
        paymentMethodValid.value = validation.isValid;
        paymentValidation.value = validation;
        paymentMethodValidated.value = true;
    } catch (error: any) {
        console.error('[validatePaymentMethod] Error:', error);
        // Don't show payment warning if subscription doesn't exist or is canceled
        // Just mark as validated so the flow can continue
        paymentMethodValid.value = true; // Allow them to try checkout
        paymentMethodValidated.value = true;
    }
}

// Check if target tier is higher than current tier
function isHigherTier(targetTier: string, currentTier: string): boolean {
    const tierRanking = ['free', 'starter', 'professional', 'professional_plus', 'business', 'enterprise'];
    const currentIndex = tierRanking.indexOf(currentTier.toLowerCase().replace(/ /g, '_'));
    const targetIndex = tierRanking.indexOf(targetTier.toLowerCase().replace(/ /g, '_'));
    return targetIndex > currentIndex;
}

function isDowngrade(targetTier: string): boolean {
    if (!normalizedCurrentTier.value) return false;
    const currentIndex = tierOrder.indexOf(normalizedCurrentTier.value);
    const targetIndex = tierOrder.indexOf(targetTier.toUpperCase());
    return targetIndex < currentIndex;
}

// Handle upgrade success
async function handleUpgradeSuccess() {
    console.log('[Pricing] Upgrade success - closing modal and reloading data');
    upgradeModalOpen.value = false;
    
    // Force sync from Paddle to ensure database matches
    if (orgId.value) {
        try {
            console.log('[Pricing] Syncing subscription from Paddle...');
            const syncResult = await orgSubscription.syncFromPaddle(orgId.value);
            console.log('[Pricing] Sync result:', syncResult);
            
            if (syncResult.wasDifferent) {
                console.log('[Pricing] Database was out of sync! Changes applied:', syncResult.changes);
            }
        } catch (error: any) {
            console.error('[Pricing] Failed to sync from Paddle:', error);
            // Don't fail the whole flow - continue to reload anyway
        }
    }
    
    // Reload organization data to get updated subscription
    console.log('[Pricing] Reloading organization data...');
    await loadOrganization();
    console.log('[Pricing] Organization data reloaded. Current tier:', currentTier.value);
    
    // Re-apply styling to highlight the new current plan
    await nextTick();
    applyCurrentPlanStyling();
    console.log('[Pricing] Styling applied for tier:', normalizedCurrentTier.value);
    
    $swal.fire({
        title: 'Success!',
        text: 'Your organization has been successfully upgraded.',
        icon: 'success',
        confirmButtonColor: '#10b981',
    });
}

// Handle resume subscription
async function handleResumeSubscription() {
    if (!orgId.value) return;
    
    const result = await $swal.fire({
        icon: 'question',
        title: 'Keep Your Subscription?',
        text: 'Do you want to cancel the scheduled cancellation? Your subscription will continue automatically.',
        showCancelButton: true,
        confirmButtonText: 'Yes, Keep Subscription',
        cancelButtonText: 'No, Stay Canceled',
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280'
    });
    
    if (!result.isConfirmed) return;
    
    state.resuming = true;
    try {
        await orgSubscription.resumeSubscription(orgId.value);
        
        // Reload organization data
        await loadOrganization();
        
        $swal.fire({
            icon: 'success',
            title: 'Subscription Resumed!',
            text: 'Your subscription will now continue. The scheduled cancellation has been removed.',
            confirmButtonColor: '#10b981'
        });
    } catch (error: any) {
        $swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Failed to resume subscription. Please try again or contact support.',
            confirmButtonColor: '#ef4444'
        });
    } finally {
        state.resuming = false;
    }
}

// Format date helper
function formatDate(date: string | Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Handle redirect to checkout when subscription is canceled
async function handleRedirectToCheckout(payload: { tierId: number; billingCycle: 'monthly' | 'annual' }) {
    console.log('[Pricing] Redirecting to checkout after canceled subscription:', payload);
    
    // Reload organization data to clear paddle_subscription_id
    await loadOrganization();
    
    // Open Paddle checkout
    if (!orgStore.currentOrganization) {
        $swal.fire({
            title: 'Error',
            text: 'Organization not found. Please refresh the page.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
        });
        return;
    }
    
    try {
        // Pass success callback to refresh the pricing page instead of navigating away
        await paddle.openCheckout(
            payload.tierId,
            payload.billingCycle,
            orgStore.currentOrganization.id,
            async () => {
                // Custom success handler - refresh pricing page
                console.log('[Pricing] Payment successful - refreshing page data');
                
                // Reload organization data to get updated subscription
                await loadOrganization();
                
                // Re-apply styling to highlight the new current plan
                await nextTick();
                applyCurrentPlanStyling();
                
                // Show success message
                $swal.fire({
                    title: 'Subscription Activated!',
                    html: `<p>Your subscription has been successfully activated.</p>
                           <p class="mt-2 text-sm text-gray-600">You now have access to all features of your new plan.</p>`,
                    icon: 'success',
                    confirmButtonColor: '#10b981',
                });
            },
            promoCode.valid ? promoCode.input.toUpperCase() : undefined
        );
    } catch (error: any) {
        console.error('Checkout error:', error);
        $swal.fire({
            title: 'Error',
            text: error.message || 'Failed to open checkout. Please try again.',
            icon: 'error',
            confirmButtonColor: '#ef4444',
        });
    }
}

// Promo code validation
// Base prices per plan: [monthly, annual per-month]
const BASE_PRICES: Record<string, [number, number]> = {
    STARTER: [29, 23],
    PROFESSIONAL: [129, 103],
    'PROFESSIONAL PLUS': [399, 319],
};

function applyPromoDiscount(base: number): number {
    if (!promoCode.valid) return base;
    if (promoCode.discountType === 'percentage') {
        return Math.round(base * (1 - promoCode.discountValue / 100) * 100) / 100;
    }
    if (promoCode.discountType === 'fixed_amount') {
        return Math.max(0, Math.round((base - promoCode.discountValue) * 100) / 100);
    }
    return base;
}

/**
 * Annual savings callout helpers (Feature #4)
 * BASE_PRICES stores [monthlyPrice, annualMonthlyEquivalent].
 * Savings = (monthly * 12) - (annualMonthlyEquivalent * 12)
 */
function getAnnualSavings(planKey: string): number {
    const prices = BASE_PRICES[planKey];
    if (!prices) return 0;
    const [monthly, annualMonthly] = prices;
    return Math.round(monthly * 12 - annualMonthly * 12);
}

function getAnnualDiscountPercent(planKey: string): number {
    const prices = BASE_PRICES[planKey];
    if (!prices) return 0;
    const [monthly, annualMonthly] = prices;
    if (monthly === 0) return 0;
    return Math.round((1 - annualMonthly / monthly) * 100);
}

const planPrices = computed(() => {
    const result: Record<string, { monthly: number; annual: number; monthlyBase: number; annualBase: number; hasDiscount: boolean }> = {};
    for (const [plan, [monthly, annual]] of Object.entries(BASE_PRICES)) {
        const discountedMonthly = applyPromoDiscount(monthly);
        const discountedAnnual = applyPromoDiscount(annual);
        result[plan] = {
            monthly: discountedMonthly,
            annual: discountedAnnual,
            monthlyBase: monthly,
            annualBase: annual,
            hasDiscount: promoCode.valid && (discountedMonthly !== monthly || discountedAnnual !== annual),
        };
    }
    return result;
});

function clearPromoCodeValidation() {
    promoCode.validated = false;
    promoCode.valid = false;
    promoCode.error = '';
    promoCode.discountType = '';
    promoCode.discountValue = 0;
    promoCode.paddleDiscountId = '';
}

async function validatePromoCode() {
    if (!promoCode.input.trim()) {
        return;
    }

    // Need to select a tier first to validate
    if (!availableTiers.value || availableTiers.value.length === 0) {
        promoCode.validated = true;
        promoCode.valid = false;
        promoCode.error = 'Please wait for pricing to load';
        return;
    }

    // Use first paid tier for validation (STARTER)
    const starterTier = availableTiers.value.find(t => t.tier_name.toLowerCase() === 'starter');
    if (!starterTier) {
        promoCode.validated = true;
        promoCode.valid = false;
        promoCode.error = 'Unable to validate promo code';
        return;
    }

    promoCode.validating = true;
    try {
        const token = getAuthToken();
        
        // Guard against unauthenticated users
        if (!token) {
            promoCode.validated = true;
            promoCode.valid = false;
            promoCode.validating = false;
            promoCode.error = 'Please log in to apply a promo code';
            return;
        }
        
        const response = await $fetch<{
            success: boolean;
            data: {
                valid: boolean;
                error?: string;
                discountAmount?: number;
                finalPrice?: number;
                discountDescription?: string;
                discountType?: string;
                discountValue?: number;
                paddleDiscountId?: string | null;
            };
        }>(`${config.public.apiBase}/promo-codes/validate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Authorization-Type': 'auth',
                'Content-Type': 'application/json',
            },
            body: {
                code: promoCode.input.toUpperCase(),
                tierId: starterTier.id,
                billingCycle: billingPeriod.value
            }
        });

        promoCode.validated = true;
        if (response.success && response.data.valid) {
            promoCode.valid = true;
            promoCode.discountAmount = response.data.discountAmount || 0;
            promoCode.finalPrice = response.data.finalPrice || 0;
            promoCode.discountDescription = response.data.discountDescription || '';
            promoCode.discountType = response.data.discountType || '';
            promoCode.discountValue = response.data.discountValue || 0;
            promoCode.paddleDiscountId = response.data.paddleDiscountId || '';
            promoCode.error = '';
        } else {
            promoCode.valid = false;
            promoCode.error = response.data.error || 'Invalid promo code';
        }
    } catch (error: any) {
        console.error('Promo code validation error:', error);
        promoCode.validated = true;
        promoCode.valid = false;
        promoCode.error = error.data?.error || 'Failed to validate promo code';
    } finally {
        promoCode.validating = false;
    }
}

async function handleSelectPlan(tierName: string, tierId: number) {
    // Organization context mode - use organization subscription API
    if (orgId.value) {
        if (!organization.value) {
            $swal.fire({
                title: 'Organization Not Loaded',
                text: 'Please wait for organization data to load or refresh the page.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
            });
            return;
        }
        
        // Check permissions
        // Platform admins can manage any organization, otherwise must be org owner/admin
        const loggedInUser = loggedInUserStore.getLoggedInUser();
        const isPlatformAdmin = loggedInUser?.user_type === 'admin';
        const userRole = organization.value.user_role;
        
        if (!isPlatformAdmin && userRole !== 'owner' && userRole !== 'admin') {
            $swal.fire({
                title: 'Access Denied',
                text: 'Only organization owners and admins can change the subscription plan.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
            });
            return;
        }
        
        // Use the tier ID passed from the template (already correct)
        // Only lookup if not provided (for backwards compatibility)
        const actualTierId = tierId || getTierId(tierName);
        if (!actualTierId) {
            $swal.fire({
                title: 'Error',
                text: 'Unable to find tier information. Please refresh the page.',
                icon: 'error',
                confirmButtonColor: '#ef4444',
            });
            return;
        }
        
        // SELF-SERVICE UPGRADE FLOW: Detect if this is paid → higher paid tier upgrade
        if (hasPaddleSubscription.value && currentTier.value && currentTier.value !== 'free') {
            const isUpgradeAction = isHigherTier(tierName, normalizedCurrentTier.value || 'free');
            
            if (isUpgradeAction) {
                // This is a paid → higher paid upgrade - use self-service modal
                
                // Validate payment method first
                if (!paymentMethodValidated.value) {
                    await validatePaymentMethod();
                }
                
                // Only block for expired payment methods, not canceled subscriptions
                if (!paymentMethodValid.value && paymentValidation.value?.reason?.includes('expired')) {
                    // Payment method is expired - block and redirect to billing
                    const issueReason = paymentValidation.value?.reason || 'Your payment method needs to be updated.';
                    const result = await $swal.fire({
                        title: 'Payment Method Update Required',
                        html: `
                            <div class="text-left space-y-3">
                                <div class="bg-red-50 border border-red-200 rounded p-3">
                                    <p class="text-sm text-red-800">
                                        <strong>Issue:</strong> <span id="swal-issue-reason"></span>
                                    </p>
                                </div>
                                <p class="text-sm text-gray-600">
                                    To upgrade your plan, please update your payment method first. You'll be redirected to the billing page.
                                </p>
                            </div>
                        `,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonText: 'Update Payment Method',
                        cancelButtonText: 'Cancel',
                        confirmButtonColor: '#f59e0b',
                        cancelButtonColor: '#6b7280',
                        didOpen: () => {
                            // Safely set text content to prevent XSS
                            const el = document.getElementById('swal-issue-reason');
                            if (el) el.textContent = issueReason;
                        },
                    });
                    
                    if (result.isConfirmed) {
                        router.push(`/admin/organizations/${orgId.value}/settings?tab=billing`);
                    }
                    return;
                }
                
                // Show upgrade modal with proration preview
                // If subscription is canceled, the modal will detect it and redirect to checkout
                upgradeModalTierId.value = actualTierId;
                upgradeModalTierName.value = tierName;
                upgradeModalBillingCycle.value = billingPeriod.value;
                upgradeModalPaddleDiscountId.value = (promoCode.valid && promoCode.paddleDiscountId) ? promoCode.paddleDiscountId : undefined;
                upgradeModalOpen.value = true;
                return;
            }
        }
        
        // EXISTING FLOW: Downgrades, free → paid, manual billing, etc.
        // Confirm tier change with subscription-type-specific messaging
        const isDowngradeAction = isDowngrade(tierName);
        
        // Build confirmation message based on subscription type
        let prorationMessage = '';
        let billingNote = '';
        
        if (hasPaddleSubscription.value) {
            prorationMessage = isDowngradeAction 
                ? 'A credit will be automatically applied to your next billing cycle via Paddle.' 
                : 'You will be charged a prorated amount immediately via Paddle for the remainder of this billing cycle.';
            billingNote = '<p class="text-xs text-gray-500 mt-2">This will update your Paddle subscription with automatic proration.</p>';
        } else if (subscriptionType.value === 'manual') {
            prorationMessage = 'Your plan will be updated immediately. Manual billing will be adjusted on your next invoice.';
            billingNote = '<p class="text-xs text-blue-600 mt-2"><strong>Note:</strong> This organization uses manual billing. No automatic charges will occur.</p>';
        } else {
            prorationMessage = 'Your plan will be updated immediately.';
            billingNote = '<p class="text-xs text-green-600 mt-2"><strong>Note:</strong> No payment processing required for this tier change.</p>';
        }
        
        const currentPlan = normalizedCurrentTier.value || 'FREE';
        const newPlan = tierName.toUpperCase();
        const result = await $swal.fire({
            title: `${isDowngradeAction ? 'Downgrade' : 'Upgrade'} to ${newPlan}?`,
            html: `
                <div class="text-left space-y-3">
                    <div class="bg-blue-50 border border-blue-200 rounded p-3">
                        <p class="text-sm text-blue-800">
                            <strong>Current Plan:</strong> <span id="swal-current-plan"></span><br />
                            <strong>New Plan:</strong> <span id="swal-new-plan"></span>
                        </p>
                    </div>
                    <p class="text-sm text-gray-600" id="swal-proration">
                    </p>
                    <div id="swal-billing-note"></div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Confirm Change',
            cancelButtonText: 'Cancel',
            confirmButtonColor: isDowngradeAction ? '#f97316' : '#3b82f6',
            cancelButtonColor: '#6b7280',
            didOpen: () => {
                // Safely set text/HTML content to prevent XSS
                const currentPlanEl = document.getElementById('swal-current-plan');
                const newPlanEl = document.getElementById('swal-new-plan');
                const prorationEl = document.getElementById('swal-proration');
                const billingNoteEl = document.getElementById('swal-billing-note');
                if (currentPlanEl) currentPlanEl.textContent = currentPlan;
                if (newPlanEl) newPlanEl.textContent = newPlan;
                if (prorationEl) prorationEl.textContent = prorationMessage;
                if (billingNoteEl) billingNoteEl.innerHTML = billingNote; // HTML is internally generated, safe
            },
        });
        
        if (!result.isConfirmed) return;
        
        // Execute tier change
        try {
            const changeResult = await orgSubscription.changeTier(orgId.value, actualTierId, billingPeriod.value);
            
            if (changeResult.success) {
                $swal.fire({
                    title: 'Success!',
                    text: `Organization subscription has been ${isDowngradeAction ? 'downgraded' : 'upgraded'} to ${tierName.toUpperCase()}.`,
                    icon: 'success',
                    confirmButtonColor: '#10b981',
                });
                
                // Reload organization data
                await loadOrganization();
                
                // Wait for DOM to update, then reapply styling
                await nextTick();
                applyCurrentPlanStyling();
            } else {
                throw new Error(changeResult.error || 'Failed to change tier');
            }
        } catch (error: any) {
            console.error('Failed to change tier:', error);
            
            // Check if subscription was canceled/not found - redirect to checkout
            if (error.useCheckout || (error.message && error.message.includes('SUBSCRIPTION_CANCELED_USE_CHECKOUT'))) {
                console.log('[handleSelectPlan] Canceled subscription detected, showing checkout dialog');
                const result = await $swal.fire({
                    title: 'Subscription Not Active',
                    html: `
                        <div class="text-left space-y-3">
                            <p class="text-sm text-gray-600">
                                Your organization doesn't have an active subscription. To subscribe to this plan, we'll need to set up a new subscription.
                            </p>
                            <p class="text-sm text-gray-600">
                                Click "Continue to Checkout" to enter your payment details.
                            </p>
                        </div>
                    `,
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonText: 'Continue to Checkout',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#3b82f6',
                    cancelButtonColor: '#6b7280',
                });
                
                if (result.isConfirmed) {
                    console.log('[handleSelectPlan] User confirmed, redirecting to checkout');
                    await handleRedirectToCheckout({ tierId: actualTierId, billingCycle: billingPeriod.value });
                }
            } else {
                $swal.fire({
                    title: 'Error',
                    text: error.message || 'Failed to change subscription tier. Please try again or contact support.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444',
                });
            }
        }
        
        return;
    }
    
    // User mode - original Paddle checkout flow
    if (!PADDLE_CHECKOUT_ENABLED) {
        $swal.fire({
            title: 'Coming Soon!',
            text: 'Paid plans are coming soon. We will notify you when they are available.',
            icon: 'info',
            confirmButtonText: 'Got it',
            confirmButtonColor: '#3b82f6',
        });
        return;
    }
    
    // CRITICAL SAFETY CHECK: Prevent duplicate subscriptions
    // If user has an organization with existing subscription, they should use org-scoped pricing
    const currentOrg = orgStore.currentOrganization;
    if (currentOrg?.subscription?.paddle_subscription_id) {
        const orgName = currentOrg.name;
        const result = await $swal.fire({
            title: 'Existing Subscription Detected',
            html: `
                <div class="text-left space-y-3">
                    <p class="text-sm text-gray-600">
                        You already have an active subscription for <strong id="swal-org-name"></strong>.
                    </p>
                    <p class="text-sm text-gray-600">
                        To upgrade or change your plan, please use the organization billing page to avoid creating duplicate subscriptions.
                    </p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Go to Billing Page',
            cancelButtonText: 'Cancel',
            didOpen: () => {
                // Safely set text content to prevent XSS
                const el = document.getElementById('swal-org-name');
                if (el) el.textContent = orgName;
            },
            confirmButtonColor: '#f59e0b',
            cancelButtonColor: '#6b7280',
        });
        
        if (result.isConfirmed) {
            router.push(`/admin/organizations/${currentOrg.id}/settings?tab=billing`);
        }
        return;
    }
    
    if (!orgStore.currentOrganization) {
        $swal.fire({
            title: 'Organization Required',
            text: 'You need an organization to subscribe to a paid plan.',
            icon: 'info',
            confirmButtonText: 'Got it',
            confirmButtonColor: '#3b82f6',
        });
        return;
    }
    
    try {
        await paddle.openCheckout(
            tierId,
            billingPeriod.value,
            orgStore.currentOrganization.id,
            undefined,
            promoCode.valid ? promoCode.input.toUpperCase() : undefined
        );
    } catch (error: any) {
        console.error('Checkout error:', error);
        $swal.fire({
            title: 'Error',
            text: error.message || 'Failed to open checkout. Please try again.',
            icon: 'error',
            confirmButtonText: 'Got it',
            confirmButtonColor: '#3b82f6',
        });
    }
}

function handleContactSupport(reason: string) {
    const { $swal } = useNuxtApp() as any;
    
    // Special handling for Enterprise inquiries
    if (reason === 'Enterprise') {
        $swal.fire({
            title: 'Contact Us About Enterprise',
            html: `
                <div class="text-left space-y-4">
                    <p class="text-sm text-gray-600">Tell us about your needs and we'll get back to you within 24 hours.</p>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input id="company-name" class="swal2-input w-full" placeholder="Your company name" />
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Team Size</label>
                        <select id="team-size" class="swal2-input w-full">
                            <option value="">Select team size...</option>
                            <option value="1-50">1-50 employees</option>
                            <option value="51-200">51-200 employees</option>
                            <option value="201-1000">201-1,000 employees</option>
                            <option value="1000+">1,000+ employees</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Message (Optional)</label>
                        <textarea id="enterprise-message" class="swal2-textarea w-full" placeholder="Tell us about your specific requirements..." rows="3"></textarea>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Submit Request',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#9333ea',
            cancelButtonColor: '#6b7280',
            width: '600px',
            preConfirm: () => {
                const companyName = (document.getElementById('company-name') as HTMLInputElement)?.value;
                const teamSize = (document.getElementById('team-size') as HTMLSelectElement)?.value;
                const message = (document.getElementById('enterprise-message') as HTMLTextAreaElement)?.value;
                
                if (!companyName) {
                    $swal.showValidationMessage('Please enter your company name');
                    return false;
                }
                
                if (!teamSize) {
                    $swal.showValidationMessage('Please select your team size');
                    return false;
                }
                
                return { companyName, teamSize, message };
            }
        }).then(async (result: any) => {
            if (result.isConfirmed) {
                try {
                    const config = useRuntimeConfig();
                    const token = getAuthToken();
                    
                    const response = await $fetch(`${config.public.apiBase}/subscription/enterprise-request`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Authorization-Type': 'auth',
                            'Content-Type': 'application/json',
                        },
                        body: {
                            companyName: result.value.companyName,
                            teamSize: result.value.teamSize,
                            message: result.value.message
                        }
                    }) as any;
                    
                    if (response.success) {
                        $swal.fire({
                            icon: 'success',
                            title: 'Request Submitted!',
                            text: 'Thank you for your interest. Our team will contact you within 24 hours.',
                            confirmButtonColor: '#9333ea',
                        });
                    }
                } catch (error: any) {
                    console.error('Failed to submit enterprise request:', error);
                    $swal.fire({
                        icon: 'error',
                        title: 'Submission Failed',
                        text: error.message || 'Failed to submit request. Please try again or email us directly.',
                        confirmButtonColor: '#ef4444',
                    });
                }
            }
        });
    } else {
        // For downgrades - show form to submit request
        const downgradeMatch = reason.match(/downgrade to (.+)/i);
        const targetTier = downgradeMatch ? downgradeMatch[1].toUpperCase() : 'FREE';
        
        // Validate targetTier is a known tier name to prevent injection
        const validTiers = ['FREE', 'STARTER', 'PROFESSIONAL', 'PROFESSIONAL_PLUS', 'BUSINESS', 'ENTERPRISE'];
        const safeTier = validTiers.includes(targetTier) ? targetTier : 'FREE';
        
        $swal.fire({
            title: `Request Downgrade to ${safeTier}`,
            html: `
                <div class="text-left space-y-4">
                    <p class="text-sm text-gray-600">We're sorry to see you go down a tier. Please tell us why so we can improve our service.</p>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Reason for Downgrade</label>
                        <select id="downgrade-reason" class="swal2-input w-full">
                            <option value="">Select a reason...</option>
                            <option value="Too expensive">Too expensive</option>
                            <option value="Not using all features">Not using all features</option>
                            <option  value="Switching to competitor">Switching to competitor</option>
                            <option value="Business downsizing">Business downsizing</option>
                            <option value="Seasonal use">Seasonal use - will upgrade later</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Additional Details (Optional)</label>
                        <textarea id="downgrade-message" class="swal2-textarea w-full" placeholder="Tell us more about your decision..." rows="3"></textarea>
                    </div>
                    <p class="text-xs text-gray-500">Our support team will review your request within 24-48 hours.</p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Submit Request',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#f97316',
            cancelButtonColor: '#6b7280',
            width: '600px',
            preConfirm: () => {
                const reason = (document.getElementById('downgrade-reason') as HTMLSelectElement)?.value;
                const message = (document.getElementById('downgrade-message') as HTMLTextAreaElement)?.value;
                
                if (!reason) {
                    $swal.showValidationMessage('Please select a reason for downgrading');
                    return false;
                }
                
                return { reason, message };
            }
        }).then(async (result: any) => {
            if (result.isConfirmed) {
                try {
                    const config = useRuntimeConfig();
                    const token = getAuthToken();
                    
                    const response = await $fetch(`${config.public.apiBase}/subscription/downgrade-request`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Authorization-Type': 'auth',
                            'Content-Type': 'application/json',
                        },
                        body: {
                            currentTier: currentTier.value?.toUpperCase(),
                            requestedTier: targetTier,
                            reason: result.value.reason,
                            message: result.value.message
                        }
                    }) as any;
                    
                    if (response.success) {
                        $swal.fire({
                            icon: 'success',
                            title: 'Request Submitted!',
                            text: 'Your downgrade request has been submitted. Our support team will contact you within 24-48 hours.',
                            confirmButtonColor: '#f97316',
                        });
                    }
                } catch (error: any) {
                    console.error('Failed to submit downgrade request:', error);
                    $swal.fire({
                        icon: 'error',
                        title: 'Submission Failed',
                        text: error.message || 'Failed to submit request. Please try again or email us directly at support@dataresearchanalysis.com',
                        confirmButtonColor: '#ef4444',
                    });
                }
            }
        });
    }
}
</script>
