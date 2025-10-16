import { ITextExtractDriver } from "../interfaces/ITextExtractDriver.js";
import { ETextExtractServices } from "../types/ETextExtractServices.js";
import { AmazonTextExtractDriver } from "./AmazonTextExtractDriver.js";

export class TextExtractDriver {
    private static instance: TextExtractDriver;
    private constructor() {
    }
    public static getInstance(): TextExtractDriver {
        if (!TextExtractDriver.instance) {
            TextExtractDriver.instance = new TextExtractDriver();
        }
        return TextExtractDriver.instance;
    }
    public getDriver(driverName: ETextExtractServices): Promise<ITextExtractDriver> {
        return new Promise<ITextExtractDriver>(async (resolve, reject) => {
            console.log('Getting driver', driverName);
            if (driverName === ETextExtractServices.AMAZON_AWS) {
                return resolve(AmazonTextExtractDriver.getInstance());
            }
            return resolve(AmazonTextExtractDriver.getInstance());
        });
    }
}