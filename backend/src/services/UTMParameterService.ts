import { AppDataSource } from '../datasources/PostgresDS.js';
import { 
    IUTMParameters, 
    IAttributionEvent, 
    IEventTrackingRequest,
    IAttributionChannel
} from '../interfaces/IAttribution.js';

/**
 * UTM Parameter and Event Tracking Service
 * Phase 2: Marketing Attribution Engine
 * 
 * Handles UTM parameter parsing, event tracking, and channel identification
 */
export class UTMParameterService {
    private static instance: UTMParameterService;

    private constructor() {}

    public static getInstance(): UTMParameterService {
        if (!UTMParameterService.instance) {
            UTMParameterService.instance = new UTMParameterService();
        }
        return UTMParameterService.instance;
    }

    /**
     * Parse UTM parameters from URL or object
     */
    public parseUTMParameters(urlOrParams: string | IUTMParameters): IUTMParameters {
        if (typeof urlOrParams === 'object') {
            return urlOrParams;
        }

        try {
            const url = new URL(urlOrParams);
            return {
                source: url.searchParams.get('utm_source') || undefined,
                medium: url.searchParams.get('utm_medium') || undefined,
                campaign: url.searchParams.get('utm_campaign') || undefined,
                term: url.searchParams.get('utm_term') || undefined,
                content: url.searchParams.get('utm_content') || undefined
            };
        } catch (error) {
            console.warn('[UTMParameterService] Invalid URL for UTM parsing:', urlOrParams);
            return {};
        }
    }

    /**
     * Extract referrer domain from full URL
     */
    public extractReferrerDomain(referrerUrl: string): string | null {
        if (!referrerUrl) return null;

        try {
            const url = new URL(referrerUrl);
            return url.hostname.replace('www.', '');
        } catch (error) {
            console.warn('[UTMParameterService] Invalid referrer URL:', referrerUrl);
            return null;
        }
    }

    /**
     * Identify or create channel based on UTM parameters and referrer
     */
    public async identifyChannel(
        projectId: number,
        utmParams: IUTMParameters,
        referrer?: string
    ): Promise<number | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            // First, try to find existing channel by exact match
            let channelId = await this.findExistingChannel(
                queryRunner,
                projectId,
                utmParams,
                referrer
            );

            if (channelId) {
                return channelId;
            }

            // Create new channel if not found
            const channelCategory = this.categorizeTrafficSource(utmParams, referrer);
            const channelName = this.generateChannelName(utmParams, referrer, channelCategory);

            const result = await queryRunner.query(
                `INSERT INTO "dra_attribution_channels" 
                 (project_id, name, category, source, medium, campaign)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING id`,
                [
                    projectId,
                    channelName,
                    channelCategory,
                    utmParams.source || null,
                    utmParams.medium || null,
                    utmParams.campaign || null
                ]
            );

            channelId = result[0].id;
            console.log(`[UTMParameterService] Created new channel: ${channelName} (ID: ${channelId})`);

