import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export class FilesService {
    private static instance: FilesService;
    private constructor() {
    }

    public static getInstance(): FilesService {
        if(!FilesService.instance) {
            FilesService.instance = new FilesService();
        }
        return FilesService.instance;
    }

    public getPathSeparator(): string {
        return path.sep;
    }

    public async getDirectoryPath(type: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            const directoryPathParts = __dirname.split(path.sep);
            directoryPathParts.pop();
            directoryPathParts.pop();
            directoryPathParts.push(type);
            const directoryPath = directoryPathParts.join(path.sep);
            return resolve(directoryPath);
        });
    }

    public async getFiles(type: string, firstLevelOnly: boolean = false): Promise<string[]> {
        return new Promise<string[]>(async (resolve, reject) => {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = dirname(__filename);
            // console.log('getFiles type', type);
            const directoryPathParts = __dirname.split(path.sep);
            // console.log('directoryPathParts', directoryPathParts);
            directoryPathParts.pop();
            directoryPathParts.pop();
            directoryPathParts.push(type);
            // console.log('directoryPathParts', directoryPathParts);
            let directoryPath = directoryPathParts.join(path.sep);
            let listOfFiles:string[] = [];
            let i = 0;
            let files = [];
            try {
                files = await fs.promises.readdir(directoryPath);
            } catch (error) {
                console.log('error', error);
                return resolve([]);
            }
            // console.log('files', files);
            await Promise.all(files.map(async (file: string) => {
                const directoryPath1 = `${directoryPath}${path.sep}${file}`;
                if (!firstLevelOnly && (fs.lstatSync(directoryPath1)).isDirectory()) {
                    const filePaths = await fs.promises.readdir(directoryPath1);
                    await Promise.all(filePaths.map(async (filePath: string) => {
                        const directoryPath2 = `${directoryPath1}${path.sep}${filePath}`;
                        if ((fs.lstatSync(directoryPath2)).isDirectory()) {
                            let filePaths2 = await fs.promises.readdir(directoryPath2);
                            filePaths2 = filePaths2.map((filePath2: string) => {
                                return `${filePath2}`;
                            });
                            listOfFiles.push(...filePaths2);
                        } else {
                             listOfFiles.push(filePath);
                        }
                    }));
                } else {
                    listOfFiles.push(directoryPath1)
                }
            }));
            return resolve(listOfFiles);
        });
    }

    public async readDir(directoryPath: string): Promise<string[]> {
        return new Promise<string[]>(async (resolve, reject) => {
            return resolve(await fs.promises.readdir(directoryPath));
        });
    }

    public async renameFile(oldFilePath: string, newFilePath: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            if (fs.existsSync(oldFilePath)) {
                fs.renameSync(oldFilePath, newFilePath);
                return resolve(true);
            } else {
                console.log('renameFile file does not exist', oldFilePath);
                return resolve(false);
            }
        });
    }
    
    public deleteFileFromDisk(filePath: string): void {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        } else {
            console.log('deleteFileFromDisk file does not exist', filePath);
        }
    }

    public deleteDirectoryFromDisk(directoryPath: string): void {
        if (fs.existsSync(directoryPath)) {
            fs.rmdirSync(directoryPath);
        } else {
            console.log('deleteDirectoryFromDisk directory does not exist', directoryPath);
        }
    }
}