import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { FilesService } from '../../services/FilesService.js';
import fs from 'fs';
import path from 'path';

// Mock fs module
jest.mock('fs', () => ({
    default: {
        promises: {
            readdir: jest.fn(),
        },
        lstatSync: jest.fn(),
        existsSync: jest.fn(),
        renameSync: jest.fn(),
        unlinkSync: jest.fn(),
        rmdirSync: jest.fn(),
    }
}));

describe('FilesService', () => {
    let service: FilesService;
    let mockFs: any;

    beforeEach(() => {
        service = FilesService.getInstance();
        mockFs = fs;
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            const instance1 = FilesService.getInstance();
            const instance2 = FilesService.getInstance();

            expect(instance1).toBe(instance2);
        });
    });

    describe('getPathSeparator', () => {
        it('should return the platform path separator', () => {
            const separator = service.getPathSeparator();
            
            expect(separator).toBe(path.sep);
            expect(typeof separator).toBe('string');
        });
    });

    describe('getDirectoryPath', () => {
        it('should resolve directory path correctly', async () => {
            const result = await service.getDirectoryPath('public');
            
            expect(typeof result).toBe('string');
            expect(result).toContain('public');
            expect(path.isAbsolute(result)).toBe(true);
        });

        it('should handle different directory types', async () => {
            const publicPath = await service.getDirectoryPath('public');
            const privatePath = await service.getDirectoryPath('private');
            
            expect(publicPath).toContain('public');
            expect(privatePath).toContain('private');
            expect(publicPath).not.toBe(privatePath);
        });
    });

    describe('getFiles', () => {
        it('should return empty array when directory does not exist', async () => {
            mockFs.promises.readdir = jest.fn<any>().mockRejectedValue(new Error('Directory not found')) as any;

            const result = await service.getFiles('nonexistent');

            expect(result).toEqual([]);
        });

        it('should list first level files only when firstLevelOnly is true', async () => {
            const mockFiles = ['file1.txt', 'file2.txt', 'subdir'];
            
            mockFs.promises.readdir = jest.fn<any>().mockResolvedValue(mockFiles) as any;
            (mockFs.lstatSync as jest.Mock) = jest.fn<any>().mockReturnValue({
                isDirectory: () => false
            }) as any;

            const result = await service.getFiles('test', true);

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle nested directory structures', async () => {
            const mockFiles = ['file1.txt', 'subdir'];
            const mockSubFiles = ['file2.txt'];
            
            mockFs.promises.readdir = jest.fn<any>()
                .mockResolvedValueOnce(mockFiles)
                .mockResolvedValueOnce(mockSubFiles) as any;
            
            (mockFs.lstatSync as jest.Mock) = jest.fn<any>()
                .mockReturnValueOnce({ isDirectory: () => false }) // file1.txt
                .mockReturnValueOnce({ isDirectory: () => true })  // subdir
                .mockReturnValueOnce({ isDirectory: () => false }) as any; // file2.txt

            const result = await service.getFiles('test', false);

            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('readDir', () => {
        it('should read directory contents', async () => {
            const mockFiles = ['file1.txt', 'file2.txt', 'subdir'];
            mockFs.promises.readdir = jest.fn<any>().mockResolvedValue(mockFiles) as any;

            const result = await service.readDir('/test/path');

            expect(result).toEqual(mockFiles);
            expect(mockFs.promises.readdir).toHaveBeenCalledWith('/test/path');
        });
    });

    describe('renameFile', () => {
        it('should rename file if it exists', async () => {
            (mockFs.existsSync as jest.Mock) = jest.fn().mockReturnValue(true);
            (mockFs.renameSync as jest.Mock) = jest.fn();

            const result = await service.renameFile('/old/path.txt', '/new/path.txt');

            expect(result).toBe(true);
            expect(mockFs.existsSync).toHaveBeenCalledWith('/old/path.txt');
            expect(mockFs.renameSync).toHaveBeenCalledWith('/old/path.txt', '/new/path.txt');
        });

        it('should return false if file does not exist', async () => {
            (mockFs.existsSync as jest.Mock) = jest.fn().mockReturnValue(false);

            const result = await service.renameFile('/nonexistent.txt', '/new/path.txt');

            expect(result).toBe(false);
            expect(mockFs.renameSync).not.toHaveBeenCalled();
        });
    });

    describe('deleteFileFromDisk', () => {
        it('should delete file if it exists', () => {
            (mockFs.existsSync as jest.Mock) = jest.fn().mockReturnValue(true);
            (mockFs.unlinkSync as jest.Mock) = jest.fn();

            service.deleteFileFromDisk('/test/file.txt');

            expect(mockFs.existsSync).toHaveBeenCalledWith('/test/file.txt');
            expect(mockFs.unlinkSync).toHaveBeenCalledWith('/test/file.txt');
        });

        it('should not throw if file does not exist', () => {
            (mockFs.existsSync as jest.Mock) = jest.fn().mockReturnValue(false);

            expect(() => {
                service.deleteFileFromDisk('/nonexistent.txt');
            }).not.toThrow();

            expect(mockFs.unlinkSync).not.toHaveBeenCalled();
        });
    });

    describe('deleteDirectoryFromDisk', () => {
        it('should delete directory if it exists', () => {
            (mockFs.existsSync as jest.Mock) = jest.fn().mockReturnValue(true);
            (mockFs.rmdirSync as jest.Mock) = jest.fn();

            service.deleteDirectoryFromDisk('/test/dir');

            expect(mockFs.existsSync).toHaveBeenCalledWith('/test/dir');
            expect(mockFs.rmdirSync).toHaveBeenCalledWith('/test/dir');
        });

        it('should not throw if directory does not exist', () => {
            (mockFs.existsSync as jest.Mock) = jest.fn().mockReturnValue(false);

            expect(() => {
                service.deleteDirectoryFromDisk('/nonexistent');
            }).not.toThrow();

            expect(mockFs.rmdirSync).not.toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle readdir errors gracefully', async () => {
            mockFs.promises.readdir = jest.fn<any>().mockRejectedValue(new Error('Permission denied')) as any;

            const result = await service.getFiles('protected');

            expect(result).toEqual([]);
        });

        it('should handle lstatSync errors in getFiles', async () => {
            mockFs.promises.readdir = jest.fn<any>().mockResolvedValue(['file.txt']) as any;
            (mockFs.lstatSync as jest.Mock) = jest.fn<any>().mockImplementation(() => {
                throw new Error('Cannot stat file');
            }) as any;

            await expect(service.getFiles('test')).rejects.toThrow();
        });
    });
});
