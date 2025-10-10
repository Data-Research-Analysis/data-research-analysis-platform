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

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { fileName, operation, identifier } = workerData;
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
            parentPort.postMessage({ message: 'file corrupt', completed: false, file: fileName });
        }
        parentPort.postMessage({ message: EOperation.PDF_TO_IMAGES_COMPLETE, identifier: identifier });
        return resolve();
    });
}

async function extractTextFromImage(fileName) {
    return new Promise(async (resolve, reject) => {
        const completePath = path.join(UtilityService.getInstance().getConstants('PUBLIC_BACKEND_URL'), 'uploads', 'pdfs', 'images', path.basename(fileName));
        await AWSService.getInstance().deleteAllFilesFromS3Bucket();
        await AWSService.getInstance().uploadFileToS3Bucket(completePath);
        const page = await AmazonTextExtractDriver.getInstance().buildPageModel(path.basename(fileName));
        const excelFilePath = path.join(baseDir, 'public', 'uploads', 'pdfs', path.basename(fileName));
        await AmazonTextExtractDriver.getInstance().convertExtractedTextToTable(excelFilePath, page);
        parentPort.postMessage({ message: EOperation.EXTRACT_TEXT_FROM_IMAGE_COMPLETE, identifier: identifier });
        return resolve();
    });
}