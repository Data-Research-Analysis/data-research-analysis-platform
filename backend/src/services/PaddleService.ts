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
     * Create a checkout session for subscription purchase
     * 
     * @param priceId - Paddle price ID (from subscription tier)
     * @param customerId - Existing Paddle customer ID (optional for new customers)
     * @param metadata - Custom data to attach (e.g., organizationId, tierId)
     * @returns Transaction object with checkout URL
     */
    async createCheckoutSession(
        priceId: string,
        customerId?: string,
        metadata?: Record<string, any>
    ) {
        try {
            const transaction = await this.paddle.transactions.create({
                items: [{ priceId, quantity: 1 }],
                customerId,
                customData: metadata
            });
            
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
    async updateSubscription(subscriptionId: string, priceId: string) {
        try {
            return await this.paddle.subscriptions.update(subscriptionId, {
                items: [{ priceId, quantity: 1 }],
                prorationBillingMode: 'prorated_immediately'
            });
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
        newPriceId: string
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
    }> {
        try {
            console.log('[PaddleService] previewSubscriptionUpdate called:', {
                subscriptionId,
                newPriceId
            });
            
            const preview = await this.paddle.subscriptions.previewUpdate(
                subscriptionId,
                {
                    items: [{ priceId: newPriceId, quantity: 1 }],
                    prorationBillingMode: 'prorated_immediately'
                }
            );
            
            console.log('[PaddleService] Preview response received:', JSON.stringify(preview, null, 2));
            console.log('[PaddleService] Preview keys:', Object.keys(preview));
            console.log('[PaddleService] Has immediateTransaction:', !!preview.immediateTransaction);
            console.log('[PaddleService] Has recurring_transaction_details:', !!preview.recurring_transaction_details);
            console.log('[PaddleService] Has next_transaction:', !!preview.next_transaction);
            console.log('[PaddleService] Has update_summary:', !!preview.update_summary);
            console.log('[PaddleService] Has scheduled_change:', !!preview.scheduled_change);
            
            // Extract next billing details - they might be in different places
            let nextBillingAmount = '0';
            let nextBillingDate = '';
            
            if (preview.recurring_transaction_details?.totals?.total) {
                nextBillingAmount = preview.recurring_transaction_details.totals.total;
                nextBillingDate = preview.billing_period?.starts_at || preview.recurring_transaction_details.billing_period?.starts_at || '';
                console.log('[PaddleService] Found in recurring_transaction_details');
            } else if (preview.next_transaction?.details?.totals?.total) {
                nextBillingAmount = preview.next_transaction.details.totals.total;
                nextBillingDate = preview.next_transaction.billing_period?.starts_at || '';
                console.log('[PaddleService] Found in next_transaction');
            } else if (preview.update_summary?.result?.next_billing_period?.totals?.total) {
                nextBillingAmount = preview.update_summary.result.next_billing_period.totals.total;
                nextBillingDate = preview.update_summary.result.next_billing_period.starts_at || '';
                console.log('[PaddleService] Found in update_summary');
            } else if (preview.scheduled_change?.next_payment?.amount) {
                nextBillingAmount = preview.scheduled_change.next_payment.amount;
                nextBillingDate = preview.scheduled_change.effective_at || '';
                console.log('[PaddleService] Found in scheduled_change');
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
                nextBillingDate
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
    async generatePaymentMethodUpdateUrl(customerId: string) {
        try {
            // Create a transaction with no items to get billing portal URL
            const transaction = await this.paddle.transactions.create({
                items: [], // Empty items array for payment method update
                customerId
            });
            
            return transaction.checkout?.url;
        } catch (error: any) {
            console.error(`❌ Failed to generate payment method update URL for ${customerId}:`, error);
            throw new Error(`Failed to generate billing portal URL: ${error.message}`);
        }
    }
    
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
}
