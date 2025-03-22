import { IFileDriver } from "../interfaces/IFileDriver";
import { HTMLFileDriver } from "./HTMLFileDriver";

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
    public getDriver(driver: string): IFileDriver {
        if (driver === 'html') {
            return HTMLFileDriver.getInstance();
        }
        return null;
    }
   
}