import { Paddle } from '@paddle/paddle-node-sdk';

/**
 * PaddleService - Singleton service for Paddle.com payment gateway integration
 * 
 * Provides methods for:
 * - Creating checkout sessions
 * - Managing subscriptions (get, update, cancel)
 * - Customer management (create, get)
 * - Generating billing portal URLs
 * 
 * Environment Configuration:
 * - PADDLE_API_KEY: Server-side API key from Paddle dashboard
 * - PADDLE_ENVIRONMENT: 'sandbox' or 'production'
 * 
 * Paddle SDK automatically handles:
 * - Authentication
 * - Rate limiting
 * - Retries
 * 
 * @see documentation/paddle-integration-plan.md
 */
export class PaddleService {
    private static instance: PaddleService;
    private paddle: Paddle;
    private environment: 'sandbox' | 'production';
    
    private constructor() {
        const apiKey = process.env.PADDLE_API_KEY;
        const environment = process.env.PADDLE_ENVIRONMENT || 'sandbox';
        
        if (!apiKey) {
            throw new Error('PADDLE_API_KEY environment variable is required');
        }
        
        if (environment !== 'sandbox' && environment !== 'production') {
            throw new Error('PADDLE_ENVIRONMENT must be either "sandbox" or "production"');
        }
        
        this.environment = environment as 'sandbox' | 'production';
        
        this.paddle = new Paddle(apiKey, {
            environment: this.environment as any
        });
        
        console.log(`📘 Paddle Service initialized (${this.environment})`);
    }
    
    public static getInstance(): PaddleService {
        if (!PaddleService.instance) {
            PaddleService.instance = new PaddleService();
        }
        return PaddleService.instance;
    }
    
    /**
     * Get current environment
     */
    public getEnvironment(): 'sandbox' | 'production' {
        return this.environment;
    }

    /**
     * Get the underlying Paddle SDK client.
     * Used by PaddleSyncService to reuse the authenticated client.
     */
    public getPaddleClient(): Paddle {
        return this.paddle;
    }

    // ─── Product management ───────────────────────────────────────────────────

    /**
     * Create a new product in Paddle (represents one subscription tier).
     * Returns the created product ID.
     */
    async createProduct(name: string, description?: string): Promise<string> {
        try {
            const product = await this.paddle.products.create({
                name,
                taxCategory: 'saas',
                description: description || null
            });
            console.log(`[PaddleService] Created product: ${product.id} (${name})`);
            return product.id;
        } catch (error: any) {
            console.error('❌ Failed to create Paddle product:', error);
            throw new Error(`Failed to create Paddle product: ${error.message}`);
        }
    }

    /**
     * Update an existing Paddle product name (e.g. when tier is renamed).
     */
    async updateProduct(productId: string, name: string): Promise<void> {
        try {
            await this.paddle.products.update(productId, { name });
            console.log(`[PaddleService] Updated product ${productId} name to "${name}"`);
        } catch (error: any) {
            console.error(`❌ Failed to update Paddle product ${productId}:`, error);
            throw new Error(`Failed to update Paddle product: ${error.message}`);
        }
    }

    /**
     * Archive a product in Paddle (soft-delete; existing subscriptions are unaffected).
     */
    async archiveProduct(productId: string): Promise<void> {
        try {
            await this.paddle.products.archive(productId);
            console.log(`[PaddleService] Archived product: ${productId}`);
        } catch (error: any) {
            console.error(`❌ Failed to archive Paddle product ${productId}:`, error);
            throw new Error(`Failed to archive Paddle product: ${error.message}`);
        }
    }

    // ─── Price management ─────────────────────────────────────────────────────

    /**
     * Create a recurring USD price for a product.
     *
     * @param productId - Paddle product ID to attach this price to
     * @param amountCents - Price in integer cents (e.g. 999 = $9.99)
     * @param interval - Billing interval: 'month' | 'year'
     * @param description - Human-readable label (e.g. "Monthly billing")
     * @returns Created price ID
     */
    async createPrice(productId: string, amountCents: number, interval: 'month' | 'year', description: string): Promise<string> {
        try {
            const price = await this.paddle.prices.create({
                productId,
                description,
                unitPrice: { amount: String(amountCents), currencyCode: 'USD' },
                billingCycle: { interval, frequency: 1 }
            });
            console.log(`[PaddleService] Created price: ${price.id} (${interval}, ${amountCents} cents)`);
            return price.id;
        } catch (error: any) {
            console.error('❌ Failed to create Paddle price:', error);
            throw new Error(`Failed to create Paddle price: ${error.message}`);
        }
    }

