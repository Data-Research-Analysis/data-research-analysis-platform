import maxmind, { CountryResponse } from 'maxmind';
import path from 'path';

export enum ConsentRegion {
    EU_EEA_UK = 'eu_eea_uk',      // GDPR - Opt-in required
    CALIFORNIA = 'california',     // CCPA - Opt-out model
    REST_OF_WORLD = 'rest_of_world' // Implied consent
}

const GDPR_COUNTRIES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'IS', 'LI', 'NO', 'CH'
];

export class GeolocationService {
    private static instance: GeolocationService;
    private lookup: maxmind.Reader<CountryResponse> | null = null;
    private initPromise: Promise<void> | null = null;

    private constructor() {
        console.log('🌍 Geolocation Service initializing...');
    }

    public static getInstance(): GeolocationService {
        if (!GeolocationService.instance) {
            GeolocationService.instance = new GeolocationService();
        }
        return GeolocationService.instance;
    }

    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const dbPath = path.join(
                    process.cwd(),
                    'private',
                    'geolocation',
                    'GeoLite2-Country.mmdb'
                );
                this.lookup = await maxmind.open<CountryResponse>(dbPath);
                console.log('✅ Geolocation database loaded successfully');
            } catch (error) {
                console.error('❌ Failed to load geolocation database:', error);
                console.warn('⚠️  Geolocation will fallback to REST_OF_WORLD for all IPs');
                console.warn('⚠️  To fix: Download GeoLite2-Country.mmdb to backend/private/geolocation/');
                // Fallback: service will return REST_OF_WORLD for all IPs
                this.lookup = null;
            }
        })();

        return this.initPromise;
    }

    /**
     * Determine consent region from IP address
     */
    getConsentRegion(ipAddress: string): ConsentRegion {
        if (!this.lookup) {
            console.warn('Geolocation lookup unavailable, defaulting to REST_OF_WORLD');
            return ConsentRegion.REST_OF_WORLD;
        }

        try {
            const result = this.lookup.get(ipAddress);
            if (!result?.country?.iso_code) {
                return ConsentRegion.REST_OF_WORLD;
            }

            const countryCode = result.country.iso_code;

            // Check GDPR countries (EU/EEA/UK)
            if (GDPR_COUNTRIES.includes(countryCode)) {
                return ConsentRegion.EU_EEA_UK;
            }

            // Check California (US state detection requires City database)
            // For now, treat all US as California to be safe with CCPA
            if (countryCode === 'US') {
                return ConsentRegion.CALIFORNIA;
            }

            // All other regions
            return ConsentRegion.REST_OF_WORLD;

        } catch (error) {
            console.error('Error looking up IP:', error);
            return ConsentRegion.REST_OF_WORLD;
        }
    }

    /**
     * Get user's IP from request (handles proxies/load balancers)
     */
    getClientIP(req: any): string {
        // Check Cloudflare header
        const cfIP = req.headers['cf-connecting-ip'];
        if (cfIP) return cfIP;

        // Check X-Forwarded-For (load balancer/proxy)
        const forwarded = req.headers['x-forwarded-for'];
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }

        // Check X-Real-IP
        const realIP = req.headers['x-real-ip'];
        if (realIP) return realIP;

        // Fallback to socket
        return req.connection?.remoteAddress || req.socket?.remoteAddress || '127.0.0.1';
    }
}
