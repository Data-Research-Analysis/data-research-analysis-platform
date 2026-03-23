/**
 * Unit Tests for ColumnTypeInferenceService
 * Tests time-only value detection and type inference
 */

import { ColumnTypeInferenceService } from '../../services/file-uploads/ColumnTypeInferenceService.js';

describe('ColumnTypeInferenceService', () => {
    let service: ColumnTypeInferenceService;

    beforeEach(() => {
        service = ColumnTypeInferenceService.getInstance();
    });

    describe('Time-only value detection', () => {
        it('should detect HH:MM:SS time format', () => {
            const values = ['23:16:58', '08:30:00', '12:45:30', '00:00:00'];
            const result = service.inferColumnType(values, 'transaction_time');
            
            expect(result.type).toBe('time');
        });

        it('should detect HH:MM:SS.mmm time format with milliseconds', () => {
            const values = ['23:16:58.123', '08:30:00.456', '12:45:30.789'];
            const result = service.inferColumnType(values, 'event_time');
            
            expect(result.type).toBe('time');
        });

        it('should detect HH:MM time format (no seconds)', () => {
            const values = ['23:16', '08:30', '12:45', '00:00'];
            const result = service.inferColumnType(values, 'start_time');
            
            expect(result.type).toBe('time');
        });

        it('should NOT detect timestamps as time-only', () => {
            const values = ['2026-01-15 23:16:58', '2026-03-23T12:30:00'];
            const result = service.inferColumnType(values, 'created_at');
            
            expect(result.type).toBe('date'); // Timestamp should be date, not time
        });

        it('should NOT detect dates as time', () => {
            const values = ['2026-01-15', '2026-03-23', '2025-12-31'];
            const result = service.inferColumnType(values, 'transaction_date');
            
            expect(result.type).toBe('date');
        });

        it('should handle mixed time and null values', () => {
            const values = ['23:16:58', null, '08:30:00', '', '12:45:30', 'null'];
            const result = service.inferColumnType(values, 'optional_time');
            
            expect(result.type).toBe('time');
        });

        it('should default to text for mixed time and non-time values', () => {
            const values = ['23:16:58', '08:30:00', 'not a time', '12:45:30'];
            const result = service.inferColumnType(values, 'mixed_column');
            
            expect(result.type).toBe('text');
        });

        it('should handle edge cases for time boundaries', () => {
            const values = ['00:00:00', '23:59:59', '12:00:00'];
            const result = service.inferColumnType(values, 'boundary_times');
            
            expect(result.type).toBe('time');
        });
    });

    describe('Other type detection', () => {
        it('should detect integers', () => {
            const values = [1, 2, 3, 100, -50];
            const result = service.inferColumnType(values, 'count');
            
            expect(result.type).toBe('integer');
        });

        it('should detect decimals', () => {
            const values = [1.5, 2.7, 3.14, 100.99];
            const result = service.inferColumnType(values, 'amount');
            
            expect(result.type).toBe('decimal');
        });

        it('should detect booleans', () => {
            const values = [true, false, true, false];
            const result = service.inferColumnType(values, 'is_active');
            
            expect(result.type).toBe('boolean');
        });

        it('should detect dates from Date objects', () => {
            const values = [new Date('2026-01-15'), new Date('2026-03-23')];
            const result = service.inferColumnType(values, 'created_at');
            
            expect(result.type).toBe('date');
        });

        it('should default to text for empty/null-only columns', () => {
            const values = [null, '', undefined, 'N/A', 'NULL'];
            const result = service.inferColumnType(values, 'empty_column');
            
            expect(result.type).toBe('text');
        });
    });

    describe('Type inference logging', () => {
        it('should log time detection with helpful message', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const result = { type: 'time' as const };
            
            service.logTypeInference('transaction_time', result);
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('[Type Detection] Column "transaction_time": TIME')
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('time-only values detected (HH:MM:SS format)')
            );
            
            consoleSpy.mockRestore();
        });

        it('should not log text type inference', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const result = { type: 'text' as const };
            
            service.logTypeInference('some_column', result);
            
            expect(consoleSpy).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });
});