    /**
     * Archive a price in Paddle (prevents new checkouts; existing subscriptions unaffected).
     */
    async archivePrice(priceId: string): Promise<void> {
        try {
            await this.paddle.prices.archive(priceId);
            console.log(`[PaddleService] Archived price: ${priceId}`);
        } catch (error: any) {
            console.error(`❌ Failed to archive Paddle price ${priceId}:`, error);
            throw new Error(`Failed to archive Paddle price: ${error.message}`);
        }
    }

    // ─── Discount management ──────────────────────────────────────────────────

    /**
     * Create a discount in Paddle (for percentage and fixed-amount promo codes).
     *
     * @param type - 'percentage' | 'flat'
     * @param amount - For percentage: integer string (e.g. "10" = 10%). For flat: cents string (e.g. "1000" = $10).
     * @param code - Optional promo code string (e.g. "SUMMER20")
     * @param recur - Whether discount repeats each billing period
     * @param maximumRecurringIntervals - How many intervals to repeat (null = forever)
     * @param usageLimit - Max redemptions (null = unlimited)
     * @param expiresAt - ISO string expiry date (null = no expiry)
     * @param description - Paddle dashboard label
     * @returns Created discount ID
     */
    async createDiscount(params: {
        type: 'percentage' | 'flat';
        amount: string;
        code?: string;
        recur?: boolean;
        maximumRecurringIntervals?: number | null;
        usageLimit?: number | null;
        expiresAt?: string | null;
        description: string;
    }): Promise<string> {
        try {
            const discount = await this.paddle.discounts.create({
                type: params.type,
                amount: params.amount,
                description: params.description,
                enabledForCheckout: true,
                code: params.code || null,
                recur: params.recur ?? false,
                maximumRecurringIntervals: params.maximumRecurringIntervals ?? null,
                usageLimit: params.usageLimit ?? null,
                expiresAt: params.expiresAt ?? null
            });
            console.log(`[PaddleService] Created discount: ${discount.id} (${params.code || 'no code'})`);
            return discount.id;
        } catch (error: any) {
            console.error('❌ Failed to create Paddle discount:', error);
            throw new Error(`Failed to create Paddle discount: ${error.message}`);
        }
    }

    /**
     * Update mutable fields of an existing Paddle discount.
     */
    async updateDiscount(discountId: string, params: {
        amount?: string;
        usageLimit?: number | null;
        expiresAt?: string | null;
        recur?: boolean;
        maximumRecurringIntervals?: number | null;
        status?: 'active' | 'archived';
    }): Promise<void> {
        try {
            await this.paddle.discounts.update(discountId, params as any);
            console.log(`[PaddleService] Updated discount: ${discountId}`);
        } catch (error: any) {
            console.error('❌ Failed to update Paddle discount %s:', discountId, error);
            throw new Error(`Failed to update Paddle discount: ${error.message}`);
        }
    }

    /**
     * Archive a discount in Paddle (prevents new redemptions).
     */
    async archiveDiscount(discountId: string): Promise<void> {
        try {
            await this.paddle.discounts.archive(discountId);
            console.log(`[PaddleService] Archived discount: ${discountId}`);
        } catch (error: any) {
            console.error('❌ Failed to archive Paddle discount %s:', discountId, error);
            throw new Error(`Failed to archive Paddle discount: ${error.message}`);
        }
    }

    // ─── Customer management ──────────────────────────────────────────────────

    /**
     * Create a checkout session for subscription purchase
     * 
     * @param priceId - Paddle price ID (from subscription tier)
     * @param customerId - Existing Paddle customer ID (optional for new customers)
     * @param metadata - Custom data to attach (e.g., organizationId, tierId)
     * @param discountId - Optional Paddle discount ID to apply
     * @returns Transaction object with checkout URL
     */
    async createCheckoutSession(
        priceId: string,
        customerId?: string,
        metadata?: Record<string, any>,
        discountId?: string
    ) {
        try {
            const transactionData: any = {
                items: [{ priceId, quantity: 1 }],
                customerId,
                customData: metadata
            };
            
            // Apply discount if provided
            if (discountId) {
                transactionData.discountId = discountId;
                console.log(`[PaddleService] Creating transaction with discountId: ${discountId}`);
            } else {
                console.log(`[PaddleService] Creating transaction WITHOUT discount`);
            }
            
            const transaction = await this.paddle.transactions.create(transactionData);
            console.log(`[PaddleService] Transaction created: ${transaction.id}`);
            return transaction;
        } catch (error: any) {
            console.error('❌ Paddle checkout session creation failed:', error);
            throw new Error(`Failed to create checkout session: ${error.message}`);
        }
    }
    
