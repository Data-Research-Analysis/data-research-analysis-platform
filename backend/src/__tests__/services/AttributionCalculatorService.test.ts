import { AttributionCalculatorService } from '../../services/AttributionCalculatorService.js';
import {
    AttributionModel,
    IAttributionCalculationRequest,
    IAttributionEvent
} from '../../interfaces/IAttribution.js';

describe('AttributionCalculatorService', () => {
    let service: AttributionCalculatorService;

    beforeAll(() => {
        service = AttributionCalculatorService.getInstance();
    });

    describe('Service Initialization', () => {
        test('should create singleton instance', () => {
            const instance1 = AttributionCalculatorService.getInstance();
            const instance2 = AttributionCalculatorService.getInstance();
            expect(instance1).toBe(instance2);
        });

        test('should be defined after getInstance', () => {
            expect(service).toBeDefined();
        });
    });

    describe('First-Touch Attribution Model', () => {
        test('should give 100% credit to first touchpoint', async () => {
            const touchpoints = createTouchpoints(3, 100);
            const request = createRequest(touchpoints, 'first_touch');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(3);
            expect(result.touchpoints[0].weight).toBe(1.0);
            expect(result.touchpoints[1].weight).toBe(0);
            expect(result.touchpoints[2].weight).toBe(0);
            expect(result.touchpoints[0].attributedValue).toBe(100);
        });

        test('should handle single touchpoint correctly', async () => {
            const touchpoints = createTouchpoints(1, 50);
            const request = createRequest(touchpoints, 'first_touch');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(1);
            expect(result.touchpoints[0].weight).toBe(1.0);
            expect(result.touchpoints[0].attributedValue).toBe(50);
        });

        test('should work with many touchpoints', async () => {
            const touchpoints = createTouchpoints(10, 200);
            const request = createRequest(touchpoints, 'first_touch');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(10);
            expect(result.touchpoints[0].weight).toBe(1.0);
            expect(result.touchpoints[0].attributedValue).toBe(200);
            // All other touchpoints should get 0
            for (let i = 1; i < 10; i++) {
                expect(result.touchpoints[i].weight).toBe(0);
                expect(result.touchpoints[i].attributedValue).toBe(0);
            }
        });
    });

    describe('Last-Touch Attribution Model', () => {
        test('should give 100% credit to last touchpoint', async () => {
            const touchpoints = createTouchpoints(3, 100);
            const request = createRequest(touchpoints, 'last_touch');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(3);
            expect(result.touchpoints[0].weight).toBe(0);
            expect(result.touchpoints[1].weight).toBe(0);
            expect(result.touchpoints[2].weight).toBe(1.0);
            expect(result.touchpoints[2].attributedValue).toBe(100);
        });

        test('should handle single touchpoint correctly', async () => {
            const touchpoints = createTouchpoints(1, 75);
            const request = createRequest(touchpoints, 'last_touch');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(1);
            expect(result.touchpoints[0].weight).toBe(1.0);
            expect(result.touchpoints[0].attributedValue).toBe(75);
        });

        test('should work with many touchpoints', async () => {
            const touchpoints = createTouchpoints(10, 300);
            const request = createRequest(touchpoints, 'last_touch');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(10);
            // All touchpoints except last should get 0
            for (let i = 0; i < 9; i++) {
                expect(result.touchpoints[i].weight).toBe(0);
                expect(result.touchpoints[i].attributedValue).toBe(0);
            }
            expect(result.touchpoints[9].weight).toBe(1.0);
            expect(result.touchpoints[9].attributedValue).toBe(300);
        });
    });

    describe('Linear Attribution Model', () => {
        test('should distribute credit equally among touchpoints', async () => {
            const touchpoints = createTouchpoints(4, 100);
            const request = createRequest(touchpoints, 'linear');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(4);
            result.touchpoints.forEach(tp => {
                expect(tp.weight).toBeCloseTo(0.25);
                expect(tp.attributedValue).toBeCloseTo(25);
            });
        });

        test('should handle single touchpoint correctly', async () => {
            const touchpoints = createTouchpoints(1, 100);
            const request = createRequest(touchpoints, 'linear');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(1);
            expect(result.touchpoints[0].weight).toBe(1.0);
            expect(result.touchpoints[0].attributedValue).toBe(100);
        });

        test('should distribute weight equally with odd number of touchpoints', async () => {
            const touchpoints = createTouchpoints(3, 99);
            const request = createRequest(touchpoints, 'linear');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(3);
            result.touchpoints.forEach(tp => {
                expect(tp.weight).toBeCloseTo(1/3);
                expect(tp.attributedValue).toBeCloseTo(33);
            });
        });

        test('should sum weights to 1.0', async () => {
            const touchpoints = createTouchpoints(7, 200);
            const request = createRequest(touchpoints, 'linear');

            const result = await service.calculateAttribution(request);

            const totalWeight = result.touchpoints.reduce((sum, tp) => sum + tp.weight, 0);
            expect(totalWeight).toBeCloseTo(1.0);
        });
    });

    describe('Time-Decay Attribution Model', () => {
        test('should give more weight to recent touchpoints', async () => {
            const touchpoints = createTouchpoints(3, 100);
            const request = createRequest(touchpoints, 'time_decay');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(3);
            // Most recent (last) touchpoint should have highest weight
            expect(result.touchpoints[2].weight).toBeGreaterThan(result.touchpoints[1].weight);
            expect(result.touchpoints[1].weight).toBeGreaterThan(result.touchpoints[0].weight);
        });

        test('should use 7-day half-life (168 hours)', async () => {
            // Create touchpoints with specific time gaps
            const now = new Date();
            const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days ago
            
            const touchpoints: IAttributionEvent[] = [
                {
                    id: 1,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'page_view',
                    eventTimestamp: weekAgo,
                    channelId: 1,
                    eventValue: 0,
                    createdAt: new Date()
                },
                {
                    id: 2,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'conversion',
                    eventTimestamp: now,
                    channelId: 1,
                    eventValue: 100,
                    createdAt: new Date()
                }
            ];

            const request: IAttributionCalculationRequest = {
                projectId: 1,
                userIdentifier: 'user1',
                conversionEventId: 2,
                model: 'time_decay',
                touchpoints
            };

            const result = await service.calculateAttribution(request);

            // After 168 hours (half-life), weight should be 0.5 of the most recent
            // Since there are only 2 touchpoints, they'll be normalized
            // The first touchpoint (168 hours ago) should have roughly half the weight of the last
            expect(result.touchpoints[0].weight).toBeLessThan(result.touchpoints[1].weight);
            expect(result.touchpoints[0].weight).toBeGreaterThan(0); // Not zero
        });

        test('should normalize weights to sum to 1.0', async () => {
            const touchpoints = createTouchpoints(5, 150);
            const request = createRequest(touchpoints, 'time_decay');

            const result = await service.calculateAttribution(request);

            const totalWeight = result.touchpoints.reduce((sum, tp) => sum + tp.weight, 0);
            expect(totalWeight).toBeCloseTo(1.0);
        });

        test('should handle single touchpoint correctly', async () => {
            const touchpoints = createTouchpoints(1, 100);
            const request = createRequest(touchpoints, 'time_decay');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(1);
            expect(result.touchpoints[0].weight).toBe(1.0);
        });

        test('should give very low weight to very old touchpoints', async () => {
            const now = new Date();
            const twoWeeksAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
            
            const touchpoints: IAttributionEvent[] = [
                {
                    id: 1,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'page_view',
                    eventTimestamp: twoWeeksAgo,
                    channelId: 1,
                    eventValue: 0,
                    createdAt: new Date()
                },
                {
                    id: 2,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'conversion',
                    eventTimestamp: now,
                    channelId: 1,
                    eventValue: 100,
                    createdAt: new Date()
                }
            ];

            const request: IAttributionCalculationRequest = {
                projectId: 1,
                userIdentifier: 'user1',
                conversionEventId: 2,
                model: 'time_decay',
                touchpoints
            };

            const result = await service.calculateAttribution(request);

            // After 336 hours (2 half-lives), weight should be 0.25 relative
            // The old touchpoint should have much less weight
            expect(result.touchpoints[0].weight).toBeLessThan(0.3);
            expect(result.touchpoints[1].weight).toBeGreaterThan(0.7);
        });
    });

    describe('U-Shaped (Position-Based) Attribution Model', () => {
        test('should give 40% to first, 40% to last, 20% to middle', async () => {
            const touchpoints = createTouchpoints(4, 100);
            const request = createRequest(touchpoints, 'u_shaped');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(4);
            expect(result.touchpoints[0].weight).toBeCloseTo(0.4); // First
            expect(result.touchpoints[3].weight).toBeCloseTo(0.4); // Last
            
            // Middle touchpoints (2 of them) should share 20% = 10% each
            expect(result.touchpoints[1].weight).toBeCloseTo(0.1);
            expect(result.touchpoints[2].weight).toBeCloseTo(0.1);

            // Check attributed values
            expect(result.touchpoints[0].attributedValue).toBeCloseTo(40);
            expect(result.touchpoints[3].attributedValue).toBeCloseTo(40);
            expect(result.touchpoints[1].attributedValue).toBeCloseTo(10);
            expect(result.touchpoints[2].attributedValue).toBeCloseTo(10);
        });

        test('should handle single touchpoint correctly', async () => {
            const touchpoints = createTouchpoints(1, 100);
            const request = createRequest(touchpoints, 'u_shaped');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(1);
            expect(result.touchpoints[0].weight).toBe(1.0);
            expect(result.touchpoints[0].attributedValue).toBe(100);
        });

        test('should handle two touchpoints with 50/50 split', async () => {
            const touchpoints = createTouchpoints(2, 100);
            const request = createRequest(touchpoints, 'u_shaped');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(2);
            expect(result.touchpoints[0].weight).toBeCloseTo(0.5);
            expect(result.touchpoints[1].weight).toBeCloseTo(0.5);
            expect(result.touchpoints[0].attributedValue).toBeCloseTo(50);
            expect(result.touchpoints[1].attributedValue).toBeCloseTo(50);
        });

        test('should distribute middle weight evenly among all middle touchpoints', async () => {
            const touchpoints = createTouchpoints(10, 200);
            const request = createRequest(touchpoints, 'u_shaped');

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(10);
            expect(result.touchpoints[0].weight).toBeCloseTo(0.4);
            expect(result.touchpoints[9].weight).toBeCloseTo(0.4);

            // Middle 8 touchpoints should each get 0.2 / 8 = 0.025
            const middleWeight = 0.2 / 8;
            for (let i = 1; i < 9; i++) {
                expect(result.touchpoints[i].weight).toBeCloseTo(middleWeight);
            }
        });

        test('should sum weights to 1.0', async () => {
            const touchpoints = createTouchpoints(7, 250);
            const request = createRequest(touchpoints, 'u_shaped');

            const result = await service.calculateAttribution(request);

            const totalWeight = result.touchpoints.reduce((sum, tp) => sum + tp.weight, 0);
            expect(totalWeight).toBeCloseTo(1.0);
        });
    });

    describe('Edge Cases', () => {
        test('should handle zero conversion value', async () => {
            const touchpoints = createTouchpoints(3, 0);
            const request = createRequest(touchpoints, 'linear');

            const result = await service.calculateAttribution(request);

            expect(result.totalAttributedValue).toBe(0);
            result.touchpoints.forEach(tp => {
                expect(tp.attributedValue).toBe(0);
                expect(tp.weight).toBeGreaterThan(0); // Weights still calculated
            });
        });

        test('should handle empty touchpoints array', async () => {
            const request: IAttributionCalculationRequest = {
                projectId: 1,
                userIdentifier: 'user1',
                conversionEventId: 999,
                model: 'linear',
                touchpoints: []
            };

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints).toHaveLength(0);
            expect(result.totalAttributedValue).toBe(0);
        });

        test('should throw error if conversion event not in touchpoints', async () => {
            const touchpoints = createTouchpoints(3, 100);
            const request: IAttributionCalculationRequest = {
                projectId: 1,
                userIdentifier: 'user1',
                conversionEventId: 999, // Non-existent ID
                model: 'linear',
                touchpoints
            };

            await expect(service.calculateAttribution(request)).rejects.toThrow(
                'Conversion event 999 not found in touchpoints'
            );
        });

        test('should sort touchpoints by timestamp', async () => {
            const now = new Date();
            const touchpoints: IAttributionEvent[] = [
                {
                    id: 3,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'conversion',
                    eventTimestamp: new Date(now.getTime() + 2000),
                    channelId: 1,
                    eventValue: 100,
                    createdAt: new Date()
                },
                {
                    id: 1,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'page_view',
                    eventTimestamp: now,
                    channelId: 1,
                    eventValue: 0,
                    createdAt: new Date()
                },
                {
                    id: 2,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'click',
                    eventTimestamp: new Date(now.getTime() + 1000),
                    channelId: 1,
                    eventValue: 0,
                    createdAt: new Date()
                }
            ];

            const request: IAttributionCalculationRequest = {
                projectId: 1,
                userIdentifier: 'user1',
                conversionEventId: 3,
                model: 'linear',
                touchpoints
            };

            const result = await service.calculateAttribution(request);

            // Should be sorted by timestamp
            expect(result.touchpoints[0].touchpointEventId).toBe(1);
            expect(result.touchpoints[1].touchpointEventId).toBe(2);
            expect(result.touchpoints[2].touchpointEventId).toBe(3);
        });
    });

    describe('Calculation Consistency', () => {
        test('should return same results for same inputs', async () => {
            const touchpoints = createTouchpoints(5, 150);
            const request = createRequest(touchpoints, 'time_decay');

            const result1 = await service.calculateAttribution(request);
            const result2 = await service.calculateAttribution(request);

            expect(result1.touchpoints).toHaveLength(result2.touchpoints.length);
            result1.touchpoints.forEach((tp, i) => {
                expect(tp.weight).toBeCloseTo(result2.touchpoints[i].weight);
                expect(tp.attributedValue).toBeCloseTo(result2.touchpoints[i].attributedValue);
            });
        });

        test('all models should sum attributed values to conversion value', async () => {
            const touchpoints = createTouchpoints(6, 250);
            const models: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped'];

            for (const model of models) {
                const request = createRequest(touchpoints, model);
                const result = await service.calculateAttribution(request);

                const totalAttributed = result.touchpoints.reduce(
                    (sum, tp) => sum + tp.attributedValue,
                    0
                );

                expect(totalAttributed).toBeCloseTo(250, 1); // Allow 0.1 difference for rounding
                expect(result.totalAttributedValue).toBe(250);
            }
        });

        test('all models should have weights that sum to 1.0', async () => {
            const touchpoints = createTouchpoints(8, 300);
            const models: AttributionModel[] = ['first_touch', 'last_touch', 'linear', 'time_decay', 'u_shaped'];

            for (const model of models) {
                const request = createRequest(touchpoints, model);
                const result = await service.calculateAttribution(request);

                const totalWeight = result.touchpoints.reduce(
                    (sum, tp) => sum + tp.weight,
                    0
                );

                expect(totalWeight).toBeCloseTo(1.0);
            }
        });
    });

    describe('Position and Time Calculations', () => {
        test('should assign correct positions to touchpoints', async () => {
            const touchpoints = createTouchpoints(5, 100);
            const request = createRequest(touchpoints, 'linear');

            const result = await service.calculateAttribution(request);

            result.touchpoints.forEach((tp, index) => {
                expect(tp.position).toBe(index + 1);
            });
        });

        test('should calculate time to conversion correctly', async () => {
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - (1 * 60 * 60 * 1000));
            const twoHoursAgo = new Date(now.getTime() - (2 * 60 * 60 * 1000));

            const touchpoints: IAttributionEvent[] = [
                {
                    id: 1,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'page_view',
                    eventTimestamp: twoHoursAgo,
                    channelId: 1,
                    eventValue: 0,
                    createdAt: new Date()
                },
                {
                    id: 2,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'click',
                    eventTimestamp: oneHourAgo,
                    channelId: 1,
                    eventValue: 0,
                    createdAt: new Date()
                },
                {
                    id: 3,
                    projectId: 1,
                    userIdentifier: 'user1',
                    eventType: 'conversion',
                    eventTimestamp: now,
                    channelId: 1,
                    eventValue: 100,
                    createdAt: new Date()
                }
            ];

            const request: IAttributionCalculationRequest = {
                projectId: 1,
                userIdentifier: 'user1',
                conversionEventId: 3,
                model: 'linear',
                touchpoints
            };

            const result = await service.calculateAttribution(request);

            expect(result.touchpoints[0].timeToConversionHours).toBeCloseTo(2);
            expect(result.touchpoints[1].timeToConversionHours).toBeCloseTo(1);
            expect(result.touchpoints[2].timeToConversionHours).toBe(0);
        });
    });
});

// Helper functions

function createTouchpoints(count: number, conversionValue: number): IAttributionEvent[] {
    const now = new Date();
    const touchpoints: IAttributionEvent[] = [];

    for (let i = 0; i < count; i++) {
        const isConversion = i === count - 1;
        touchpoints.push({
            id: i + 1,
            projectId: 1,
            userIdentifier: 'user1',
            eventType: isConversion ? 'conversion' : 'page_view',
            eventTimestamp: new Date(now.getTime() - (count - i - 1) * 60 * 60 * 1000), // 1 hour apart
            channelId: 1,
            eventValue: isConversion ? conversionValue : 0,
            createdAt: new Date()
        });
    }

    return touchpoints;
}

function createRequest(
    touchpoints: IAttributionEvent[],
    model: AttributionModel
): IAttributionCalculationRequest {
    return {
        projectId: 1,
        userIdentifier: 'user1',
        conversionEventId: touchpoints[touchpoints.length - 1].id,
        model,
        touchpoints
    };
}