            return channelId;

        } catch (error) {
            console.error('[UTMParameterService] Error identifying channel:', error);
            return null;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Track attribution event
     */
    public async trackEvent(eventRequest: IEventTrackingRequest): Promise<number | null> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            // Identify channel
            const channelId = eventRequest.utmParams
                ? await this.identifyChannel(
                    eventRequest.projectId,
                    eventRequest.utmParams,
                    eventRequest.referrer
                )
                : null;

            // Insert event
            const result = await queryRunner.query(
                `INSERT INTO "dra_attribution_events"
                 (project_id, user_identifier, session_id, event_type, event_name, 
                  event_value, channel_id, utm_source, utm_medium, utm_campaign, 
                  utm_term, utm_content, referrer, page_url, metadata, event_timestamp)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16, NOW()))
                 RETURNING id`,
                [
                    eventRequest.projectId,
                    eventRequest.userIdentifier,
                    eventRequest.sessionId || null,
                    eventRequest.eventType,
                    eventRequest.eventName || null,
                    eventRequest.eventValue || null,
                    channelId,
                    eventRequest.utmParams?.source || null,
                    eventRequest.utmParams?.medium || null,
                    eventRequest.utmParams?.campaign || null,
                    eventRequest.utmParams?.term || null,
                    eventRequest.utmParams?.content || null,
                    eventRequest.referrer || null,
                    eventRequest.pageUrl || null,
                    eventRequest.metadata ? JSON.stringify(eventRequest.metadata) : null,
                    eventRequest.eventTimestamp || null
                ]
            );

            const eventId = result[0].id;
            console.log(`[UTMParameterService] Tracked event: ${eventRequest.eventType} (ID: ${eventId})`);

            return eventId;

        } catch (error) {
            console.error('[UTMParameterService] Error tracking event:', error);
            return null;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Get events for user within time window
     */
    public async getUserEvents(
        projectId: number,
        userIdentifier: string,
        hoursBack: number = 720 // 30 days default
    ): Promise<IAttributionEvent[]> {
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();

        try {
            const result = await queryRunner.query(
                `SELECT * FROM "dra_attribution_events"
                 WHERE project_id = $1 
                   AND user_identifier = $2
                   AND event_timestamp > NOW() - INTERVAL '${hoursBack} hours'
                 ORDER BY event_timestamp ASC`,
                [projectId, userIdentifier]
            );

            return result.map((row: any) => this.mapEventFromDB(row));

        } catch (error) {
            console.error('[UTMParameterService] Error fetching user events:', error);
            return [];
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Find existing channel by UTM parameters
     */
    private async findExistingChannel(
        queryRunner: any,
        projectId: number,
        utmParams: IUTMParameters,
        referrer?: string
    ): Promise<number | null> {
        try {
            const result = await queryRunner.query(
                `SELECT id FROM "dra_attribution_channels"
                 WHERE project_id = $1
                   AND (source = $2 OR (source IS NULL AND $2 IS NULL))
                   AND (medium = $3 OR (medium IS NULL AND $3 IS NULL))
                   AND (campaign = $4 OR (campaign IS NULL AND $4 IS NULL))
                 LIMIT 1`,
                [
                    projectId,
                    utmParams.source || null,
                    utmParams.medium || null,
                    utmParams.campaign || null
                ]
            );

            return result.length > 0 ? result[0].id : null;
        } catch (error) {
            console.error('[UTMParameterService] Error finding existing channel:', error);
            return null;
        }
    }

    /**
     * Categorize traffic source into standard categories
     */
    private categorizeTrafficSource(utmParams: IUTMParameters, referrer?: string): string {
        const { source, medium } = utmParams;

        // Paid advertising
        if (medium && ['cpc', 'ppc', 'cpm', 'cpp', 'cpv', 'cpa', 'paid'].includes(medium.toLowerCase())) {
            return 'paid';
        }

        // Social media
        const socialDomains = ['facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com', 'pinterest.com', 'tiktok.com', 'youtube.com'];
        if (medium && ['social', 'social-media', 'sm'].includes(medium.toLowerCase())) {
            return 'social';
        }
        if (referrer && socialDomains.some(domain => referrer.includes(domain))) {
            return 'social';
        }

        // Email
        if (medium && ['email', 'e-mail', 'newsletter'].includes(medium.toLowerCase())) {
            return 'email';
        }

        // Organic search
        const searchEngines = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com'];
        if (medium && ['organic', 'search'].includes(medium.toLowerCase())) {
            return 'organic';
        }
        if (referrer && searchEngines.some(domain => referrer.includes(domain))) {
            return 'organic';
        }

        // Referral
        if (referrer && !utmParams.source) {
            return 'referral';
        }

        // Direct
        if (!referrer && !utmParams.source && !utmParams.medium) {
            return 'direct';
        }

        // Default to other
        return 'other';
    }

    /**
     * Generate descriptive channel name
     */
    private generateChannelName(
        utmParams: IUTMParameters,
        referrer: string | undefined,
        category: string
    ): string {
        const { source, medium, campaign } = utmParams;

        if (source && medium && campaign) {
            return `${source} / ${medium} / ${campaign}`;
        }

        if (source && medium) {
            return `${source} / ${medium}`;
        }

        if (source) {
            return source;
        }

        if (referrer) {
            const domain = this.extractReferrerDomain(referrer);
            return domain ? `Referral from ${domain}` : 'Referral';
        }

        // Fallback to category
        const categoryNames: Record<string, string> = {
            'organic': 'Organic Search',
            'paid': 'Paid Advertising',
            'social': 'Social Media',
            'email': 'Email Marketing',
            'direct': 'Direct Traffic',
            'referral': 'Referral Traffic',
            'other': 'Other'
        };

        return categoryNames[category] || 'Unknown';
    }

    /**
     * Map database row to IAttributionEvent
     */
    private mapEventFromDB(row: any): IAttributionEvent {
        return {
            id: row.id,
            projectId: row.project_id,
            userIdentifier: row.user_identifier,
            sessionId: row.session_id,
            eventType: row.event_type,
            eventName: row.event_name,
            eventValue: row.event_value ? parseFloat(row.event_value) : undefined,
            channelId: row.channel_id,
            utmSource: row.utm_source,
            utmMedium: row.utm_medium,
            utmCampaign: row.utm_campaign,
            utmTerm: row.utm_term,
            utmContent: row.utm_content,
            referrer: row.referrer,
            landingPage: row.landing_page,
            pageUrl: row.page_url,
            metadata: row.metadata,
            eventTimestamp: new Date(row.event_timestamp),
            createdAt: new Date(row.created_at)
        };
    }
}