    /**
     * Get subscription details from Paddle
     * 
     * @param subscriptionId - Paddle subscription ID
     * @returns Subscription object with current status, billing details, etc.
     */
    async getSubscription(subscriptionId: string) {
        try {
            return await this.paddle.subscriptions.get(subscriptionId);
        } catch (error: any) {
            console.error(`❌ Failed to get subscription ${subscriptionId}:`, error);
            throw new Error(`Failed to get subscription: ${error.message}`);
        }
    }
    
    /**
     * Cancel a subscription
     * 
     * @param subscriptionId - Paddle subscription ID
     * @param effectiveFrom - When to cancel ('immediately' or 'next_billing_period')
     * @returns Updated subscription object
     */
    async cancelSubscription(
        subscriptionId: string,
        effectiveFrom: 'immediately' | 'next_billing_period' = 'next_billing_period'
    ) {
        try {
            return await this.paddle.subscriptions.cancel(subscriptionId, {
                effectiveFrom
            });
        } catch (error: any) {
            console.error(`❌ Failed to cancel subscription ${subscriptionId}:`, error);
            throw new Error(`Failed to cancel subscription: ${error.message}`);
        }
    }
    
    /**
     * Update subscription (for upgrades/downgrades)
     * 
     * Paddle handles prorated billing automatically with proration_billing_mode.
     * 
     * @param subscriptionId - Paddle subscription ID
     * @param priceId - New price ID to switch to
     * @returns Updated subscription object
     */
    async updateSubscription(subscriptionId: string, priceId: string, discountId?: string) {
        try {
            const updateData: any = {
                items: [{ priceId, quantity: 1 }],
                prorationBillingMode: 'prorated_immediately'
            };
            if (discountId) {
                // Paddle SDK expects a nested discount object for subscription updates
                updateData.discount = { id: discountId, effectiveFrom: 'immediately' };
                console.log(`[PaddleService] Updating subscription with discount: ${discountId}`);
            }
            try {
                return await this.paddle.subscriptions.update(subscriptionId, updateData);
            } catch (discountError: any) {
                if (discountId && discountError?.code === 'subscription_one_off_discount_not_valid') {
                    console.warn(`[PaddleService] Discount ${discountId} is a one-off type — not applicable to subscription updates. Retrying without discount.`);
                    const fallbackData = { ...updateData };
                    delete fallbackData.discount;
                    return await this.paddle.subscriptions.update(subscriptionId, fallbackData);
                }
                throw discountError;
            }
        } catch (error: any) {
            console.error(`❌ Failed to update subscription ${subscriptionId}:`, error);
            throw new Error(`Failed to update subscription: ${error.message}`);
        }
    }
    
