/**
 * Paddle.js SDK Integration Plugin
 * 
 * Loads and initializes the Paddle checkout SDK for subscription payments.
 * Only runs on client-side (browser).
 * 
 * Features:
 * - Dynamic SDK loading from Paddle CDN
 * - Environment-aware initialization (sandbox/production)
 * - Client token authentication
 * - Global window.Paddle object exposure
 * 
 * @see documentation/paddle-integration-plan.md Phase 3, Issue #7
 */
export default defineNuxtPlugin(() => {
    if (import.meta.client) {
        const config = useRuntimeConfig();
        
        console.log('📦 Loading Paddle SDK...');
        
        // Load Paddle.js script from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
        script.async = true;
        document.head.appendChild(script);
        
        script.onload = () => {
            console.log('✅ Paddle SDK loaded');
            
            // Initialize Paddle with environment and client token
            // @ts-ignore - Paddle is loaded dynamically from CDN
            if (window.Paddle) {
                try {
                    // Set environment (sandbox or production)
                    // @ts-ignore
                    window.Paddle.Environment.set(config.public.paddleEnvironment || 'sandbox');
                    
                    // Initialize with client token
                    // @ts-ignore
                    window.Paddle.Initialize({
                        token: config.public.paddleClientToken,
                        eventCallback: (data: any) => {
                            // Log all Paddle events for debugging
                            console.log('🔔 Paddle event:', data);
                        }
                    });
                    
                    console.log(`📘 Paddle initialized (environment: ${config.public.paddleEnvironment || 'sandbox'})`);
                } catch (error) {
                    console.error('❌ Failed to initialize Paddle:', error);
                }
            } else {
                console.error('❌ Paddle SDK loaded but window.Paddle is not available');
            }
        };
        
        script.onerror = () => {
            console.error('❌ Failed to load Paddle SDK from CDN');
        };
    }
});

/**
 * TypeScript declarations for Paddle global object
 */
declare global {
    interface Window {
        Paddle: {
            Environment: {
                set: (environment: 'sandbox' | 'production') => void;
            };
            Initialize: (options: {
                token: string;
                eventCallback?: (data: any) => void;
            }) => void;
            Checkout: {
                open: (options: {
                    items?: Array<{ priceId: string; quantity: number }>;
                    customer?: { email: string };
                    customData?: Record<string, any>;
                    successCallback?: (data: any) => void;
                    closeCallback?: () => void;
                }) => void;
            };
        };
    }
}
