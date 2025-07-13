import { IFileDriver } from "../interfaces/IFileDriver.js";
import fs from 'fs';
import path from 'path';

export class HTMLFileDriver implements IFileDriver {
    private static instance: HTMLFileDriver;
    private constructor() {
    }
    public static getInstance(): HTMLFileDriver {
        if (!HTMLFileDriver.instance) {
            HTMLFileDriver.instance = new HTMLFileDriver();
        }
        return HTMLFileDriver.instance;
    }
    public async initialize(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            console.log('Initializing HTMLFileDriver');
            
            return resolve();
        });
    }
    public getConcreteDriver(): Promise<any> {
        throw new Error("Method not implemented.");
    }
    public read(fileName: string): Promise<any> {
        return new Promise<any>(async (resolve, reject) => {
            const baseDir = path.join(__dirname, `${path.sep}..${path.sep}templates/`);
            console.log('baseDir', baseDir);
            console.log('resolved path', path.resolve(`${baseDir}${fileName}`));
            return resolve(this.readFromFile(`${baseDir}${fileName}`));
        });
    }
    public write(fileName: string, content: string): Promise<any> {
        throw new Error("Method not implemented.");
    }
    public close(): Promise<void> {
        throw new Error("Method not implemented.");
    }

    public async readDir(directoryPath: string): Promise<string[]> {
        return new Promise<string[]>(async (resolve, reject) => {
            return resolve(await fs.promises.readdir(directoryPath));
        });
    }

    public async readFromFile(filePath: string): Promise<string | null> {
        return new Promise<string | null>(async (resolve, reject) => {
            fs.readFile(filePath, 'utf-8', async function(err, data){
                if(!err && data) {
                    return resolve(data);
                } else {
                    return reject(err);
                }
            });
        });
    }
}