    /**
     * Preview proration for subscription update
     * 
     * Returns the amount that will be charged/credited if subscription is updated.
     * Does NOT execute the update - preview only.
     * 
     * @param subscriptionId - Paddle subscription ID
     * @param newPriceId - Target price ID
     * @returns Proration details with amount, currency, credit/charge
     */
    async previewSubscriptionUpdate(
        subscriptionId: string,
        newPriceId: string,
        discountId?: string
    ): Promise<{
        immediatePayment: {
            amount: string;
            currency: string;
        } | null;
        credit: {
            amount: string;
            currency: string;
        } | null;
        nextBillingAmount: string;
        nextBillingDate: string;
        discountApplied: boolean;
    }> {
        try {
            console.log('[PaddleService] previewSubscriptionUpdate called:', {
                subscriptionId,
                newPriceId
            });
            
            const previewData: any = {
                items: [{ priceId: newPriceId, quantity: 1 }],
                prorationBillingMode: 'prorated_immediately'
            };
            let discountApplied = false;
            if (discountId) {
                // Paddle SDK expects a nested discount object for subscription updates
                previewData.discount = { id: discountId, effectiveFrom: 'immediately' };
                console.log(`[PaddleService] Previewing subscription update with discount: ${discountId}`);
            }
            let preview: any;
            try {
                preview = await this.paddle.subscriptions.previewUpdate(
                    subscriptionId,
                    previewData
                );
                if (discountId) discountApplied = true;
            } catch (discountError: any) {
                if (discountId && discountError?.code === 'subscription_one_off_discount_not_valid') {
                    console.warn(`[PaddleService] Discount ${discountId} is a one-off type — not applicable to subscription updates. Retrying without discount.`);
                    const fallbackData = { ...previewData };
                    delete fallbackData.discount;
                    preview = await this.paddle.subscriptions.previewUpdate(subscriptionId, fallbackData);
                    discountApplied = false;
                } else {
                    throw discountError;
                }
            }
            
            console.log('[PaddleService] Preview response received:', JSON.stringify(preview, null, 2));
            console.log('[PaddleService] Preview keys:', Object.keys(preview));
            console.log('[PaddleService] Has immediateTransaction:', !!preview.immediateTransaction);
            console.log('[PaddleService] Has recurringTransactionDetails:', !!(preview as any).recurringTransactionDetails);
            console.log('[PaddleService] Has nextTransaction:', !!(preview as any).nextTransaction);
            console.log('[PaddleService] Has updateSummary:', !!(preview as any).updateSummary);
            console.log('[PaddleService] Has scheduledChange:', !!(preview as any).scheduledChange);
            
            // Extract next billing details - Paddle SDK returns camelCase property names
            const previewAny = preview as any;
            let nextBillingAmount = '0';
            let nextBillingDate = '';
            
            if (previewAny.recurringTransactionDetails?.totals?.total) {
                nextBillingAmount = previewAny.recurringTransactionDetails.totals.total;
                nextBillingDate = previewAny.billingPeriod?.startsAt || previewAny.recurringTransactionDetails.billingPeriod?.startsAt || previewAny.nextBilledAt || '';
                console.log('[PaddleService] Found in recurringTransactionDetails');
            } else if (previewAny.nextTransaction?.details?.totals?.total) {
                nextBillingAmount = previewAny.nextTransaction.details.totals.total;
                nextBillingDate = previewAny.nextBilledAt || previewAny.nextTransaction.billingPeriod?.startsAt || '';
                console.log('[PaddleService] Found in nextTransaction');
            } else if (previewAny.updateSummary?.result?.nextBillingPeriod?.totals?.total) {
                nextBillingAmount = previewAny.updateSummary.result.nextBillingPeriod.totals.total;
                nextBillingDate = previewAny.updateSummary.result.nextBillingPeriod.startsAt || previewAny.nextBilledAt || '';
                console.log('[PaddleService] Found in updateSummary');
            } else if (previewAny.scheduledChange?.nextPayment?.amount) {
                nextBillingAmount = previewAny.scheduledChange.nextPayment.amount;
                nextBillingDate = previewAny.scheduledChange.effectiveAt || '';
                console.log('[PaddleService] Found in scheduledChange');
            } else if (previewAny.nextBilledAt && preview.immediateTransaction) {
                // Fallback: use immediateTransaction total as next billing amount when nextTransaction is absent
                nextBillingAmount = preview.immediateTransaction.details?.totals?.total || '0';
                nextBillingDate = previewAny.nextBilledAt;
                console.log('[PaddleService] Found via immediateTransaction fallback');
            } else {
                console.warn('[PaddleService] Could not find next billing details in any expected location');
                console.warn('[PaddleService] Full preview structure:', JSON.stringify(preview, null, 2));
            }
            
            console.log('[PaddleService] Extracted next billing:', { nextBillingAmount, nextBillingDate });
            
            return {
                immediatePayment: preview.immediateTransaction ? {
                    amount: preview.immediateTransaction.details?.totals?.total || '0',
                    currency: preview.immediateTransaction.currency_code || 'USD'
                } : null,
                credit: preview.credit ? {
                    amount: preview.credit.amount || '0',
                    currency: preview.credit.currency_code || 'USD'
                } : null,
                nextBillingAmount,
                nextBillingDate,
                discountApplied
            };
        } catch (error: any) {
            console.error('❌ Failed to preview subscription update:', error);
            console.error('❌ Error stack:', error.stack);
            throw new Error(`Failed to preview update: ${error.message}`);
        }
    }
    
    /**
     * Get customer details
     * 
     * @param customerId - Paddle customer ID
     * @returns Customer object
     */
    async getCustomer(customerId: string) {
        try {
            return await this.paddle.customers.get(customerId);
        } catch (error: any) {
            console.error(`❌ Failed to get customer ${customerId}:`, error);
            throw new Error(`Failed to get customer: ${error.message}`);
        }
    }
    
