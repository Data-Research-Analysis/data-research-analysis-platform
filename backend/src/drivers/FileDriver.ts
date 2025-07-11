import { IFileDriver } from "../interfaces/IFileDriver.js";
import { HTMLFileDriver } from "./HTMLFileDriver.js";

export class FileDriver {
    private static instance: FileDriver;
    private constructor() {
    }
    public static getInstance(): FileDriver {
        if (!FileDriver.instance) {
            FileDriver.instance = new FileDriver();
        }
        return FileDriver.instance;
    }

    //This is a factory method to get the relevant driver
    public getDriver(driver: string): IFileDriver | null {
        if (driver === 'html') {
            return HTMLFileDriver.getInstance();
        }
        return null;
    }
   
}