import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { schedulerService, ScheduledJob } from '../SchedulerService';
import { GoogleAdManagerDriver } from '../../drivers/GoogleAdManagerDriver';
import { DataSourceProcessor } from '../../processors/DataSourceProcessor';
import { IAPIConnectionDetails } from '../../types/IAPIConnectionDetails';
import cron from 'node-cron';

// Mock dependencies
jest.mock('../../drivers/GoogleAdManagerDriver');
jest.mock('../../processors/DataSourceProcessor');
jest.mock('node-cron');

describe('SchedulerService', () => {
  let mockConnectionDetails: IAPIConnectionDetails;

  beforeEach(() => {
    // Reset scheduler state
    schedulerService['jobs'].clear();

    // Setup cron mocks
    (cron.schedule as any) = jest.fn();
    (cron.validate as any) = jest.fn();

    // Mock connection details with advanced config
    mockConnectionDetails = {
      oauth_access_token: 'mock_access_token',
      oauth_refresh_token: 'mock_refresh_token',
      token_expiry: new Date('2025-12-31'),
      api_config: {
        network_code: '12345678',
        report_types: ['revenue', 'inventory'],
        advanced_sync_config: {
          reportTypes: ['revenue', 'inventory'],
          networkCode: '12345678',
          frequency: {
            type: 'hourly'
          },
          notifyOnComplete: true,
          notifyOnFailure: true,
          notificationEmails: ['test@example.com']
        }
      }
    } as IAPIConnectionDetails;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up scheduler
    await schedulerService.shutdown();
  });

  describe('scheduleJob', () => {
    it('should schedule a new job with valid configuration', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      const success = await schedulerService.scheduleJob(1, mockConnectionDetails);

      expect(success).toBe(true);
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 */1 * * *', // hourly cron (every hour at minute 0)
        expect.any(Function),
        expect.objectContaining({ timezone: 'UTC' })
      );
    });

    it('should not schedule job with manual frequency', async () => {
      const manualConfig: IAPIConnectionDetails = {
        ...mockConnectionDetails,
        api_config: {
          ...mockConnectionDetails.api_config!,
          advanced_sync_config: {
            ...mockConnectionDetails.api_config!.advanced_sync_config!,
            frequency: {
              type: 'manual'
            }
          }
        }
      };

      const success = await schedulerService.scheduleJob(1, manualConfig);

      expect(success).toBe(false);
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should not schedule job without advanced config', async () => {
      const noConfigDetails: IAPIConnectionDetails = {
        ...mockConnectionDetails,
        api_config: {
          ...mockConnectionDetails.api_config!,
          advanced_sync_config: undefined
        }
      };

      const success = await schedulerService.scheduleJob(1, noConfigDetails);

      expect(success).toBe(false);
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should validate cron expression', async () => {
      (cron.validate as jest.Mock).mockReturnValue(false);

      const success = await schedulerService.scheduleJob(1, mockConnectionDetails);

      expect(success).toBe(false);
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should replace existing job for same data source', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      // Schedule first job
      await schedulerService.scheduleJob(1, mockConnectionDetails);
      expect(mockTask.stop).not.toHaveBeenCalled();

      // Schedule second job for same data source
      await schedulerService.scheduleJob(1, mockConnectionDetails);
      expect(mockTask.stop).toHaveBeenCalledTimes(1); // First job should be stopped
    });
  });

  describe('pauseJob', () => {
    it('should pause an enabled job', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);

      const success = await schedulerService.pauseJob(1);

      expect(success).toBe(true);
      expect(mockTask.stop).toHaveBeenCalled();

      const job = schedulerService.getJob(1);
      expect(job?.enabled).toBe(false);
    });

    it('should return false for non-existent job', async () => {
      const success = await schedulerService.pauseJob(999);
      expect(success).toBe(false);
    });

    it('should return false for already paused job', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);
      await schedulerService.pauseJob(1);

      // Try to pause again
      const success = await schedulerService.pauseJob(1);
      expect(success).toBe(false);
    });
  });

  describe('resumeJob', () => {
    it('should resume a paused job', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);
      await schedulerService.pauseJob(1);

      const success = await schedulerService.resumeJob(1);

      expect(success).toBe(true);
      expect(mockTask.start).toHaveBeenCalled();

      const job = schedulerService.getJob(1);
      expect(job?.enabled).toBe(true);
    });

    it('should return false for non-existent job', async () => {
      const success = await schedulerService.resumeJob(999);
      expect(success).toBe(false);
    });

    it('should return false for already running job', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);

      // Try to resume already running job
      const success = await schedulerService.resumeJob(1);
      expect(success).toBe(false);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a scheduled job', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);

      const success = await schedulerService.cancelJob(1);

      expect(success).toBe(true);
      expect(mockTask.stop).toHaveBeenCalled();

      const job = schedulerService.getJob(1);
      expect(job).toBeNull();
    });

    it('should return false for non-existent job', async () => {
      const success = await schedulerService.cancelJob(999);
      expect(success).toBe(false);
    });
  });

  describe('triggerJob', () => {
    it('should manually trigger a job', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);

      const success = await schedulerService.triggerJob(1);

      expect(success).toBe(true);
    });

    it('should return false for non-existent job', async () => {
      const success = await schedulerService.triggerJob(999);
      expect(success).toBe(false);
    });
  });

  describe('updateJobSchedule', () => {
    it('should update existing job schedule', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      // Schedule initial job
      await schedulerService.scheduleJob(1, mockConnectionDetails);

      // Update to daily
      const updatedConfig: IAPIConnectionDetails = {
        ...mockConnectionDetails,
        api_config: {
          ...mockConnectionDetails.api_config,
          advanced_sync_config: {
            ...mockConnectionDetails.api_config!.advanced_sync_config!,
            frequency: {
              type: 'daily'
            }
          }
        }
      };

      const success = await schedulerService.updateJobSchedule(1, updatedConfig);

      expect(success).toBe(true);
      expect(mockTask.stop).toHaveBeenCalled();
      expect(cron.schedule).toHaveBeenCalledWith(
        '0 0 * * *', // daily cron
        expect.any(Function),
        expect.objectContaining({ timezone: 'UTC' })
      );
    });
  });

  describe('getScheduledJobs', () => {
    it('should return all scheduled jobs', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);

      const jobs = schedulerService.getScheduledJobs();

      expect(jobs).toHaveLength(1);
      expect(jobs[0].dataSourceId).toBe(1);
      expect(jobs[0].schedule).toBe('0 */1 * * *'); // hourly at minute 0
    });

    it('should return empty array when no jobs scheduled', () => {
      const jobs = schedulerService.getScheduledJobs();
      expect(jobs).toHaveLength(0);
    });
  });

  describe('getJob', () => {
    it('should return specific job', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);

      const job = schedulerService.getJob(1);

      expect(job).not.toBeNull();
      expect(job?.dataSourceId).toBe(1);
    });

    it('should return null for non-existent job', () => {
      const job = schedulerService.getJob(999);
      expect(job).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return scheduler statistics', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      // Schedule job
      await schedulerService.scheduleJob(1, mockConnectionDetails);

      const stats = schedulerService.getStats();

      expect(stats.totalJobs).toBe(1);
      expect(stats.activeJobs).toBe(1);
      expect(stats.pausedJobs).toBe(0);
      expect(stats.totalRuns).toBe(0);
    });

    it('should return zero stats when no jobs', () => {
      const stats = schedulerService.getStats();

      expect(stats.totalJobs).toBe(0);
      expect(stats.activeJobs).toBe(0);
      expect(stats.pausedJobs).toBe(0);
      expect(stats.totalRuns).toBe(0);
    });
  });

  describe('initialize', () => {
    it('should initialize without errors', async () => {
      // Initialize is simplified - just logs that it's ready
      await expect(schedulerService.initialize()).resolves.not.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should stop all scheduled jobs', async () => {
      const mockTask = {
        start: jest.fn(),
        stop: jest.fn()
      };
      (cron.schedule as jest.Mock).mockReturnValue(mockTask);
      (cron.validate as jest.Mock).mockReturnValue(true);

      await schedulerService.scheduleJob(1, mockConnectionDetails);

      await schedulerService.shutdown();

      expect(mockTask.stop).toHaveBeenCalled();

      const jobs = schedulerService.getScheduledJobs();
      expect(jobs).toHaveLength(0);
    });
  });
});
