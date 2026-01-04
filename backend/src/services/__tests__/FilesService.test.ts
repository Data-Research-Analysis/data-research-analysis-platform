import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FilesService } from '../FilesService.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

/**
 * DRA-TEST-002: FilesService Unit Tests
 * Tests file system operations with mocked fs module
 * Total: 20+ tests
 */
describe('FilesService', () => {
    let filesService: FilesService;
    const mockFs = fs as jest.Mocked<typeof fs>;

    beforeEach(() => {
        filesService = FilesService.getInstance();
        jest.clearAllMocks();
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance on multiple getInstance() calls', () => {
            const instance1 = FilesService.getInstance();
            const instance2 = FilesService.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should maintain state across getInstance() calls', () => {
            const instance1 = FilesService.getInstance();
            const instance2 = FilesService.getInstance();
            expect(instance1).toStrictEqual(instance2);
        });
    });

    describe('getPathSeparator()', () => {
        it('should return correct path separator for current OS', () => {
            const separator = filesService.getPathSeparator();
            expect(separator).toBe(path.sep);
        });

        it('should return "/" on Unix-like systems', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });
            expect(path.sep).toBe('/');
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });

    describe('getDirectoryPath()', () => {
        it('should resolve uploads directory path', () => {
            const result = filesService.getDirectoryPath('uploads');
            expect(result).toContain('uploads');
            expect(path.isAbsolute(result)).toBe(true);
        });

        it('should resolve exports directory path', () => {
            const result = filesService.getDirectoryPath('exports');
            expect(result).toContain('exports');
            expect(path.isAbsolute(result)).toBe(true);
        });

        it('should resolve temp directory path', () => {
            const result = filesService.getDirectoryPath('temp');
            expect(result).toContain('temp');
        });

        it('should handle relative paths correctly', () => {
            const result = filesService.getDirectoryPath('uploads/csv');
            expect(result).toContain('uploads');
            expect(result).toContain('csv');
        });
    });

    describe('getFiles() - Single Level', () => {
        it('should list files in directory (first level only)', () => {
            const mockFiles = ['file1.txt', 'file2.pdf', 'file3.csv'];
            mockFs.readdirSync = jest.fn().mockReturnValue(mockFiles);
            mockFs.statSync = jest.fn().mockReturnValue({ isDirectory: () => false } as any);

            const result = filesService.getFiles('/test/path', true);

            expect(result).toEqual(mockFiles);
            expect(mockFs.readdirSync).toHaveBeenCalledWith('/test/path');
        });

        it('should exclude directories when firstLevelOnly is true', () => {
            const mockEntries = ['file1.txt', 'subdir', 'file2.pdf'];
            mockFs.readdirSync = jest.fn().mockReturnValue(mockEntries);
            mockFs.statSync = jest.fn()
                .mockReturnValueOnce({ isDirectory: () => false } as any)
                .mockReturnValueOnce({ isDirectory: () => true } as any)
                .mockReturnValueOnce({ isDirectory: () => false } as any);

            const result = filesService.getFiles('/test/path', true);

            expect(result).toEqual(['file1.txt', 'file2.pdf']);
            expect(result).not.toContain('subdir');
        });

        it('should handle empty directory', () => {
            mockFs.readdirSync = jest.fn().mockReturnValue([]);

            const result = filesService.getFiles('/empty/path', true);

            expect(result).toEqual([]);
        });
    });

    describe('getFiles() - Multi-Level Traversal', () => {
        it('should recursively list all files when firstLevelOnly is false', () => {
            mockFs.readdirSync = jest.fn()
                .mockReturnValueOnce(['file1.txt', 'subdir'])
                .mockReturnValueOnce(['file2.txt', 'file3.pdf']);

            mockFs.statSync = jest.fn()
                .mockReturnValueOnce({ isDirectory: () => false } as any)
                .mockReturnValueOnce({ isDirectory: () => true } as any)
                .mockReturnValueOnce({ isDirectory: () => false } as any)
                .mockReturnValueOnce({ isDirectory: () => false } as any);

            const result = filesService.getFiles('/test/path', false);

            expect(result.length).toBeGreaterThanOrEqual(1);
            expect(mockFs.readdirSync).toHaveBeenCalled();
        });

        it('should handle nested directory structures', () => {
            mockFs.readdirSync = jest.fn()
                .mockReturnValueOnce(['dir1'])
                .mockReturnValueOnce(['dir2'])
                .mockReturnValueOnce(['file.txt']);

            mockFs.statSync = jest.fn()
                .mockReturnValueOnce({ isDirectory: () => true } as any)
                .mockReturnValueOnce({ isDirectory: () => true } as any)
                .mockReturnValueOnce({ isDirectory: () => false } as any);

            const result = filesService.getFiles('/test/path', false);

            expect(mockFs.readdirSync).toHaveBeenCalledTimes(3);
        });
    });

    describe('readDir()', () => {
        it('should list directory contents successfully', () => {
            const mockEntries = ['file1.txt', 'file2.pdf', 'subdir'];
            mockFs.readdirSync = jest.fn().mockReturnValue(mockEntries);

            const result = filesService.readDir('/test/path');

            expect(result).toEqual(mockEntries);
            expect(mockFs.readdirSync).toHaveBeenCalledWith('/test/path');
        });

        it('should handle directory read errors', () => {
            mockFs.readdirSync = jest.fn().mockImplementation(() => {
                throw new Error('Permission denied');
            });

            expect(() => filesService.readDir('/restricted/path')).toThrow('Permission denied');
        });

        it('should return empty array for empty directory', () => {
            mockFs.readdirSync = jest.fn().mockReturnValue([]);

            const result = filesService.readDir('/empty/dir');

            expect(result).toEqual([]);
        });
    });

    describe('renameFile()', () => {
        it('should rename file successfully', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.renameSync = jest.fn();

            const result = filesService.renameFile('/path/old.txt', '/path/new.txt');

            expect(result).toBe(true);
            expect(mockFs.renameSync).toHaveBeenCalledWith('/path/old.txt', '/path/new.txt');
        });

        it('should return false if source file does not exist', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(false);

            const result = filesService.renameFile('/path/nonexistent.txt', '/path/new.txt');

            expect(result).toBe(false);
            expect(mockFs.renameSync).not.toHaveBeenCalled();
        });

        it('should handle rename errors gracefully', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.renameSync = jest.fn().mockImplementation(() => {
                throw new Error('Rename failed');
            });

            expect(() => filesService.renameFile('/path/old.txt', '/path/new.txt')).toThrow('Rename failed');
        });

        it('should handle special characters in filenames', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.renameSync = jest.fn();

            filesService.renameFile('/path/file (1).txt', '/path/file-new.txt');

            expect(mockFs.renameSync).toHaveBeenCalled();
        });
    });

    describe('deleteFileFromDisk()', () => {
        it('should delete existing file successfully', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.unlinkSync = jest.fn();

            const result = filesService.deleteFileFromDisk('/path/file.txt');

            expect(result).toBe(true);
            expect(mockFs.unlinkSync).toHaveBeenCalledWith('/path/file.txt');
        });

        it('should return false if file does not exist', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(false);

            const result = filesService.deleteFileFromDisk('/path/nonexistent.txt');

            expect(result).toBe(false);
            expect(mockFs.unlinkSync).not.toHaveBeenCalled();
        });

        it('should handle deletion errors', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.unlinkSync = jest.fn().mockImplementation(() => {
                throw new Error('Permission denied');
            });

            expect(() => filesService.deleteFileFromDisk('/restricted/file.txt')).toThrow('Permission denied');
        });

        it('should handle absolute paths', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.unlinkSync = jest.fn();

            filesService.deleteFileFromDisk('/absolute/path/file.txt');

            expect(mockFs.unlinkSync).toHaveBeenCalledWith('/absolute/path/file.txt');
        });

        it('should handle relative paths', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(true);
            mockFs.unlinkSync = jest.fn();

            filesService.deleteFileFromDisk('relative/path/file.txt');

            expect(mockFs.unlinkSync).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle file system errors gracefully', () => {
            mockFs.readdirSync = jest.fn().mockImplementation(() => {
                throw new Error('File system error');
            });

            expect(() => filesService.getFiles('/error/path', true)).toThrow('File system error');
        });

        it('should handle invalid paths', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(false);

            const result = filesService.deleteFileFromDisk('');

            expect(result).toBe(false);
        });

        it('should handle null or undefined paths', () => {
            mockFs.existsSync = jest.fn().mockReturnValue(false);

            const result = filesService.deleteFileFromDisk(null as any);

            expect(result).toBe(false);
        });
    });
});
