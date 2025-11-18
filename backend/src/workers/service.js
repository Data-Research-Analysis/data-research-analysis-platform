import { exec } from "child_process";
import { workerData, parentPort } from 'worker_threads';
import util from 'node:util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EOperation } from '../../dist/types/EOperation.js';
import { UtilityService } from '../../dist/services/UtilityService.js';
import { AWSService } from '../../dist/services/AWSService.js';
import { AmazonTextExtractDriver } from '../../dist/drivers/AmazonTextExtractDriver.js';
import { EPageType } from "../../dist/types/EPageType.js";
import { FilesService } from "../../dist/services/FilesService.js";
import { DatabaseBackupService } from "../../dist/services/DatabaseBackupService.js";
// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { fileName, operation, identifier, userId } = workerData;
const directoryPathParts = __dirname.split(path.sep);
directoryPathParts.pop();
directoryPathParts.pop();
const baseDir = directoryPathParts.join(path.sep);
console.log('Running worker:', workerData);

console.log('operation:', operation);
console.log('EOperation.EXTRACT_TEXT_FROM_IMAGE', EOperation.EXTRACT_TEXT_FROM_IMAGE);
if (operation === EOperation.PDF_TO_IMAGES) {
    await convertPDFs(fileName);
} else if (operation === EOperation.EXTRACT_TEXT_FROM_IMAGE) {
    await extractTextFromImage(fileName);
} else if (operation === EOperation.DELETE_FILES) {
    await deleteFiles(userId);
} else if (operation === EOperation.DATABASE_BACKUP) {
    await createDatabaseBackup(userId);
} else if (operation === EOperation.DATABASE_RESTORE) {
    await restoreDatabaseFromBackup(fileName, userId);
}

/**
 * Convert PDFs
 * @param {string} fileName - Source file path
 * @returns {Promise<void>} Promise that resolves when conversion is complete
 */
async function convertPDFs(fileName) {
    return new Promise(async (resolve, reject) => {
        const extension = path.extname(fileName);
        const sourcePath = path.join(baseDir, 'public', 'uploads', 'pdfs', path.basename(fileName));
        const targetPath = path.join(baseDir, 'public', 'uploads', 'pdfs', 'images', `${fileName.replace(extension, '')}-%02d.png`);
        const executor = util.promisify(exec);
        const {stdout, stderr} = await executor(`gs -dNOSAFER -dNOPAUSE -sDEVICE=pnggray -dBATCH -r600 -sOutputFile="${targetPath}"  ${sourcePath}`);
        if (stderr) {
            console.log(`stderror: ${stderr}`);
            parentPort.postMessage({ message: 'file corrupt', data: { completed: false, identifier: identifier, file: fileName, data: null } });
        }
        parentPort.postMessage({ message: EOperation.PDF_TO_IMAGES_COMPLETE, data: { identifier: identifier, data: null } });
        return resolve();
    });
}

async function extractTextFromImage(fileName) {
    return new Promise(async (resolve, reject) => {
        const completePath = path.join(UtilityService.getInstance().getConstants('PUBLIC_BACKEND_URL'), 'uploads', 'pdfs', 'images', path.basename(fileName));
        await AWSService.getInstance().deleteAllFilesFromS3Bucket();
        await AWSService.getInstance().uploadFileToS3Bucket(completePath);
        const [page, pageType] = await AmazonTextExtractDriver.getInstance().buildPageModel(path.basename(fileName));
        let data = [];
        console.log('extractTextFromImage - path.basename(fileName)', path.basename(fileName));
        if (pageType === EPageType.TABLE) {
            data = await AmazonTextExtractDriver.getInstance().convertExtractedTextToDataArray(page);
        } else if (pageType === EPageType.TEXT) {
            data = await AmazonTextExtractDriver.getInstance().convertExtractedTextToDataArray(page);
        }
        parentPort.postMessage({ message: EOperation.EXTRACT_TEXT_FROM_IMAGE_COMPLETE, data: { identifier: identifier, data: data } });
        return resolve();
    });
}

async function deleteFiles(userId) {
    return new Promise(async (resolve, reject) => {
        const pdfsDirectoryPath = await FilesService.getInstance().getDirectoryPath('public/uploads/pdfs');
        const imagesDirectoryPath = await FilesService.getInstance().getDirectoryPath('public/uploads/pdfs/images');
        const pdfFiles = await FilesService.getInstance().readDir(pdfsDirectoryPath);
        const imagesFiles = await FilesService.getInstance().readDir(imagesDirectoryPath);

        console.log('pdfFiles', pdfFiles);
        console.log('imagesFiles', imagesFiles);

        const userPdfFiles = pdfFiles.filter((file) => file.startsWith(userId + '_')).map(file => path.join(pdfsDirectoryPath, file));
        const userImageFiles = imagesFiles.filter((file) => file.startsWith(userId + '_')).map(file => path.join(imagesDirectoryPath, file));

        console.log('userPdfFiles', userPdfFiles);
        console.log('userImageFiles', userImageFiles);
        for (const filePath of userImageFiles) {
            await FilesService.getInstance().deleteFileFromDisk(filePath);
        }
        for (const filePath of userPdfFiles) {
            await FilesService.getInstance().deleteFileFromDisk(filePath);
        }
        // parentPort.postMessage({ message: EOperation.DELETE_FILES_COMPLETE, data: { identifier: identifier } });
        return resolve();
    });
}

/**
 * Create database backup
 * @param {number} userId - User ID creating the backup
 * @returns {Promise<void>}
 */
async function createDatabaseBackup(userId) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Creating database backup for user:', userId);
            const metadata = await DatabaseBackupService.getInstance().createBackup(userId);
            
            parentPort.postMessage({ 
                message: EOperation.DATABASE_BACKUP_COMPLETE, 
                backupFile: metadata.filename,
                backupId: metadata.id,
                size: metadata.size,
                timestamp: metadata.created_at
            });
            
            console.log('Database backup created successfully');
            return resolve();
        } catch (error) {
            console.error('Error creating database backup:', error);
            parentPort.postMessage({ 
                message: EOperation.DATABASE_BACKUP_COMPLETE, 
                error: error.message,
                success: false
            });
            return reject(error);
        }
    });
}

/**
 * Restore database from backup
 * @param {string} zipFilePath - Path to backup ZIP file
 * @param {number} userId - User ID restoring the backup
 * @returns {Promise<void>}
 */
async function restoreDatabaseFromBackup(zipFilePath, userId) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('Restoring database from backup:', zipFilePath);
            
            // Progress callback to send updates to frontend
            const progressCallback = (progress, status) => {
                parentPort.postMessage({ 
                    message: EOperation.DATABASE_RESTORE_PROGRESS,
                    progress: progress,
                    status: status
                });
            };
            
            const success = await DatabaseBackupService.getInstance().restoreFromBackup(
                zipFilePath,
                userId,
                progressCallback
            );
            
            parentPort.postMessage({ 
                message: EOperation.DATABASE_RESTORE_COMPLETE,
                success: success,
                resultMessage: success ? 'Database restored successfully' : 'Database restore failed'
            });
            
            console.log('Database restore completed');
            return resolve();
        } catch (error) {
            console.error('Error restoring database:', error);
            parentPort.postMessage({ 
                message: EOperation.DATABASE_RESTORE_COMPLETE,
                success: false,
                resultMessage: error.message
            });
            return reject(error);
        }
    });
}