    /**
     * Find customer by email address
     * 
     * Searches Paddle for existing customer with the given email.
     * Returns null if no customer found.
     * 
     * @param email - Customer email address to search
     * @returns Customer object or null if not found
     */
    async findCustomerByEmail(email: string) {
        try {
            console.log(`🔍 Searching Paddle for customer with email: ${email}`);
            const response = await this.paddle.customers.list({
                search: email
            });
            
            const customers = [] as any[];
            for await (const customer of response) {
                customers.push(customer);
            }
            
            console.log(`📊 Paddle search returned ${customers.length} customers`);
            if (customers.length > 0) {
                console.log('Customer emails found:', customers.map((c: any) => c.email));
            }
            
            // Find exact email match (search might return partial matches)
            const customer = customers.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
            
            if (customer) {
                console.log(`✅ Found exact match: ${customer.id}`);
            } else {
                console.log('❌ No exact email match found');
            }
            
            return customer || null;
        } catch (error: any) {
            console.error('❌ Failed to search for customer:', error);
            // Don't throw - return null so we can create new customer
            return null;
        }
    }
    
    /**
     * Get or create customer in Paddle
     * 
     * Attempts to create customer. If customer already exists (email conflict),
     * extracts the existing customer ID from the error and retrieves that customer.
     * 
     * @param email - Customer email address
     * @param name - Customer name (typically organization name)
     * @param metadata - Custom data to attach
     * @returns Customer object (created or existing)
     */
    async getOrCreateCustomer(email: string, name: string, metadata?: Record<string, any>) {
        try {
            console.log(`📝 Attempting to create Paddle customer for: ${email}`);
            
            // Try to create customer
            const customer = await this.paddle.customers.create({
                email,
                name,
                customData: metadata
            });
            
            console.log(`✅ Created new Paddle customer: ${customer.id}`);
            return customer;
            
        } catch (error: any) {
            // Check if error is due to existing customer
            if (error.code === 'customer_already_exists' && error.detail) {
                console.log(`⚠️ Customer already exists, extracting ID from error...`);
                
                // Extract customer ID from error message
                // Format: "customer email conflicts with customer of id ctm_xxxxx"
                const match = error.detail.match(/customer of id (ctm_[a-z0-9]+)/i);
                
                if (match && match[1]) {
                    const existingCustomerId = match[1];
                    console.log(`🔄 Using existing customer ID: ${existingCustomerId}`);
                    
                    // Fetch the existing customer details
                    try {
                        const existingCustomer = await this.paddle.customers.get(existingCustomerId);
                        console.log(`✅ Retrieved existing customer: ${existingCustomer.id}`);
                        return existingCustomer;
                    } catch (getError: any) {
                        console.error('❌ Failed to retrieve existing customer:', getError);
                        throw new Error(`Customer exists but could not be retrieved: ${getError.message}`);
                    }
                } else {
                    console.error('❌ Could not extract customer ID from error');
                    throw new Error(`Customer already exists but ID could not be extracted: ${error.detail}`);
                }
            }
            
            // Other errors - throw
            console.error('❌ Failed to create customer:', error);
            throw new Error(`Failed to create customer: ${error.message}`);
        }
    }
    
    /**
     * Create a new customer in Paddle
     * 
     * @deprecated Use getOrCreateCustomer() instead to handle existing customers
     * @param email - Customer email address
     * @param name - Customer name (typically organization name)
     * @param metadata - Custom data to attach
     * @returns Created customer object
     */
    async createCustomer(email: string, name: string, metadata?: Record<string, any>) {
        return this.getOrCreateCustomer(email, name, metadata);
    }
    
    /**
     * Generate payment method update URL
     * 
     * Creates a customer portal URL where the customer can update their payment method.
     * 
     * @param customerId - Paddle customer ID
     * @returns Portal URL
     */
    /**
     * List all transactions for a customer
     * 
     * Useful for payment history display
     * 
     * @param customerId - Paddle customer ID
     * @returns Array of transaction objects
     */
    async getCustomerTransactions(customerId: string) {
        try {
            return await this.paddle.transactions.list({
                customerId: [customerId]
            });
        } catch (error: any) {
            console.error(`❌ Failed to get transactions for customer ${customerId}:`, error);
            throw new Error(`Failed to get customer transactions: ${error.message}`);
        }
    }
    
    /**
     * Get invoice details including PDF URL
     * 
     * @param invoiceId - Paddle invoice ID
     * @returns Invoice object with PDF URL
     */
    async getInvoice(invoiceId: string) {
        try {
            return await this.paddle.invoices.get(invoiceId);
        } catch (error: any) {
            console.error(`❌ Failed to get invoice ${invoiceId}:`, error);
            return null;
        }
    }
}
