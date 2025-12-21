import { describe, it, expect, beforeEach } from '@jest/globals';
import { GoogleAdManagerService } from '../GoogleAdManagerService.js';
import { GAMReportType } from '../../types/IGoogleAdManager.js';

/**
 * Unit tests for GoogleAdManagerService
 * Tests report query building and service methods
 */
describe('GoogleAdManagerService', () => {
    let gamService: GoogleAdManagerService;
    
    beforeEach(() => {
        gamService = GoogleAdManagerService.getInstance();
    });
    
    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = GoogleAdManagerService.getInstance();
            const instance2 = GoogleAdManagerService.getInstance();
            
            expect(instance1).toBe(instance2);
        });
    });
    
    describe('Revenue Report Query Building', () => {
        it('should build revenue report query with correct structure', () => {
            const query = gamService.buildRevenueReportQuery('12345', '2025-01-01', '2025-01-31');
            
            expect(query).toBeDefined();
            expect(query.networkCode).toBe('12345');
            expect(query.startDate).toBe('2025-01-01');
            expect(query.endDate).toBe('2025-01-31');
        });
        
        it('should include required revenue dimensions', () => {
            const query = gamService.buildRevenueReportQuery('12345', '2025-01-01', '2025-01-31');
            
            expect(query.dimensions).toContain('DATE');
            expect(query.dimensions).toContain('AD_UNIT_ID');
            expect(query.dimensions).toContain('AD_UNIT_NAME');
            expect(query.dimensions).toContain('COUNTRY_CODE');
            expect(query.dimensions).toContain('COUNTRY_NAME');
        });
        
        it('should include required revenue metrics', () => {
            const query = gamService.buildRevenueReportQuery('12345', '2025-01-01', '2025-01-31');
            
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS');
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_CLICKS');
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE');
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_CTR');
        });
    });
    
    describe('Ad Unit Report Query Building', () => {
        it('should build ad unit report query with correct structure', () => {
            const query = gamService.buildAdUnitReportQuery('67890', '2025-02-01', '2025-02-28');
            
            expect(query).toBeDefined();
            expect(query.networkCode).toBe('67890');
            expect(query.startDate).toBe('2025-02-01');
            expect(query.endDate).toBe('2025-02-28');
        });
        
        it('should include required ad unit dimensions', () => {
            const query = gamService.buildAdUnitReportQuery('67890', '2025-02-01', '2025-02-28');
            
            expect(query.dimensions).toContain('DATE');
            expect(query.dimensions).toContain('AD_UNIT_ID');
            expect(query.dimensions).toContain('AD_UNIT_NAME');
        });
        
        it('should include required ad unit metrics', () => {
            const query = gamService.buildAdUnitReportQuery('67890', '2025-02-01', '2025-02-28');
            
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS');
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_CLICKS');
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE');
        });
    });
    
    describe('Advertiser Report Query Building', () => {
        it('should build advertiser report query with correct structure', () => {
            const query = gamService.buildAdvertiserReportQuery('11111', '2025-03-01', '2025-03-31');
            
            expect(query).toBeDefined();
            expect(query.networkCode).toBe('11111');
            expect(query.startDate).toBe('2025-03-01');
            expect(query.endDate).toBe('2025-03-31');
        });
        
        it('should include required advertiser dimensions', () => {
            const query = gamService.buildAdvertiserReportQuery('11111', '2025-03-01', '2025-03-31');
            
            expect(query.dimensions).toContain('DATE');
            expect(query.dimensions).toContain('ORDER_ID');
            expect(query.dimensions).toContain('ORDER_NAME');
            expect(query.dimensions).toContain('LINE_ITEM_ID');
            expect(query.dimensions).toContain('LINE_ITEM_NAME');
            expect(query.dimensions).toContain('ADVERTISER_ID');
            expect(query.dimensions).toContain('ADVERTISER_NAME');
        });
        
        it('should include required advertiser metrics', () => {
            const query = gamService.buildAdvertiserReportQuery('11111', '2025-03-01', '2025-03-31');
            
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_IMPRESSIONS');
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_CLICKS');
            expect(query.metrics).toContain('TOTAL_LINE_ITEM_LEVEL_CPM_AND_CPC_REVENUE');
        });
    });
    
    describe('Geography Report Query Building', () => {
        it('should build geography report query with correct structure', () => {
            const query = gamService.buildGeographyReportQuery('22222', '2025-04-01', '2025-04-30');
            
            expect(query).toBeDefined();
            expect(query.networkCode).toBe('22222');
            expect(query.startDate).toBe('2025-04-01');
            expect(query.endDate).toBe('2025-04-30');
        });
        
        it('should include required geography dimensions', () => {
            const query = gamService.buildGeographyReportQuery('22222', '2025-04-01', '2025-04-30');
            
            expect(query.dimensions).toContain('DATE');
            expect(query.dimensions).toContain('COUNTRY_CODE');
            expect(query.dimensions).toContain('COUNTRY_NAME');
            expect(query.dimensions).toContain('REGION_NAME');
            expect(query.dimensions).toContain('CITY_NAME');
        });
    });
    
    describe('Device Report Query Building', () => {
        it('should build device report query with correct structure', () => {
            const query = gamService.buildDeviceReportQuery('33333', '2025-05-01', '2025-05-31');
            
            expect(query).toBeDefined();
            expect(query.networkCode).toBe('33333');
            expect(query.startDate).toBe('2025-05-01');
            expect(query.endDate).toBe('2025-05-31');
        });
        
        it('should include required device dimensions', () => {
            const query = gamService.buildDeviceReportQuery('33333', '2025-05-01', '2025-05-31');
            
            expect(query.dimensions).toContain('DATE');
            expect(query.dimensions).toContain('DEVICE_CATEGORY_NAME');
            expect(query.dimensions).toContain('BROWSER_NAME');
            expect(query.dimensions).toContain('OPERATING_SYSTEM_NAME');
        });
    });
    
    describe('Report Type Conversion', () => {
        it('should convert "revenue" string to REVENUE enum', () => {
            const reportType = gamService.getReportType('revenue');
            expect(reportType).toBe(GAMReportType.REVENUE);
        });
        
        it('should convert "ad_unit" string to AD_UNIT enum', () => {
            const reportType = gamService.getReportType('ad_unit');
            expect(reportType).toBe(GAMReportType.AD_UNIT);
        });
        
        it('should convert "advertiser" string to ADVERTISER enum', () => {
            const reportType = gamService.getReportType('advertiser');
            expect(reportType).toBe(GAMReportType.ADVERTISER);
        });
        
        it('should convert "geography" string to GEOGRAPHY enum', () => {
            const reportType = gamService.getReportType('geography');
            expect(reportType).toBe(GAMReportType.GEOGRAPHY);
        });
        
        it('should convert "device" string to DEVICE enum', () => {
            const reportType = gamService.getReportType('device');
            expect(reportType).toBe(GAMReportType.DEVICE);
        });
        
        it('should handle uppercase report type strings', () => {
            const reportType = gamService.getReportType('REVENUE');
            expect(reportType).toBe(GAMReportType.REVENUE);
        });
        
        it('should handle mixed case report type strings', () => {
            const reportType = gamService.getReportType('ReVeNuE');
            expect(reportType).toBe(GAMReportType.REVENUE);
        });
        
        it('should throw error for unknown report type', () => {
            expect(() => {
                gamService.getReportType('invalid_report_type');
            }).toThrow('Unknown report type: invalid_report_type');
        });
    });
    
    describe('Date Range Validation', () => {
        it('should accept valid date range', () => {
            const query = gamService.buildRevenueReportQuery('12345', '2025-01-01', '2025-01-31');
            
            expect(query.startDate).toBe('2025-01-01');
            expect(query.endDate).toBe('2025-01-31');
        });
        
        it('should accept single day date range', () => {
            const query = gamService.buildRevenueReportQuery('12345', '2025-01-15', '2025-01-15');
            
            expect(query.startDate).toBe('2025-01-15');
            expect(query.endDate).toBe('2025-01-15');
        });
    });
    
    describe('Network Code Handling', () => {
        it('should handle numeric network codes', () => {
            const query = gamService.buildRevenueReportQuery('123456789', '2025-01-01', '2025-01-31');
            
            expect(query.networkCode).toBe('123456789');
        });
        
        it('should handle alphanumeric network codes', () => {
            const query = gamService.buildRevenueReportQuery('ABC123', '2025-01-01', '2025-01-31');
            
            expect(query.networkCode).toBe('ABC123');
        });
    });
});
