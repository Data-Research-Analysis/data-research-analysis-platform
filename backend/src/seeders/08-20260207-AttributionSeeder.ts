import { Seeder } from '@jorgebodega/typeorm-seeding';
import { DataSource } from 'typeorm';
import { DRAProject } from '../models/DRAProject.js';

export class AttributionSeeder extends Seeder {
    async run(dataSource: DataSource) {
        console.log('Running AttributionSeeder');
        const manager = dataSource.manager;

        // Find the demo project
        const project = await manager.findOne(DRAProject, {
            where: { name: 'DRA Demo Project' },
        });

        if (!project) {
            console.error('❌ Demo project not found. Please run project seeder first.');
            return;
        }

        console.log(`✅ Found project: ${project.name} (ID: ${project.id})`);

        await manager.transaction(async (transactionManager) => {
            // 1. Create 10 Attribution Channels
            console.log('Creating attribution channels...');
            const channels = [
                { name: 'Organic Search', category: 'organic', source: 'Google', medium: 'organic' },
                { name: 'Paid Search', category: 'paid', source: 'Google Ads', medium: 'cpc', campaign: 'Brand Campaign Q1 2024' },
                { name: 'Paid Social', category: 'paid', source: 'Facebook Ads', medium: 'paid_social', campaign: 'Retargeting Campaign' },
                { name: 'Email Marketing', category: 'email', source: 'Newsletter', medium: 'email', campaign: 'Monthly Newsletter' },
                { name: 'Direct Traffic', category: 'direct', source: 'Direct', medium: 'none' },
                { name: 'Referral', category: 'referral', source: 'Partner Site', medium: 'referral' },
                { name: 'Social Media', category: 'social', source: 'LinkedIn', medium: 'social' },
                { name: 'Display Ads', category: 'paid', source: 'Google Display Network', medium: 'display', campaign: 'Awareness Campaign' },
                { name: 'Affiliate', category: 'referral', source: 'Affiliate Network', medium: 'affiliate', campaign: 'Affiliate Program' },
                { name: 'Other', category: 'other', source: null, medium: null }
            ];

            const channelIds: number[] = [];
            for (const channelData of channels) {
                const result = await transactionManager.query(
                    `INSERT INTO dra_attribution_channels 
                    (name, category, source, medium, campaign, project_id, created_at, updated_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) 
                    RETURNING id`,
                    [channelData.name, channelData.category, channelData.source, channelData.medium, channelData.campaign || null, project.id]
                );
                channelIds.push(result[0].id);
            }
            console.log(`✅ Created ${channelIds.length} channels`);

            // 2. Create 200 Events with 30 unique users over 60 days
            console.log('Creating attribution events...');
            const now = new Date();
            const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            
            const userIds = Array.from({ length: 30 }, (_, i) => `user_${i + 1}`);
            const eventTypes = [
                { type: 'page_view', name: 'Landing Page View', weight: 0.60, hasValue: false },
                { type: 'page_view', name: 'Product Page View', weight: 0.15, hasValue: false },
                { type: 'add_to_cart', name: 'Add to Cart', weight: 0.15, hasValue: false },
                { type: 'conversion', name: 'Purchase Complete', weight: 0.10, hasValue: true }
            ];

            const eventIds: number[] = [];
            const conversionEventIds: number[] = [];
            const userJourneys: Map<string, number[]> = new Map(); // Track events per user

            // Generate 200 events
            for (let i = 0; i < 200; i++) {
                // Pick random user
                const userId = userIds[Math.floor(Math.random() * userIds.length)];
                
                // Generate random timestamp within 60 days
                const randomTime = sixtyDaysAgo.getTime() + Math.random() * (now.getTime() - sixtyDaysAgo.getTime());
                const eventTimestamp = new Date(randomTime);

                // Pick event type based on weight
                const rand = Math.random();
                let eventTypeData;
                if (rand < 0.60) {
                    eventTypeData = eventTypes[0]; // page_view
                } else if (rand < 0.75) {
                    eventTypeData = eventTypes[1]; // product page view
                } else if (rand < 0.90) {
                    eventTypeData = eventTypes[2]; // add_to_cart
                } else {
                    eventTypeData = eventTypes[3]; // conversion
                }

                // Pick random channel
                const channelId = channelIds[Math.floor(Math.random() * channelIds.length)];
                
                // Get channel info for UTM params
                const channelInfo = channels[channelIds.indexOf(channelId)];
                
                // Generate event value for conversions
                const eventValue = eventTypeData.hasValue 
                    ? (Math.random() * 490 + 10).toFixed(2)  // $10-$500
                    : null;

                // Generate session ID (group events by user and day)
                const sessionId = `session_${userId}_${eventTimestamp.toISOString().split('T')[0]}`;

                const result = await transactionManager.query(
                    `INSERT INTO dra_attribution_events 
                    (project_id, user_identifier, session_id, event_type, event_name, event_value, 
                     channel_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
                     referrer, landing_page, page_url, metadata, event_timestamp, created_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW()) 
                    RETURNING id`,
                    [
                        project.id,
                        userId,
                        sessionId,
                        eventTypeData.type,
                        eventTypeData.name,
                        eventValue,
                        channelId,
                        channelInfo.source,
                        channelInfo.medium,
                        channelInfo.campaign,
                        null, // utm_term
                        null, // utm_content
                        'https://www.google.com',
                        'https://example.com/',
                        `https://example.com/products/${Math.floor(Math.random() * 100)}`,
                        JSON.stringify({ device: 'desktop', browser: 'Chrome' }),
                        eventTimestamp,
                    ]
                );
                
                const newEventId = result[0].id;
                eventIds.push(newEventId);

                // Track user journeys
                if (!userJourneys.has(userId)) {
                    userJourneys.set(userId, []);
                }
                userJourneys.get(userId)!.push(newEventId);

                if (eventTypeData.type === 'conversion') {
                    conversionEventIds.push(newEventId);
                }
            }
            console.log(`✅ Created ${eventIds.length} events (${conversionEventIds.length} conversions)`);

            // 3. Create Attribution Touchpoints for conversion events
            console.log('Creating attribution touchpoints...');
            let touchpointCount = 0;

            for (const conversionEventId of conversionEventIds) {
                // Get conversion event details
                const conversionEvent = await transactionManager.query(
                    `SELECT * FROM dra_attribution_events WHERE id = $1`,
                    [conversionEventId]
                );
                
                if (conversionEvent.length === 0) continue;
                
                const conversion = conversionEvent[0];
                const userId = conversion.user_identifier;
                
                // Get all events for this user before the conversion
                const userEvents = await transactionManager.query(
                    `SELECT * FROM dra_attribution_events 
                     WHERE user_identifier = $1 
                     AND event_timestamp <= $2 
                     AND project_id = $3
                     ORDER BY event_timestamp ASC`,
                    [userId, conversion.event_timestamp, project.id]
                );

                if (userEvents.length === 0) continue;

                const totalTouchpoints = userEvents.length;
                
                // Create touchpoint for each event in the journey
                for (let position = 0; position < userEvents.length; position++) {
                    const touchpointEvent = userEvents[position];
                    
                    // Calculate time to conversion
                    const timeToConversionMs = new Date(conversion.event_timestamp).getTime() - new Date(touchpointEvent.event_timestamp).getTime();
                    const timeToConversionHours = (timeToConversionMs / (1000 * 60 * 60)).toFixed(2);

                    // Calculate attribution weights for different models
                    const weights = this.calculateAttributionWeights(position + 1, totalTouchpoints, parseFloat(timeToConversionHours));

                    await transactionManager.query(
                        `INSERT INTO dra_attribution_touchpoints 
                        (project_id, user_identifier, conversion_event_id, touchpoint_event_id, 
                         channel_id, touchpoint_position, time_to_conversion_hours,
                         attribution_weight_first_touch, attribution_weight_last_touch, 
                         attribution_weight_linear, attribution_weight_time_decay, 
                         attribution_weight_u_shaped, created_at) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
                        [
                            project.id,
                            userId,
                            conversionEventId,
                            touchpointEvent.id,
                            touchpointEvent.channel_id,
                            position + 1,
                            timeToConversionHours,
                            weights.firstTouch,
                            weights.lastTouch,
                            weights.linear,
                            weights.timeDecay,
                            weights.uShaped
                        ]
                    );
                    touchpointCount++;
                }
            }
            console.log(`✅ Created ${touchpointCount} touchpoints`);

            // 4. Create 5 Pre-generated Attribution Reports (one per model)
            console.log('Creating attribution reports...');
            const models = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped'];
            const reportTypes = ['channel_performance', 'roi_report', 'journey_map', 'funnel_analysis', 'channel_performance'];
            
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

            for (let i = 0; i < 5; i++) {
                const model = models[i];
                const reportType = reportTypes[i];

                // Calculate metrics for this report
                const totalConversions = conversionEventIds.length;
                const totalRevenue = await transactionManager.query(
                    `SELECT SUM(event_value) as revenue FROM dra_attribution_events 
                     WHERE project_id = $1 AND event_type = 'conversion' AND event_value IS NOT NULL`,
                    [project.id]
                );

                // Get channel breakdown (simplified, should use actual attribution weights)
                const channelBreakdown = await transactionManager.query(
                    `SELECT c.name, COUNT(DISTINCT e.id) as conversions, SUM(e.event_value) as revenue
                     FROM dra_attribution_events e
                     JOIN dra_attribution_channels c ON e.channel_id = c.id
                     WHERE e.project_id = $1 AND e.event_type = 'conversion'
                     GROUP BY c.name`,
                    [project.id]
                );

                await transactionManager.query(
                    `INSERT INTO dra_attribution_reports 
                    (project_id, report_type, attribution_model, date_range_start, date_range_end,
                     total_conversions, total_revenue, channel_breakdown, top_paths, 
                     avg_time_to_conversion_hours, avg_touchpoints_per_conversion, 
                     generated_by_user_id, created_at, updated_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, NOW(), NOW())`,
                    [
                        project.id,
                        reportType,
                        model,
                        thirtyDaysAgo,
                        now,
                        totalConversions,
                        totalRevenue[0]?.revenue || 0,
                        JSON.stringify(channelBreakdown),
                        JSON.stringify([
                            { path: 'Organic Search → Product View → Purchase', conversions: 8 },
                            { path: 'Paid Search → Add to Cart → Purchase', conversions: 5 },
                            { path: 'Email → Product View → Add to Cart → Purchase', conversions: 4 }
                        ]),
                        24.5,
                        3.2,
                    ]
                );
            }
            console.log(`✅ Created 5 attribution reports`);

            // 5. Create 3 Conversion Funnels
            console.log('Creating conversion funnels...');
            const funnels = [
                {
                    name: 'Product Purchase Funnel',
                    steps: [
                        { step: 1, event_type: 'page_view', event_name: 'Landing Page View' },
                        { step: 2, event_type: 'page_view', event_name: 'Product Page View' },
                        { step: 3, event_type: 'add_to_cart', event_name: 'Add to Cart' },
                        { step: 4, event_type: 'conversion', event_name: 'Purchase Complete' }
                    ],
                    entered: 120,
                    completed: 20,
                    conversionRate: 16.67
                },
                {
                    name: 'Newsletter Signup Funnel',
                    steps: [
                        { step: 1, event_type: 'page_view', event_name: 'Landing Page View' },
                        { step: 2, event_type: 'conversion', event_name: 'Newsletter Signup' }
                    ],
                    entered: 80,
                    completed: 35,
                    conversionRate: 43.75
                },
                {
                    name: 'Demo Request Funnel',
                    steps: [
                        { step: 1, event_type: 'page_view', event_name: 'Product Page View' },
                        { step: 2, event_type: 'page_view', event_name: 'Pricing Page View' },
                        { step: 3, event_type: 'conversion', event_name: 'Demo Request Submitted' }
                    ],
                    entered: 60,
                    completed: 18,
                    conversionRate: 30.0
                }
            ];

            for (const funnel of funnels) {
                await transactionManager.query(
                    `INSERT INTO dra_conversion_funnels 
                    (project_id, funnel_name, funnel_steps, total_entered, total_completed, 
                     conversion_rate, step_completion_rates, drop_off_analysis, created_at, updated_at) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
                    [
                        project.id,
                        funnel.name,
                        JSON.stringify(funnel.steps),
                        funnel.entered,
                        funnel.completed,
                        funnel.conversionRate,
                        JSON.stringify([
                            { step: 1, completion_rate: 100 },
                            { step: 2, completion_rate: 65 },
                            { step: 3, completion_rate: 45 },
                            { step: 4, completion_rate: 25 }
                        ]),
                        JSON.stringify({
                            highest_drop_off_step: 2,
                            drop_off_rate: 35
                        })
                    ]
                );
            }
            console.log(`✅ Created 3 conversion funnels`);
        });

        console.log('✅ Attribution seeder completed successfully!');
    }

    // Helper: Calculate attribution weights
    private calculateAttributionWeights(position: number, totalTouchpoints: number, hoursToConversion: number) {
        // First Touch: 100% to first touchpoint
        const firstTouch = position === 1 ? 1.0 : 0.0;

        // Last Touch: 100% to last touchpoint
        const lastTouch = position === totalTouchpoints ? 1.0 : 0.0;

        // Linear: Equal weight to all touchpoints
        const linear = 1.0 / totalTouchpoints;

        // Time Decay: Exponential decay with half-life of 7 days (168 hours)
        const halfLife = 168;
        const timeDecay = Math.exp(-0.693 * hoursToConversion / halfLife) / totalTouchpoints;

        // U-Shaped: 40% first, 40% last, 20% distributed to middle
        let uShaped = 0.0;
        if (totalTouchpoints === 1) {
            uShaped = 1.0;
        } else if (totalTouchpoints === 2) {
            uShaped = 0.5;
        } else {
            if (position === 1) {
                uShaped = 0.4;
            } else if (position === totalTouchpoints) {
                uShaped = 0.4;
            } else {
                uShaped = 0.2 / (totalTouchpoints - 2);
            }
        }

        return {
            firstTouch: parseFloat(firstTouch.toFixed(4)),
            lastTouch: parseFloat(lastTouch.toFixed(4)),
            linear: parseFloat(linear.toFixed(4)),
            timeDecay: parseFloat(timeDecay.toFixed(4)),
            uShaped: parseFloat(uShaped.toFixed(4))
        };
    }
}
